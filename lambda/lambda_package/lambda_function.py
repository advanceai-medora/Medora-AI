import json
import boto3
import os
import logging
import time
import re

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
logger.addHandler(handler)

try:
    import requests
except ImportError:
    logger.error("requests library not found. Please include it in the Lambda deployment package.")
    raise ImportError("requests library not found")

dynamodb = boto3.client('dynamodb', region_name='ap-south-1')

XAI_API_KEY = os.getenv('XAI_API_KEY')
XAI_API_URL = os.getenv('XAI_API_URL')

if not XAI_API_KEY or not XAI_API_URL:
    logger.error("Missing required environment variables: XAI_API_KEY or XAI_API_URL")
    raise ValueError("Missing required environment variables: XAI_API_KEY or XAI_API_URL")

def is_allergy_related(item, transcript):
    """Check if the reference is relevant to allergies and the transcript."""
    keywords = item.get('keywords', {}).get('S', '').lower() if 'S' in item.get('keywords', {}) else ' '.join(kw['S'].lower() for kw in item.get('keywords', {}).get('L', []))
    relevance_tag = item.get('relevance_tag', {}).get('S', '').lower()
    summary = item.get('summary', {}).get('S', '').lower()

    # Core allergy-related terms
    allergy_terms = [
        'allergy', 'allergic', 'anaphylaxis', 'anaphylactic', 'hives', 'urticaria',
        'asthma', 'asthmatic', 'rhinitis', 'eosinophil', 'pollinosis', 'atopic',
        'eczema', 'immunotherapy', 'sensitization', 'ige', 'wasp sting', 'food allergy',
        'shellfish', 'allergen', 'hypersensitivity', 'bronchitis'
    ]

    # Exclude references with irrelevant primary topics
    irrelevant_terms = ['aging', 'trichinella', 'cancer', 'tumor', 'infection']
    if any(term in keywords or term in relevance_tag for term in irrelevant_terms):
        return False, None, 0

    has_allergy_terms = any(term in keywords or term in relevance_tag or term in summary for term in allergy_terms)
    if not has_allergy_terms:
        return False, None, 0

    transcript_words = set(re.split(r'\W+', transcript.lower()))
    summary_words = set(re.split(r'\W+', summary))
    relevance_words = set(re.split(r'\W+', relevance_tag))
    keyword_words = set(re.split(r'\W+', keywords))

    # Calculate general overlap
    overlap = len(transcript_words.intersection(summary_words)) + len(transcript_words.intersection(relevance_words)) + len(transcript_words.intersection(keyword_words))
    if overlap < 1:
        return False, None, 0

    # Specific keyword matching with weights
    specific_keywords = ['wasp sting', 'food allergy', 'shellfish', 'asthma', 'bronchitis', 'anaphylaxis', 'hives', 'rhinitis', 'mold', 'drug allergy']
    keyword_list = keywords.split(',')
    score = 0
    for specific_keyword in specific_keywords:
        if specific_keyword in transcript.lower():
            for keyword in keyword_list:
                if specific_keyword in keyword:
                    score += 3  # High score for exact matches
                elif specific_keyword in summary or specific_keyword in relevance_tag:
                    score += 2  # Medium score for summary/relevance matches
            if specific_keyword in transcript_words:
                score += 1  # Additional point for transcript match

    if score < 3:  # Increased threshold for specificity
        return False, None, 0

    pubmed_id = item.get('pubmed_id', {}).get('S', item.get('pmid', {}).get('S', 'N/A'))
    confidence = item['confidence']['S'] if 'S' in item['confidence'] else str(item['confidence']['N'])

    insight = {
        "title": item['title']['S'],
        "summary": item['summary']['S'],
        "pubmed_id": pubmed_id,
        "confidence": confidence,
        "relevance_tag": item['relevance_tag']['S'],
        "url": item['url']['S']
    }
    reference = {
        "pmid": pubmed_id,
        "title": item['title']['S'],
        "url": item['url']['S']
    }
    return True, (insight, reference), score

def find_relevant_reference(transcript):
    """Find a matching allergy-related reference from MedoraReferences."""
    try:
        response = dynamodb.scan(TableName='MedoraReferences')
        items = response.get('Items', [])
        transcript_words = set(re.split(r'\W+', transcript.lower()))

        best_match = None
        best_score = 0
        best_insight = None
        best_reference = None

        for item in items:
            if 'title' not in item or 'summary' not in item or 'relevance_tag' not in item or 'url' not in item:
                continue
            if 'pubmed_id' not in item and 'pmid' not in item:
                continue

            is_relevant, result, score = is_allergy_related(item, transcript)
            if not is_relevant:
                continue

            insight, reference = result
            if score > best_score:
                best_score = score
                best_match = item
                best_insight = insight
                best_reference = reference

        if best_score >= 3:
            logger.info(f"Found matching allergy-related insight in MedoraReferences: {json.dumps(best_insight, indent=2)}")
            return best_insight, best_reference
        return None, None
    except Exception as e:
        logger.error(f"Error scanning MedoraReferences: {str(e)}")
        return None, None

