from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import re

app = Flask(__name__)
CORS(app, resources={r"/analyze": {"origins": "http://127.0.0.1:8080"}})

# Hugging Face Inference API configuration
HF_API_KEY = "hf_**********************************"  # Your provided API key
HF_SCIBERT_URL = "https://api-inference.huggingface.co/models/allenai/scibert_scivocab_uncased"
HF_DISTILBERT_URL = "https://api-inference.huggingface.co/models/distilbert-base-uncased"

def extract_entities(text):
    headers = {
        "Authorization": f"Bearer {HF_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "inputs": text,
        "parameters": {"task": "token-classification"}  # SciBERT for NER
    }
    try:
        response = requests.post(HF_SCIBERT_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        entities = response.json()
        medical_terms = [entity['word'] for entity in entities if entity['entity'].startswith('B-') or entity['entity'].startswith('I-')]
        print(f"Extracted entities: {medical_terms}")
        return list(set(medical_terms))
    except Exception as e:
        print(f"Error calling SciBERT API: {e}")
        return []

def analyze_transcript(text):
    # Extract medical entities using SciBERT
    medical_terms = extract_entities(text)
    entities_str = ", ".join(medical_terms) if medical_terms else "No medical entities identified."
    print(f"Entities string: {entities_str}")

    # Use DistilBERT for structured summarization and plan
    prompt = f"""
    You are a medical scribe AI. Analyze the following patient transcript and the extracted medical entities, and provide a structured medical summary in plain text with the following sections:

    - Patient History:
      - Chief Complaint: [Describe the main issue]
      - History of Present Illness: [Describe the current symptoms and their duration]
      - Past Medical History: [Describe any relevant past medical history]
      - Allergies: [List known allergies]
      - Physical Examination: [Describe physical findings, if any]
    - Differential Diagnosis: [List possible conditions]
    - Diagnostic Workup: [Recommend tests]
    - Plan of Care: [Provide treatment and follow-up plan]
    - Summary: [Summarize the visit]

    Transcript: {text}
    Extracted Medical Entities: {entities_str}

    Ensure all medical terms are accurately contextualized. Avoid speculative diagnoses; flag any uncertainty for human review.
    """

    headers = {
        "Authorization": f"Bearer {HF_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "inputs": prompt,
        "parameters": {"max_length": 500, "temperature": 0.5}
    }

    try:
        response = requests.post(HF_DISTILBERT_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()

        if isinstance(result, list) and len(result) > 0 and "generated_text" in result[0]:
            response_text = result[0]["generated_text"]
            print(f"Raw DistilBERT response: {response_text}")  # Debug full response

            # Parse the structured text response into a dictionary
            parsed_data = {
                "patient_history": {
                    "chief_complaint": "Unable to generate.",
                    "history_of_present_illness": "N/A",
                    "past_medical_history": "N/A",
                    "allergies": "N/A",
                    "physical_examination": "N/A"
                },
                "differential_diagnosis": "No diagnosis available.",
                "diagnostic_workup": "No workup recommended.",
                "plan_of_care": "No plan generated.",
                "summary": "Unable to generate summary."
            }

            # Extract sections using regex
            sections = {
                "Chief Complaint": r"Chief Complaint: (.*?)(?=\n- History of Present Illness:|\n- Past Medical History:|\Z)",
                "History of Present Illness": r"History of Present Illness: (.*?)(?=\n- Past Medical History:|\n- Allergies:|\Z)",
                "Past Medical History": r"Past Medical History: (.*?)(?=\n- Allergies:|\n- Physical Examination:|\Z)",
                "Allergies": r"Allergies: (.*?)(?=\n- Physical Examination:|\n- Differential Diagnosis:|\Z)",
                "Physical Examination": r"Physical Examination: (.*?)(?=\n- Differential Diagnosis:|\n- Diagnostic Workup:|\Z)",
                "Differential Diagnosis": r"Differential Diagnosis: (.*?)(?=\n- Diagnostic Workup:|\n- Plan of Care:|\Z)",
                "Diagnostic Workup": r"Diagnostic Workup: (.*?)(?=\n- Plan of Care:|\n- Summary:|\Z)",
                "Plan of Care": r"Plan of Care: (.*?)(?=\n- Summary:|\Z)",
                "Summary": r"Summary: (.*)\Z"
            }

            for key, pattern in sections.items():
                match = re.search(pattern, response_text, re.DOTALL | re.MULTILINE)
                if match:
                    value = match.group(1).strip() or "N/A"
                    if key in ["Chief Complaint", "History of Present Illness", "Past Medical History", "Allergies", "Physical Examination"]:
                        parsed_data["patient_history"][key.lower().replace(" ", "_")] = value
                    else:
                        parsed_data[key.lower().replace(" ", "_")] = value

            print(f"Parsed data: {parsed_data}")
            return parsed_data
        else:
            print(f"No valid response from DistilBERT: {result}")
    except Exception as e:
        print(f"Error calling DistilBERT API: {e}")
        return {
            "patient_history": {"chief_complaint": f"Error: {str(e)}", "history_of_present_illness": "N/A", "past_medical_history": "N/A", "allergies": "N/A", "physical_examination": "N/A"},
            "differential_diagnosis": "No diagnosis available.",
            "diagnostic_workup": "No workup recommended.",
            "plan_of_care": "No plan generated.",
            "summary": f"Error: {str(e)}"
        }

    return {
        "patient_history": {"chief_complaint": "Unable to generate.", "history_of_present_illness": "N/A", "past_medical_history": "N/A", "allergies": "N/A", "physical_examination": "N/A"},
        "differential_diagnosis": "No diagnosis available.",
        "diagnostic_workup": "No workup recommended.",
        "plan_of_care": "No plan generated.",
        "summary": "Unable to generate summary."
    }

@app.route('/analyze', methods=['POST'])
def analyze_endpoint():
    try:
        data = request.get_json()
        print('Received data:', data)
        text = data.get('text', '')

        if not text:
            response = {'error': 'Text is required'}
            print('Response:', response)
            return jsonify(response), 400

        result = analyze_transcript(text)
        print('Response:', result)
        return jsonify(result)
    except Exception as e:
        response = {'error': str(e)}
        print('Error response:', response)
        return jsonify(response), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
