from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import logging
import os
from dotenv import load_dotenv
import requests
import json
from datetime import datetime, timedelta

# Load environment variables from .env file
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={
    r"/analyze": {"origins": ["http://127.0.0.1:8080", "http://localhost:8080"], "methods": ["POST", "OPTIONS"]},
    r"/login": {"origins": ["http://127.0.0.1:8080", "http://localhost:8080"], "methods": ["POST", "OPTIONS"]},
    r"/register": {"origins": ["http://127.0.0.1:8080", "http://localhost:8080"], "methods": ["POST", "OPTIONS"]}
})

# Configure logging
log_level = os.getenv('LOG_LEVEL', 'INFO')
logging.basicConfig(level=getattr(logging, log_level.upper(), logging.INFO))
logger = logging.getLogger(__name__)

# Load environment variables
FLASK_ENV = os.getenv('FLASK_ENV', 'development')
PORT = int(os.getenv('PORT', 5000))
XAI_API_KEY = os.getenv('XAI_API_KEY')
XAI_API_URL = os.getenv('XAI_API_URL')
DEEPL_API_KEY = os.getenv('DEEPL_API_KEY')
DEEPL_API_URL = os.getenv('DEEPL_API_URL')

# Validate required environment variables
if not XAI_API_KEY or not XAI_API_URL:
    logger.error("Missing required environment variables: XAI_API_KEY or XAI_API_URL")
    raise ValueError("Missing required environment variables: XAI_API_KEY or XAI_API_URL")

# Hardcoded subscription and user data (simulated, to be replaced with DB in AWS)
SUBSCRIPTIONS = {
    "doctor@allergyaffiliates": {"tier": "Premium", "trial_start": None, "card_last4": "1234"},  # Permanent Premium user
    "testuser@example.com": {"tier": "Trial", "trial_start": "2025-03-11", "card_last4": "5678"}  # Example trial user
}

def get_subscription_status(email):
    """Return the subscription status including tier and trial expiration."""
    user_data = SUBSCRIPTIONS.get(email, {"tier": "None", "trial_start": None, "card_last4": None})
    tier = user_data["tier"]
    trial_start = user_data["trial_start"]

    if tier == "Trial" and trial_start:
        trial_start_date = datetime.strptime(trial_start, "%Y-%m-%d")
        trial_end = trial_start_date + timedelta(days=7)
        if datetime.now() > trial_end:
            return {"tier": "Expired", "trial_end": trial_end.strftime("%Y-%m-%d"), "card_last4": user_data["card_last4"]}
    return {"tier": tier, "trial_end": None, "card_last4": user_data["card_last4"]}

def analyze_transcript(text, target_language="EN"):
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
        "Authorization": f"Bearer {XAI_API_KEY}",
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
        logger.debug(f"Sending request to xAI API: URL={XAI_API_URL}, Headers={headers}, Payload={payload}")
        response = requests.post(XAI_API_URL, headers=headers, json=payload, timeout=30)
        logger.debug(f"xAI API response: Status={response.status_code}, Body={response.text}")
        response.raise_for_status()
        result = response.json()

        if "choices" in result and len(result["choices"]) > 0:
            response_text = result["choices"][0]["message"]["content"]
            logger.info(f"Raw xAI response: {response_text}")

            # Extract the JSON object
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            if start_idx != -1 and end_idx != -1:
                json_str = response_text[start_idx:end_idx].strip()
                try:
                    parsed_data = json.loads(json_str)
                    logger.info(f"Parsed JSON: {parsed_data}")

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
                    logger.error(f"JSON parsing error: {e} with raw data: {json_str[:e.pos + 20]}...")
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
                logger.error(f"No valid JSON object found in response: {response_text}")
        return {
            "patient_history": {"chief_complaint": "Unable to generate due to API response error", "history_of_present_illness": "N/A", "past_medical_history": "N/A", "allergies": "N/A"},
            "physical_examination": "N/A",
            "differential_diagnosis": "No diagnosis available.",
            "diagnostic_workup": "No workup recommended.",
            "plan_of_care": "No plan generated.",
            "patient_education": "N/A",
            "follow_up_instructions": "N/A",
            "summary": "Unable to generate summary due to API response error."
        }
    except requests.exceptions.HTTPError as http_err:
        error_message = f"HTTP Error: {http_err.response.status_code} - {http_err.response.text}"
        logger.error(f"Error calling xAI API: {error_message}")
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
        logger.error(f"Error calling xAI API: {str(e)}")
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
        logger.warning("DeepL API key not provided; returning original text")
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
        translated_text = result["translations"][0]["text"]
        logger.info(f"Translated text to {target_language}: {translated_text}")
        return translated_text
    except Exception as e:
        logger.error(f"Translation error: {str(e)}")
        return text

@app.route('/analyze', methods=['POST', 'OPTIONS'])
def analyze_endpoint():
    if request.method == 'OPTIONS':
        # Handle CORS preflight request
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://127.0.0.1:8080")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
    try:
        data = request.get_json()
        email = data.get('email')
        status = get_subscription_status(email)
        tier = status["tier"]
        trial_end = status["trial_end"]

        if tier == "None":
            return jsonify({"error": "Please register to start your free trial"}), 403
        elif tier == "Expired":
            return jsonify({"error": f"Free trial expired on {trial_end}. Upgrade to Premium or add payment."}), 403
        elif tier == "Basic":
            return jsonify({"error": "Upgrade to Premium for transcript analysis"}), 403

        text = data.get('text', '')
        target_language = data.get('language', 'EN')

        if not text:
            return jsonify({"error": "Text is required"}), 400

        result = analyze_transcript(text, target_language)
        return jsonify(result)
    except Exception as e:
        logger.error(f'Error processing /analyze request: {str(e)}')
        return jsonify({"error": str(e)}), 500

@app.route('/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        # Handle CORS preflight request
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://127.0.0.1:8080")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        if email in SUBSCRIPTIONS and SUBSCRIPTIONS[email]["tier"] in ["Trial", "Premium", "Expired"] and password == "18June2011!":
            status = get_subscription_status(email)
            return jsonify({"success": True, "subscription": status["tier"], "trial_end": status["trial_end"], "card_last4": status["card_last4"]}), 200
        else:
            return jsonify({"success": False, "message": "Invalid email or password"}), 401
    except Exception as e:
        logger.error(f'Error processing /login request: {str(e)}')
        return jsonify({"error": str(e)}), 500

@app.route('/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        # Handle CORS preflight request
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://127.0.0.1:8080")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        card_number = data.get('card_number')  # Mock credit card (last 4 digits for now)

        if not email or not password or not card_number or len(card_number) < 4:
            return jsonify({"success": False, "message": "Email, password, and valid card number are required"}), 400

        if email in SUBSCRIPTIONS:
            return jsonify({"success": False, "message": "User already registered"}), 400

        # Simulate registration with 7-day free trial
        trial_start = datetime.now().strftime("%Y-%m-%d")
        SUBSCRIPTIONS[email] = {
            "tier": "Trial",
            "trial_start": trial_start,
            "card_last4": card_number[-4:]  # Store last 4 digits of card for display
        }
        status = get_subscription_status(email)
        return jsonify({"success": True, "subscription": status["tier"], "trial_end": status["trial_end"], "card_last4": status["card_last4"]}), 200
    except Exception as e:
        logger.error(f'Error processing /register request: {str(e)}')
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=FLASK_ENV == 'development')
