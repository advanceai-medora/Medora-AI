import base64
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import logging
import os
from dotenv import load_dotenv
import requests
import json
import boto3
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson.objectid import ObjectId
import uuid
import time
import certifi
import xml.etree.ElementTree as ET
import re

# Load environment variables from .env file
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {"origins": ["http://127.0.0.1:8080", "http://localhost:8080", "https://test.medoramd.ai"], "methods": ["GET", "POST", "OPTIONS"]},
    r"/submit-transcript": {"origins": ["https://test.medoramd.ai"], "methods": ["POST", "OPTIONS"]},
    r"/get-insights": {"origins": ["https://test.medoramd.ai"], "methods": ["GET", "OPTIONS"]}
})

# Configure logging
log_level = os.getenv('LOG_LEVEL', 'INFO')
logging.basicConfig(level=getattr(logging, log_level.upper(), logging.INFO))
logger = logging.getLogger(__name__)

# Load environment variables
FLASK_ENV = os.getenv('FLASK_ENV', 'development')
PORT = int(os.getenv('PORT', 5000))
AWS_REGION = os.getenv('AWS_REGION', 'ap-south-1')
S3_BUCKET = os.getenv('S3_BUCKET', 'medora-healthscribe-2025')
XAI_API_KEY = os.getenv('XAI_API_KEY')
XAI_API_URL = os.getenv('XAI_API_URL')
DEEPL_API_KEY = os.getenv('DEEPL_API_KEY')
DEEPL_API_URL = os.getenv('DEEPL_API_URL', 'https://api-free.deepl.com/v2/translate')
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/medora')
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'medora')

# Validate required environment variables
if not XAI_API_KEY or not XAI_API_URL:
    logger.error("Missing required environment variables: XAI_API_KEY or XAI_API_URL")
    raise ValueError("Missing required environment variables: XAI_API_KEY or XAI_API_URL")
if not MONGO_URI:
    logger.error("Missing required environment variable: MONGO_URI")
    raise ValueError("Missing required environment variable: MONGO_URI")
if not S3_BUCKET:
    logger.error("Missing required environment variable: S3_BUCKET")
    raise ValueError("Missing required environment variable: S3_BUCKET")
if not AWS_REGION:
    logger.error("Missing required environment variable: AWS_REGION")
    raise ValueError("Missing required environment variable: AWS_REGION")

# Initialize AWS clients
try:
    transcribe_client = boto3.client('transcribe', region_name='us-east-1')
    s3_client = boto3.client('s3', region_name=AWS_REGION)
    dynamodb = boto3.client('dynamodb', region_name=AWS_REGION)
    lambda_client = boto3.client('lambda', region_name=AWS_REGION)
    logger.info("Successfully initialized AWS clients")
except Exception as e:
    logger.error(f"Failed to initialize AWS clients: {str(e)}")
    raise

# Connect to MongoDB (DocumentDB)
try:
    client = MongoClient(
        MONGO_URI,
        tls=True,
        tlsCAFile='/var/www/medora-web-backend/global-bundle.pem'
    )
    db = client[MONGO_DB_NAME]
    patients_collection = db['patients']
    transcripts_collection = db['transcripts']
    visits_collection = db['visits']
    logger.info("Successfully connected to MongoDB")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {str(e)}")
    raise

