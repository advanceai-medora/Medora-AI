import json
import boto3
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check for requests library
try:
    import requests
except ImportError:
    logger.error("requests library not found. Please include it in the Lambda deployment package.")
    raise ImportError("requests library not found")

dynamodb = boto3.client('dynamodb', region_name='ap-south-1')

# Load environment variables (set these in the Lambda configuration)
XAI_API_KEY = os.getenv('XAI_API_KEY')
XAI_API_URL = os.getenv('XAI_API_URL')

# Validate environment variables
if not XAI_API_KEY or not XAI_API_URL:
    logger.error("Missing required environment variables: XAI_API_KEY or XAI_API_URL")
    raise ValueError("Missing required environment variables: XAI_API_KEY or XAI_API_URL")

def lambda_handler(event, context):
    logger.info("Starting MedoraGeneratePatientInsights Lambda execution")
    try:
        # Parse the event payload
        logger.info(f"Received event: {json.dumps(event, indent=2)}")
        body = json.loads(event['body'])
        patient_id = body['patient_id']
        visit_id = body['visit_id']
        transcript = body['transcript']

        # Step 1: Generate insights using xAI API
        prompt = f"""
You are an expert medical AI assistant specializing in generating insights for allergists. Analyze the following patient transcript and provide 1-3 relevant insights in JSON format. Each insight should include:

- title: The title of a relevant PubMed article or study.
- summary: A summary of the study and its relevance to the patient\'s condition, including a specific recommendation for the patient.
- pubmed_id: The PubMed ID of the article.
- confidence: A confidence level ("Strongly Recommended", "Recommended", "Moderately Recommended", "Neutral", "Not Recommended").
- relevance_tag: A tag explaining why the insight is relevant (e.g., "Matches patient-reported symptoms").

Also provide a list of references corresponding to the insights, each with:
- pmid: The PubMed ID.
- title: The title of the article.

Transcript: {transcript}

Ensure the insights are highly relevant to the patient\'s specific symptoms, history, and conditions mentioned in the transcript. Use medical knowledge to match the transcript to relevant studies. If no relevant insights can be generated, return empty lists.

Output in JSON format:
{{
    "insights": [
        {{
            "title": "string",
            "summary": "string",
            "pubmed_id": "string",
            "confidence": "string",
            "relevance_tag": "string"
        }}
    ],
    "references": [
        {{
            "pmid": "string",
            "title": "string"
        }}
    ]
}}
"""

        headers = {
            "Authorization": f"Bearer {XAI_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "grok-2-1212",
            "messages": [
                {"role": "system", "content": "You are an expert medical AI assistant specializing in generating insights for allergists."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 1500,
            "temperature": 0.3
        }

        # Call xAI API to generate insights
        logger.info(f"Sending request to xAI API: URL={XAI_API_URL}")
        response = requests.post(XAI_API_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()

        logger.info(f"xAI API response: {json.dumps(result, indent=2)}")

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

        insights = insight_data.get("insights", [])
        references = insight_data.get("references", [])

        logger.info(f"Generated insights: {json.dumps(insights, indent=2)}")
        logger.info(f"Generated references: {json.dumps(references, indent=2)}")

        # Step 2: Store the insights in MedoraPatientInsights
        logger.info(f"Storing insights in MedoraPatientInsights for patient_id: {patient_id}, visit_id: {visit_id}")
        dynamodb.put_item(
            TableName='MedoraPatientInsights',
            Item={
                'patient_id': {'S': patient_id},
                'visit_id': {'S': visit_id},
                'transcript': {'S': transcript},
                'insights': {'L': [{'M': {
                    'title': {'S': insight['title']},
                    'summary': {'S': insight['summary']},
                    'pubmed_id': {'S': insight['pubmed_id']},
                    'confidence': {'S': insight['confidence']},
                    'relevance_tag': {'S': insight['relevance_tag']}
                }} for insight in insights]},
                'references': {'L': [{'M': {
                    'pmid': {'S': ref['pmid']},
                    'title': {'S': ref['title']}
                }} for ref in references]},
                'ttl': {'N': str(int(time.time()) + 30 * 24 * 60 * 60)}  # 30 days TTL
            }
        )

        logger.info("Successfully stored insights in MedoraPatientInsights")

        return {
            "statusCode": 200,
            "body": json.dumps("Insights generated and stored successfully"),
            "headers": {
                "Access-Control-Allow-Origin": "https://test.medoramd.ai",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, OPTIONS"
            }
        }

    except Exception as e:
        logger.error(f"Error in MedoraGeneratePatientInsights: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps(f"Error: {str(e)}"),
            "headers": {
                "Access-Control-Allow-Origin": "https://test.medoramd.ai",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, OPTIONS"
            }
        }
