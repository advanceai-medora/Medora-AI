from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import requests
import json

app = Flask(__name__)
CORS(app, resources={r"/analyze": {"origins": "http://127.0.0.1:8080", "methods": ["POST", "OPTIONS"]}})

# API configurations
GROK_API_KEY = "xai-********************************************************************************"  # Your Grok API key
GROK_API_URL = "https://api.x.ai/v1/chat/completions"
DEEPL_API_KEY = "your-deepl-api-key-here"  # Replace with your DeepL API key
DEEPL_API_URL = "https://api-free.deepl.com/v2/translate"

def analyze_transcript(text, target_language="EN"):
    # Enhanced prompt for professional-grade medical summary with updated structure
    prompt = f"""
    You are an expert medical scribe AI assisting healthcare professionals. Analyze the following patient transcript and provide a detailed, professional-grade medical summary in JSON format with the following sections:

    - patient_history:
      - chief_complaint: [Specify the main issue, including duration and severity]
      - history_of_present_illness: [Provide a detailed narrative including onset, duration, frequency, severity of symptoms, specific triggers, associated symptoms, impact on daily life, exacerbating/alleviating factors, and prior treatments attempted]
      - past_medical_history: [Include all relevant past diagnoses, hospitalizations, surgeries, chronic conditions, and prior allergy/asthma management]
      - allergies: [List all allergies with known reactions and current management]
    - physical_examination: [Infer physical findings based on the transcript or note if a physical exam is needed]
    - differential_diagnosis: [List primary diagnosis and 2-3 alternative diagnoses, considering severity and supporting evidence]
    - diagnostic_workup: [Recommend specific tests with rationale]
    - plan_of_care: [Provide a detailed treatment plan with specific medications, dosages, environmental controls, emergency management, long-term strategies, and follow-up schedule]
    - patient_education: [Provide specific advice for the patient on managing their condition, avoiding triggers, and adhering to the treatment plan]
    - follow_up_instructions: [Provide specific instructions for follow-up appointments, tests, or actions]
    - summary: [Summarize the visit in 2-3 sentences, including key findings, immediate actions, and next steps]

    Transcript: {text}

    Ensure all medical terms are accurate and contextualized for a professional allergist. Include specific details (e.g., medication names, dosages, test types). Avoid speculative diagnoses; flag uncertainty for human review.

    Output in JSON format:
    {{
        "patient_history": {{
            "chief_complaint": "string",
            "history_of_present_illness": "string",
            "past_medical_history": "string",
            "allergies": "string"
        }},
        "physical_examination": "string",
        "differential_diagnosis": "string",
        "diagnostic_workup": "string",
        "plan_of_care": "string",
        "patient_education": "string",
        "follow_up_instructions": "string",
        "summary": "string"
    }}
    """

    headers = {
        "Authorization": f"Bearer {GROK_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "grok-2-1212",
        "messages": [
            {"role": "system", "content": "You are an expert medical scribe AI assisting healthcare professionals. Provide accurate, detailed, and structured medical notes for an allergist, ensuring professional-grade output with specific details and flag uncertainties for review."},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 1500,
        "temperature": 0.3
    }

    try:
        response = requests.post(GROK_API_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()

        if "choices" in result and len(result["choices"]) > 0:
            response_text = result["choices"][0]["message"]["content"]
            print(f"Raw Grok response: {response_text}")

            # Extract the JSON object
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            if start_idx != -1 and end_idx != -1:
                json_str = response_text[start_idx:end_idx].strip()
                try:
                    parsed_data = json.loads(json_str)
                    print(f"Parsed JSON: {parsed_data}")

                    # Translate the summary if a different language is requested
                    if target_language.upper() != "EN":
                        for key, value in parsed_data.items():
                            if isinstance(value, dict):
                                for k, v in value.items():
                                    if isinstance(v, str):
                                        translated = translate_text(v, target_language)
                                        parsed_data[key][k] = translated
                            elif isinstance(value, str):
                                translated = translate_text(value, target_language)
                                parsed_data[key] = translated
                    return parsed_data
                except json.JSONDecodeError as e:
                    print(f"JSON parsing error: {e} with raw data: {json_str[:e.pos + 20]}...")
                    return {
                        "patient_history": {"chief_complaint": f"JSON parsing error: {str(e)}", "history_of_present_illness": "N/A", "past_medical_history": "N/A", "allergies": "N/A"},
                        "physical_examination": "N/A",
                        "differential_diagnosis": "No diagnosis available.",
                        "diagnostic_workup": "No workup recommended.",
                        "plan_of_care": "No plan generated.",
                        "patient_education": "N/A",
                        "follow_up_instructions": "N/A",
                        "summary": f"JSON parsing error: {str(e)}"
                    }
            else:
                print(f"No valid JSON object found in response: {response_text}")
        return {
            "patient_history": {"chief_complaint": "Unable to generate.", "history_of_present_illness": "N/A", "past_medical_history": "N/A", "allergies": "N/A"},
            "physical_examination": "N/A",
            "differential_diagnosis": "No diagnosis available.",
            "diagnostic_workup": "No workup recommended.",
            "plan_of_care": "No plan generated.",
            "patient_education": "N/A",
            "follow_up_instructions": "N/A",
            "summary": "Unable to generate summary."
        }
    except requests.exceptions.HTTPError as http_err:
        error_message = f"HTTP Error: {http_err.response.status_code} - {http_err.response.text}"
        print(f"Error calling Grok API: {error_message}")
        return {
            "patient_history": {"chief_complaint": f"Error: {error_message}", "history_of_present_illness": "N/A", "past_medical_history": "N/A", "allergies": "N/A"},
            "physical_examination": "N/A",
            "differential_diagnosis": "No diagnosis available.",
            "diagnostic_workup": "No workup recommended.",
            "plan_of_care": "No plan generated.",
            "patient_education": "N/A",
            "follow_up_instructions": "N/A",
            "summary": f"Error: {error_message}"
        }
    except Exception as e:
        print(f"Error calling Grok API: {e}")
        return {
            "patient_history": {"chief_complaint": f"Error: {str(e)}", "history_of_present_illness": "N/A", "past_medical_history": "N/A", "allergies": "N/A"},
            "physical_examination": "N/A",
            "differential_diagnosis": "No diagnosis available.",
            "diagnostic_workup": "No workup recommended.",
            "plan_of_care": "No plan generated.",
            "patient_education": "N/A",
            "follow_up_instructions": "N/A",
            "summary": f"Error: {str(e)}"
        }

def translate_text(text, target_language):
    if not DEEPL_API_KEY:
        return text  # Return original text if no DeepL key is provided
    headers = {"Authorization": f"DeepL-Auth-Key {DEEPL_API_KEY}"}
    payload = {
        "text": [text],
        "target_lang": target_language
    }
    try:
        response = requests.post(DEEPL_API_URL, headers=headers, data=payload, timeout=10)
        response.raise_for_status()
        result = response.json()
        return result["translations"][0]["text"]
    except Exception as e:
        print(f"Translation error: {e}")
        return text

@app.route('/analyze', methods=['POST', 'OPTIONS'])
def analyze_endpoint():
    if request.method == 'OPTIONS':
        # Handle CORS preflight request
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://127.0.0.1:8080")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
    try:
        data = request.get_json()
        print('Received data:', data)
        text = data.get('text', '')
        target_language = data.get('language', 'EN')  # Default to English

        if not text:
            response = {'error': 'Text is required'}
            print('Response:', response)
            return jsonify(response), 400

        result = analyze_transcript(text, target_language)
        print('Response:', result)
        return jsonify(result)
    except Exception as e:
        response = {'error': str(e)}
        print('Error response:', response)
        return jsonify(response), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