def lambda_handler(event, context):
    logger.info("Starting MedoraGeneratePatientInsights Lambda execution")
    try:
        if 'body' in event and isinstance(event['body'], str):
            body = json.loads(event['body'])
        elif 'patient_id' in event and 'visit_id' in event and 'transcript' in event:
            body = event
        else:
            logger.error("Invalid event structure")
            raise ValueError("Invalid event structure: Missing required fields")

        patient_id = body.get('patient_id')
        visit_id = body.get('visit_id')
        transcript = body.get('transcript')

        if not patient_id or not visit_id or not transcript:
            logger.error(f"Missing required fields: patient_id={patient_id}, visit_id={visit_id}, transcript={'set' if transcript else 'missing'}")
            raise ValueError("Missing required fields: patient_id, visit_id, or transcript")

        insight, reference = find_relevant_reference(transcript)
        if insight:
            logger.info(f"Using allergy-related reference from MedoraReferences")
        else:
            logger.info("No allergy-related reference found in MedoraReferences, falling back to xAI API")
            prompt = f"""
You are an expert medical AI assistant specializing in allergy and immunology for allergists. Analyze the following patient transcript and provide *exactly one* highly relevant insight in JSON format. The insight must:
- Be based *solely* on the symptoms, medical history, and conditions in the transcript (e.g., allergies, anaphylaxis, hives, asthma).
- Include a specific, actionable recommendation tailored to the patient’s situation (e.g., medication, avoidance, testing).
- Reference a *valid* PubMed article focused on allergies or related conditions (numeric PubMed ID, e.g., 29121456, from reputable journals; avoid mock IDs like 40239041).
- Be the *most relevant* insight possible, addressing primary symptoms or conditions (e.g., wasp sting anaphylaxis, hives).
- Avoid generic or unrelated topics (e.g., *Trichinella spiralis*, infections, or non-allergy conditions unless explicitly mentioned).
- Ensure the insight aligns with clinical standards for allergists.

Insight format:
- title: The title of the PubMed article (allergy-related).
- summary: A summary of the study and its relevance to the patient, with a specific recommendation (100-150 words).
- pubmed_id: The PubMed ID (numeric, e.g., 29121456).
- confidence: One of "Strongly Recommended", "Recommended", "Moderately Recommended", "Neutral", "Not Recommended".
- relevance_tag: Why the insight is relevant (e.g., "Matches patient’s wasp sting anaphylaxis").
- url: The PubMed URL (e.g., "https://pubmed.ncbi.nlm.nih.gov/29121456/").

Reference format:
- pmid: The PubMed ID.
- title: The article title.
- url: The PubMed URL.

Transcript: {transcript}

If no relevant insight can be generated, return empty objects. Do not include insights unrelated to allergies, anaphylaxis, hives, asthma, or the transcript’s context.

Output in JSON format:
{{
    "insight": {{
        "title": "string",
        "summary": "string",
        "pubmed_id": "string",
        "confidence": "string",
        "relevance_tag": "string",
        "url": "string"
    }},
    "reference": {{
        "pmid": "string",
        "title": "string",
        "url": "string"
    }}
}}
            """

            headers = {
                "Authorization": f"Bearer {XAI_API_KEY}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": "grok-2-1212",
                "messages": [
                    {"role": "system", "content": "You are an expert medical AI assistant specializing in allergy and immunology for allergists."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 1000,
                "temperature": 0.2
            }

            logger.info(f"Sending request to xAI API: URL={XAI_API_URL}")
            response = requests.post(XAI_API_URL, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            result = response.json()

            if "choices" not in result or len(result["choices"]) == 0:
                logger.error("No response from xAI API")
                raise Exception("No response from xAI API")

            response_text = result["choices"][0]["message"]["content"]
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            if start_idx == -1 or end_idx == -1:
                logger.error(f"No valid JSON object found in response: {response_text}")
                raise Exception(f"No valid JSON object found in response: {response_text}")

            json_str = response_text[start_idx:end_idx].strip()
            insight_data = json.loads(json_str)

            insight = insight_data.get("insight", {})
            reference = insight_data.get("reference", {})

        item = {
            'patient_id': {'S': patient_id},
            'visit_id': {'S': visit_id},
            'transcript': {'S': transcript},
            'ttl': {'N': str(int(time.time()) + 30 * 24 * 60 * 60)}  # 30 days TTL
        }
        if insight:
            item['insight'] = {
                'M': {
                    'title': {'S': insight['title']},
                    'summary': {'S': insight['summary']},
                    'pubmed_id': {'S': insight['pubmed_id']},
                    'confidence': {'S': insight['confidence']},
                    'relevance_tag': {'S': insight['relevance_tag']},
                    'url': {'S': insight['url']}
                }
            }
            item['reference'] = {
                'M': {
                    'pmid': {'S': reference['pmid']},
                    'title': {'S': reference['title']},
                    'url': {'S': reference['url']}
                }
            }
        else:
            item['insight'] = {'M': {}}
            item['reference'] = {'M': {}}

        dynamodb.put_item(TableName='MedoraPatientInsights', Item=item)
        logger.info("Successfully stored insight in MedoraPatientInsights")

        return {
            "statusCode": 200,
            "body": json.dumps("Insight generated and stored successfully"),
            "headers": {
                "Access-Control-Allow-Origin": "https://medoramd.ai",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, OPTIONS"
            }
        }
    except Exception as e:
        logger.error(f"Error in MedoraGeneratePatientInsights: {str(e)}", exc_info=True)
        return {
            "statusCode": 500,
            "body": json.dumps(f"Error: {str(e)}"),
            "headers": {
                "Access-Control-Allow-Origin": "https://medoramd.ai",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, OPTIONS"
            }
        }