# Hardcoded subscription and user data
SUBSCRIPTIONS = {
    "doctor@allergyaffiliates.com": {"tier": "Premium", "trial_start": None, "card_last4": "1234"},
    "testuser@example.com": {"tier": "Trial", "trial_start": "2025-03-11", "card_last4": "5678"}
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
      - social_history: [Include relevant lifestyle factors, occupation, smoking/alcohol history, and environmental exposures]
      - review_of_systems: [Note additional symptoms across systems, e.g., fatigue, fever, weight changes]
    - physical_examination: [Infer physical findings based on the transcript or note if a physical exam is needed]
    - differential_diagnosis: [List primary diagnosis and 2-3 alternative diagnoses, considering severity and supporting evidence]
    - diagnostic_workup: [Recommend specific tests with rationale]
    - plan_of_care: [Provide a detailed treatment plan with specific medications, dosages, environmental controls, emergency management, long-term strategies, and follow-up schedule. Format as sections based on each diagnosis in differential_diagnosis, e.g.:
      In regards to [Primary Diagnosis]:
      - [Recommendation 1]
      - [Recommendation 2]
      In regards to [Alternative Diagnosis 1]:
      - [Recommendation 1]
      - [Recommendation 2]
      In regards to [Alternative Diagnosis 2]:
      - [Recommendation 1]
      - [Recommendation 2]
      If applicable, include a section for Follow-Up or Emergency Management:
      In regards to Follow-Up:
      - [Follow-up instructions]
      In regards to Emergency Management:
      - [Emergency instructions, e.g., EpiPen use]
    ]
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
            "allergies": "string",
            "social_history": "string",
            "review_of_systems": "string"
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

            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            if start_idx != -1 and end_idx != -1:
                json_str = response_text[start_idx:end_idx].strip()
                try:
                    parsed_data = json.loads(json_str)
                    logger.info(f"Parsed JSON: {parsed_data}")
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
                        "patient_history": {
                            "chief_complaint": f"JSON parsing error: {str(e)}",
                            "history_of_present_illness": "N/A",
                            "past_medical_history": "N/A",
                            "allergies": "N/A",
                            "social_history": "N/A",
                            "review_of_systems": "N/A"
                        },
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
            "patient_history": {
                "chief_complaint": "Unable to generate due to API response error",
                "history_of_present_illness": "N/A",
                "past_medical_history": "N/A",
                "allergies": "N/A",
                "social_history": "N/A",
                "review_of_systems": "N/A"
            },
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
            "patient_history": {
                "chief_complaint": f"Error: {error_message}",
                "history_of_present_illness": "N/A",
                "past_medical_history": "N/A",
                "allergies": "N/A",
                "social_history": "N/A",
                "review_of_systems": "N/A"
            },
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
            "patient_history": {
                "chief_complaint": f"Error: {str(e)}",
                "history_of_present_illness": "N/A",
                "past_medical_history": "N/A",
                "allergies": "N/A",
                "social_history": "N/A",
                "review_of_systems": "N/A"
            },
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
        return text
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

@app.route('/api/transcribe-audio', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({"success": False, "error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    tenant_id = request.form.get('tenantId', 'default_tenant')

    try:
        audio_key = f"audio/{tenant_id}/{datetime.now().isoformat()}_{audio_file.filename}"
        s3_client.upload_fileobj(audio_file, S3_BUCKET, audio_key)
        audio_uri = f"s3://{S3_BUCKET}/{audio_key}"
        logger.info(f"Uploaded audio file to S3: {audio_uri}")
    except Exception as e:
        logger.error(f"Error uploading audio to S3: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

    try:
        job_name = f"HealthScribeJob_{datetime.now().isoformat().replace(':', '-')}"
        transcribe_client.start_medical_transcription_job(
            MedicalTranscriptionJobName=job_name,
            LanguageCode='en-US',
            MediaFormat=audio_file.filename.split('.')[-1],
            Media={'MediaFileUri': audio_uri},
            OutputBucketName=S3_BUCKET,
            Specialty='PRIMARYCARE',
            Type='CONVERSATION',
            Settings={
                'ShowSpeakerLabels': True,
                'MaxSpeakerLabels': 2,
                'ChannelIdentification': False
            }
        )
        logger.info(f"Started HealthScribe transcription job: {job_name}")

        while True:
            status = transcribe_client.get_medical_transcription_job(MedicalTranscriptionJobName=job_name)
            if status['MedicalTranscriptionJob']['TranscriptionJobStatus'] in ['COMPLETED', 'FAILED']:
                break
            logger.debug(f"Waiting for transcription job {job_name} to complete...")
            time.sleep(5)

        if status['MedicalTranscriptionJob']['TranscriptionJobStatus'] == 'COMPLETED':
            transcript_file_uri = status['MedicalTranscriptionJob']['Transcript']['TranscriptFileUri']
            transcript_key = transcript_file_uri.split('/')[-1]
            transcript_obj = s3_client.get_object(Bucket=S3_BUCKET, Key=transcript_key)
            transcript_data = json.loads(transcript_obj['Body'].read().decode())
            transcript_text = transcript_data['results']['transcripts'][0]['transcript']
            logger.info(f"Transcription completed for job {job_name}")
            return jsonify({"success": True, "transcript": transcript_text}), 200
        else:
            logger.error(f"Transcription job {job_name} failed: {status['MedicalTranscriptionJob'].get('FailureReason', 'Unknown reason')}")
            return jsonify({"success": False, "error": "Transcription job failed"}), 500
    except Exception as e:
        logger.error(f"Error with HealthScribe transcription: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/create-patient', methods=['POST', 'OPTIONS'])
def create_patient():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
    try:
        data = request.get_json()
        tenant_id = data.get('tenantId', 'default_tenant')
        name = data.get('name')
        age = data.get('age')
        medical_history = data.get('medicalHistory', '')

        if not name or age is None:
            return jsonify({"success": False, "error": "Missing required fields: name or age"}), 400

        patient_doc = {
            "tenantId": tenant_id,
            "name": name,
            "age": int(age),
            "medicalHistory": medical_history,
            "createdAt": datetime.now().isoformat()
        }
        result = patients_collection.insert_one(patient_doc)
        patient_id = str(result.inserted_id)
        logger.info(f"Created patient with ID {patient_id} in tenant {tenant_id}")

        return jsonify({"success": True, "patientId": patient_id}), 200
    except Exception as e:
        logger.error(f'Error processing /api/create-patient request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/get-patients', methods=['GET'])
def get_patients():
    try:
        tenant_id = request.args.get('tenantId', 'default_tenant')
        patients = list(patients_collection.find({"tenantId": tenant_id}))
        for patient in patients:
            patient["patientId"] = str(patient["_id"])
            patient.pop("_id")
        logger.info(f"Retrieved patients for tenant {tenant_id}")
        return jsonify({"success": True, "patients": patients}), 200
    except Exception as e:
        logger.error(f'Error processing /api/get-patients request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/fetchPatients', methods=['GET'])
def fetch_patients():
    try:
        return get_patients()
    except Exception as e:
        logger.error(f'Error processing /api/fetchPatients request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/get-patient-history', methods=['GET'])
def get_patient_history():
    try:
        tenant_id = request.args.get('tenantId', 'default_tenant')
        patient_id = request.args.get('patientId')

        if not patient_id:
            return jsonify({"success": False, "error": "Missing patientId"}), 400

        transcripts = list(transcripts_collection.find({"tenantId": tenant_id, "patientId": patient_id}))
        for transcript in transcripts:
            transcript["id"] = str(transcript["_id"])
            transcript.pop("_id")
        logger.info(f"Retrieved patient history for patient {patient_id} in tenant {tenant_id}")
        return jsonify({"success": True, "transcripts": transcripts}), 200
    except Exception as e:
        logger.error(f'Error processing /api/get-patient-history request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/visit/start', methods=['POST', 'OPTIONS'])
def start_visit():
    if request.method == 'OPTIONS':
        logger.info("Handling OPTIONS request for /api/visit/start")
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
    logger.info("Handling POST request for /api/visit/start")
    try:
        # Log the incoming request
        logger.debug(f"Request headers: {request.headers}")
        logger.debug(f"Request JSON: {request.get_json()}")

        data = request.get_json()
        patient_id = data.get('patientId')
        email = data.get('email')
        tenant_id = data.get('tenantId', 'default_tenant')

        logger.debug(f"Received data - patientId: {patient_id}, email: {email}, tenantId: {tenant_id}")

        if not patient_id or not email:
            logger.error("Missing required fields: patientId or email")
            return jsonify({"success": False, "error": "Patient ID and email are required"}), 400

        logger.debug("Checking subscription status")
        status = get_subscription_status(email)
        logger.debug(f"Subscription status: {status}")
        if status["tier"] not in ["Trial", "Premium"]:
            logger.error(f"Active subscription required for email: {email}")
            return jsonify({"success": False, "error": "Active subscription required"}), 403
        if status["tier"] == "Expired":
            logger.error(f"Trial expired for email: {email} on {status['trial_end']}")
            return jsonify({"success": False, "error": f"Trial expired on {status['trial_end']}"}), 403

        logger.debug("Finding patient in MongoDB")
        patient = patients_collection.find_one({"tenantId": tenant_id, "name": patient_id})
        logger.debug(f"Patient found: {patient}")
        if not patient:
            logger.info(f"Patient {patient_id} not found, creating new patient")
            patient_doc = {
                "tenantId": tenant_id,
                "name": patient_id,
                "age": None,
                "medicalHistory": None,
                "createdAt": datetime.now().isoformat()
            }
            patient_result = patients_collection.insert_one(patient_doc)
            patient_id = str(patient_result.inserted_id)
            logger.info(f"Created new patient with ID: {patient_id}")
        else:
            patient_id = str(patient["_id"])
            logger.info(f"Using existing patient ID: {patient_id}")

        logger.debug("Creating visit document")
        visit_id = str(uuid.uuid4())
        visit_doc = {
            "visitId": visit_id,
            "tenantId": tenant_id,
            "patientId": patient_id,
            "clinicianEmail": email,
            "startTime": datetime.now().isoformat(),
            "status": "active"
        }
        logger.debug(f"Inserting visit document: {visit_doc}")
        visits_collection.insert_one(visit_doc)
        logger.info(f"Visit started: {visit_id} for patient {patient_id} by {email}")

        return jsonify({"success": True, "message": "Visit started", "visitId": visit_id, "patientId": patient_id}), 201
    except Exception as e:
        logger.error(f"Error starting visit: {str(e)}")
        logger.error(f"Exception traceback: {str(e.__traceback__)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/delete-patient', methods=['POST', 'OPTIONS'])
def delete_patient():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
    try:
        data = request.get_json()
        patient_id = data.get('patientId')
        tenant_id = data.get('tenantId', 'default_tenant')

        if not patient_id:
            return jsonify({"success": False, "error": "Missing patientId"}), 400

        result = patients_collection.delete_one({"_id": ObjectId(patient_id), "tenantId": tenant_id})
        if result.deleted_count == 0:
            return jsonify({"success": False, "error": "Patient not found"}), 404

        transcripts_collection.delete_many({"patientId": patient_id, "tenantId": tenant_id})
        visits_collection.delete_many({"patientId": patient_id, "tenantId": tenant_id})

        logger.info(f"Deleted patient {patient_id} and associated data in tenant {tenant_id}")
        return jsonify({"success": True, "message": "Patient deleted successfully"}), 200
    except Exception as e:
        logger.error(f'Error processing /api/delete-patient request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/analyze', methods=['POST', 'OPTIONS'])
def analyze_endpoint():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://127.0.0.1:8080")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
    try:
        data = request.get_json()
        email = data.get('email')
        visit_id = data.get('visitId')
        status = get_subscription_status(email)
        tenant_id = data.get('tenantId', 'default_tenant')

        tier = status["tier"]
        trial_end = status["trial_end"]

        if tier == "None":
            return jsonify({"success": False, "error": "Please register to start your free trial"}), 403
        elif tier == "Expired":
            return jsonify({"success": False, "error": f"Free trial expired on {trial_end}. Upgrade to Premium or add payment."}), 403
        elif tier == "Basic":
            return jsonify({"success": False, "error": "Upgrade to Premium for transcript analysis"}), 403

        text = data.get('text', '')
        target_language = data.get('language', 'EN')

        if not text:
            return jsonify({"success": False, "error": "Text is required"}), 400
        if not visit_id:
            return jsonify({"success": False, "error": "Visit ID is required"}), 400

        visit = visits_collection.find_one({"visitId": visit_id, "tenantId": tenant_id})
        if not visit:
            return jsonify({"success": False, "error": "Invalid or missing visit ID"}), 400

        patient_id = visit["patientId"]

        result = analyze_transcript(text, target_language)

        transcript_doc = {
            "tenantId": tenant_id,
            "patientId": patient_id,
            "visitId": visit_id,
            "transcript": text,
            "soapNotes": result,
            "insights": {
                "allergy_triggers": result.get("patient_history", {}).get("allergies", "N/A"),
                "condition": result.get("differential_diagnosis", "N/A").split('\n')[0],
                "recommendations": result.get("patient_education", "N/A")
            },
            "createdAt": datetime.now().isoformat()
        }
        logger.info(f"Preparing to save transcript for patient {patient_id} in tenant {tenant_id}")
        transcript_result = transcripts_collection.insert_one(transcript_doc)
        logger.info(f"Stored transcript for patient {patient_id} in tenant {tenant_id}: Inserted ID {transcript_result.inserted_id}")

        result["transcriptId"] = str(transcript_result.inserted_id)
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        logger.error(f'Error processing /api/analyze request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
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
        logger.error(f'Error processing /api/login request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://127.0.0.1:8080")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        card_number = data.get('card_number')

        if not email or not password or not card_number or len(card_number) < 4:
            return jsonify({"success": False, "message": "Email, password, and valid card number are required"}), 400

        if email in SUBSCRIPTIONS:
            return jsonify({"success": False, "message": "User already registered"}), 400

        trial_start = datetime.now().strftime("%Y-%m-%d")
        SUBSCRIPTIONS[email] = {
            "tier": "Trial",
            "trial_start": trial_start,
            "card_last4": card_number[-4:]
        }
        status = get_subscription_status(email)
        return jsonify({"success": True, "subscription": status["tier"], "trial_end": status["trial_end"], "card_last4": status["card_last4"]}), 200
    except Exception as e:
        logger.error(f'Error processing /api/register request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/submit-transcript', methods=['POST', 'OPTIONS'])
def submit_transcript():
    logger.info("Received request for /submit-transcript")
    if request.method == 'OPTIONS':
        logger.info("Handling OPTIONS request for /submit-transcript")
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response

    logger.info("Handling POST request for /submit-transcript")
    try:
        data = request.get_json()
        patient_id = data.get('patient_id')
        transcript = data.get('transcript')
        visit_id = data.get('visit_id')

        if not all([patient_id, transcript, visit_id]):
            logger.error(f"Missing required fields: patient_id={patient_id}, transcript={'provided' if transcript else 'missing'}, visit_id={visit_id}")
            return jsonify({"error": "patient_id, transcript, and visit_id are required"}), 400

        logger.info(f"Processing transcript for patient_id: {patient_id}, visit_id: {visit_id}")

        # Step 1: Generate SOAP notes using xAI API
        logger.info("Generating SOAP notes via xAI API")
        soap_notes = analyze_transcript(transcript)
        logger.info(f"Generated SOAP notes: {json.dumps(soap_notes, indent=2)}")

        # Step 2: Store SOAP notes in MedoraSOAPNotes table
        logger.info(f"Storing SOAP notes in MedoraSOAPNotes for patient_id: {patient_id}, visit_id: {visit_id}")
        try:
            dynamodb_response = dynamodb.put_item(
                TableName='MedoraSOAPNotes',
                Item={
                    'patient_id': {'S': patient_id},
                    'visit_id': {'S': visit_id},
                    'soap_notes': {'S': json.dumps(soap_notes)},
                    'ttl': {'N': str(int(datetime.now().timestamp()) + 30 * 24 * 60 * 60)}
                }
            )
            logger.info(f"Successfully stored SOAP notes in MedoraSOAPNotes")
        except Exception as e:
            logger.error(f"Failed to store SOAP notes in MedoraSOAPNotes: {str(e)}")
            return jsonify({"error": f"Failed to store SOAP notes in DynamoDB: {str(e)}"}), 500

        # Step 3: Store transcript in MongoDB
        transcript_doc = {
            "tenantId": "default_tenant",
            "patientId": patient_id,
            "visitId": visit_id,
            "transcript": transcript,
            "soapNotes": soap_notes,
            "insights": {
                "allergy_triggers": soap_notes.get("patient_history", {}).get("allergies", "N/A"),
                "condition": soap_notes.get("differential_diagnosis", "N/A").split('\n')[0],
                "recommendations": soap_notes.get("patient_education", "N/A")
            },
            "createdAt": datetime.now().isoformat()
        }
        logger.info(f"Preparing to save transcript for patient {patient_id}")
        try:
            transcript_result = transcripts_collection.insert_one(transcript_doc)
            logger.info(f"Stored transcript for patient {patient_id}: Inserted ID {transcript_result.inserted_id}")
        except Exception as e:
            logger.error(f"Failed to store transcript in MongoDB: {str(e)}")
            return jsonify({"error": f"Failed to store transcript in MongoDB: {str(e)}"}), 500

        return jsonify({
            "statusCode": 200,
            "body": {
                "soap_notes": soap_notes,
                "visit_id": visit_id
            }
        }), 200

    except Exception as e:
        logger.error(f"Unexpected error in /submit-transcript: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

def query_pubmed(condition, retmax=1):
    """
    Query PubMed for articles related to the given condition.
    Returns a list of insights with title, summary, PubMed ID, URL, confidence, and relevance tag.
    """
    try:
        # Step 1: Search PubMed for article IDs
        search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
        search_params = {
            "db": "pubmed",
            "term": f"{condition} treatment OR management",
            "retmax": retmax,
            "sort": "relevance",
            "retmode": "json"
        }
        search_response = requests.get(search_url, params=search_params, timeout=10)
        search_response.raise_for_status()
        search_data = search_response.json()

        id_list = search_data.get("esearchresult", {}).get("idlist", [])
        if not id_list:
            logger.warning(f"No PubMed articles found for condition: {condition}")
            return []

        # Step 2: Fetch article details
        fetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
        fetch_params = {
            "db": "pubmed",
            "id": ",".join(id_list),
            "retmode": "xml"
        }
        fetch_response = requests.get(fetch_url, params=fetch_params, timeout=10)
        fetch_response.raise_for_status()

        # Parse XML response
        root = ET.fromstring(fetch_response.content)
        insights = []

        for article in root.findall(".//PubmedArticle"):
            # Extract title
            title = article.find(".//ArticleTitle")
            title_text = title.text if title is not None else "N/A"

            # Extract abstract (summary)
            abstract = article.find(".//Abstract/AbstractText")
            abstract_text = abstract.text if abstract is not None else "N/A"

            # Extract PubMed ID
            pubmed_id = article.find(".//PMID")
            pubmed_id_text = pubmed_id.text if pubmed_id is not None else "N/A"

            # Construct URL
            url = f"https://pubmed.ncbi.nlm.nih.gov/{pubmed_id_text}/"

            # Assign confidence and relevance tag
            confidence = "Recommended"  # Placeholder; can be improved with a relevance score
            relevance_tag = f"Relevant to {condition.lower()}"

            insights.append({
                "title": title_text,
                "summary": abstract_text,
                "pubmed_id": pubmed_id_text,
                "url": url,
                "confidence": confidence,
                "relevance_tag": relevance_tag
            })

        logger.info(f"Fetched {len(insights)} insights for condition: {condition}")
        return insights

    except Exception as e:
        logger.error(f"Error querying PubMed for condition {condition}: {str(e)}")
        return []

@app.route('/get-insights', methods=['GET', 'OPTIONS'])
def get_insights():
    logger.info("Received request for /get-insights")
    if request.method == 'OPTIONS':
        logger.info("Handling OPTIONS request for /get-insights")
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "GET, OPTIONS")
        return response

    logger.info("Handling GET request for /get-insights")
    try:
        patient_id = request.args.get('patient_id')
        visit_id = request.args.get('visit_id')
        conditions = request.args.get('conditions', '')

        if not patient_id or not visit_id:
            logger.error(f"Missing required parameters: patient_id={patient_id}, visit_id={visit_id}")
            return jsonify({"error": "patient_id and visit_id are required"}), 400

        if not conditions:
            logger.warning(f"No conditions provided for patient_id: {patient_id}, visit_id: {visit_id}")
            return jsonify({
                "patient_id": patient_id,
                "visit_id": visit_id,
                "insights": []
            }), 200

        # Parse conditions into individual diagnoses
        # Example conditions: "Seasonal allergic rhinitis with associated asthma symptoms. Alternative diagnoses: 1) Chronic rhinosinusitis, 2) Non-allergic rhinitis, 3) Oral allergy syndrome exacerbating respiratory symptoms."
        diagnoses = []
        # Split by "Alternative diagnoses:" and process each part
        parts = conditions.split("Alternative diagnoses:")
        primary_part = parts[0].strip()
        # Extract primary diagnosis (before the period)
        primary_diagnosis = primary_part.split('.')[0].replace("Primary diagnosis:", "").strip()
        if primary_diagnosis:
            diagnoses.append(primary_diagnosis)

        # Process alternative diagnoses
        if len(parts) > 1:
            alternatives = parts[1].strip()
            # Split by numbered items (e.g., "1)", "2)", "3)")
            alt_diagnoses = re.split(r'\d+\)', alternatives)
            for alt in alt_diagnoses:
                alt = alt.strip()
                if alt:
                    # Remove trailing periods or commas
                    alt = alt.rstrip('.,').strip()
                    diagnoses.append(alt)

        logger.info(f"Parsed diagnoses: {diagnoses}")

        # Query PubMed for each diagnosis
        all_insights = []
        for diagnosis in diagnoses:
            insights = query_pubmed(diagnosis, retmax=1)
            all_insights.extend(insights)

        if not all_insights:
            logger.warning(f"No insights found for patient_id: {patient_id}, visit_id: {visit_id}")
            return jsonify({
                "patient_id": patient_id,
                "visit_id": visit_id,
                "insights": []
            }), 200

        result = {
            "patient_id": patient_id,
            "visit_id": visit_id,
            "insights": all_insights
        }
        logger.info(f"Returning insights: {json.dumps(result, indent=2)}")
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Unexpected error in /get-insights: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=False)
