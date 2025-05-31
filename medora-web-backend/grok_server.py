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
import traceback
from requests.exceptions import HTTPError
import jwt
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
from typing import List, Dict, Tuple, Optional

# Persistent cache with TTL for API results
persistent_api_cache = {}  # Format: {cache_key: (result, timestamp)}

def get_cached_result(cache_key, ttl_minutes=60):
    if cache_key in persistent_api_cache:
        result, timestamp = persistent_api_cache[cache_key]
        if datetime.now() < timestamp + timedelta(minutes=ttl_minutes):
            return result
        else:
            del persistent_api_cache[cache_key]
    return None

def set_cached_result(cache_key, result):
    persistent_api_cache[cache_key] = (result, datetime.now())

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
from logging.handlers import RotatingFileHandler

log_level = os.getenv('LOG_LEVEL', 'INFO')
logger = logging.getLogger(__name__)
logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
log_formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')

file_handler = RotatingFileHandler(
    '/var/www/medora-web-backend/flask-app.log',
    maxBytes=10*1024*1024,
    backupCount=5
)
file_handler.setFormatter(log_formatter)
logger.addHandler(file_handler)

console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)
logger.addHandler(console_handler)

logger.info("Logging setup complete. Logs will be written to /var/www/medora-web-backend/flask-app.log and console.")

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
IMS_FHIR_SERVER_URL = os.getenv('IMS_FHIR_SERVER_URL', 'https://meditabfhirsandbox.meditab.com/mps/fhir/R4')
IMS_TOKEN_ENDPOINT = os.getenv('IMS_TOKEN_ENDPOINT', 'https://keycloak-qa.medpharmservices.com:8443/realms/fhir-0051185/protocol/openid-connect/token')
IMS_CLIENT_ID = os.getenv('IMS_CLIENT_ID', '4ddd3a59-414c-405e-acc5-226c097a7060')
PRIVATE_KEY_PATH = os.getenv('PRIVATE_KEY_PATH', '/var/www/medora-frontend/public/medora_private_key.pem')

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
    
    try:
        patients_collection.create_index("tenantId")
        transcripts_collection.create_index("tenantId")
        visits_collection.create_index("tenantId")
        logger.info("Created indexes on tenantId fields in MongoDB collections")
    except Exception as e:
        logger.error(f"Error creating indexes: {str(e)}")
    
    logger.info("Successfully connected to MongoDB")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {str(e)}")
    raise

# Hardcoded subscription and user data
SUBSCRIPTIONS = {
    "doctor@allergyaffiliates.com": {"tier": "Premium", "trial_start": None, "card_last4": "1234"},
    "testuser@example.com": {"tier": "Trial", "trial_start": "2025-03-11", "card_last4": "5678"},
    "geepan1806@gmail.com": {"tier": "Premium", "trial_start": None, "card_last4": "7890"},
    "siddharthc@meditab.com": {"tier": "Premium", "trial_start": None, "card_last4": "9012"}
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

def validate_tenant_id(tenant_id, email=None):
    """
    Ensure tenant_id is valid and standardized
    If tenant_id is 'default_tenant' but email is provided, use email instead
    """
    if not tenant_id or tenant_id == 'default_tenant':
        if email:
            logger.info(f"Converting default_tenant to email: {email}")
            return email
        return 'default_tenant'
    return tenant_id

def get_soap_notes(patient_id, visit_id, tenant_id=None):
    """
    Get SOAP notes from DynamoDB with tenant filtering
    """
    try:
        response = dynamodb.get_item(
            TableName='MedoraSOAPNotes',
            Key={
                'patient_id': {'S': patient_id},
                'visit_id': {'S': visit_id}
            }
        )

        item = response.get('Item')
        if not item:
            logger.warning(f"No SOAP notes found for patient {patient_id}, visit {visit_id}")
            return None

        if tenant_id:
            item_tenant_id = item.get('tenantID', {}).get('S')
            if not item_tenant_id or item_tenant_id == tenant_id:
                soap_notes_json = item.get('soap_notes', {}).get('S')
                if soap_notes_json:
                    return json.loads(soap_notes_json)
                else:
                    logger.warning(f"SOAP notes field missing for patient {patient_id}, visit {visit_id}")
                    return None
            else:
                logger.warning(f"Tenant mismatch for patient {patient_id}, visit {visit_id}. Expected: {tenant_id}, Found: {item_tenant_id}")
                return None
        else:
            soap_notes_json = item.get('soap_notes', {}).get('S')
            if soap_notes_json:
                return json.loads(soap_notes_json)
            else:
                logger.warning(f"SOAP notes field missing for patient {patient_id}, visit {visit_id}")
                return None

    except Exception as e:
        logger.error(f"Error fetching SOAP notes from DynamoDB: {str(e)}")
        return None

def get_all_soap_notes_for_tenant(tenant_id):
    """
    Get all SOAP notes for a specific tenant
    """
    try:
        try:
            response = dynamodb.query(
                TableName='MedoraSOAPNotes',
                IndexName='tenantID-patient_id-index',
                KeyConditionExpression='tenantID = :tid',
                ExpressionAttributeValues={
                    ':tid': {'S': tenant_id}
                }
            )
            items = response.get('Items', [])
            logger.info(f"Found {len(items)} SOAP notes for tenant {tenant_id} using GSI")
            return items
        except Exception as e:
            logger.warning(f"GSI query failed, falling back to scan: {str(e)}")

            response = dynamodb.scan(
                TableName='MedoraSOAPNotes',
                FilterExpression='tenantID = :tid',
                ExpressionAttributeValues={
                    ':tid': {'S': tenant_id}
                }
            )
            items = response.get('Items', [])
            logger.info(f"Found {len(items)} SOAP notes for tenant {tenant_id} using scan")
            return items
    except Exception as e:
        logger.error(f"Error fetching SOAP notes for tenant {tenant_id}: {str(e)}")
        return []

def get_patient_insights(patient_id, tenant_id=None):
    """
    Get patient insights from DynamoDB with tenant filtering
    """
    try:
        if tenant_id:
            try:
                response = dynamodb.query(
                    TableName='MedoraPatientInsights',
                    IndexName='tenantID-patient_id-index',
                    KeyConditionExpression='tenantID = :tid AND patient_id = :pid',
                    ExpressionAttributeValues={
                        ':tid': {'S': tenant_id},
                        ':pid': {'S': patient_id}
                    }
                )
                items = response.get('Items', [])
                logger.info(f"Found {len(items)} insights for patient {patient_id} using GSI")
                return items
            except Exception as e:
                logger.warning(f"GSI query failed, falling back to scan: {str(e)}")

                response = dynamodb.scan(
                    TableName='MedoraPatientInsights',
                    FilterExpression='patient_id = :pid AND tenantID = :tid',
                    ExpressionAttributeValues={
                        ':pid': {'S': patient_id},
                        ':tid': {'S': tenant_id}
                    }
                )
                items = response.get('Items', [])
                logger.info(f"Found {len(items)} insights for patient {patient_id} using scan")
                return items
        else:
            response = dynamodb.query(
                TableName='MedoraPatientInsights',
                KeyConditionExpression='patient_id = :pid',
                ExpressionAttributeValues={
                    ':pid': {'S': patient_id}
                }
            )
            items = response.get('Items', [])
            logger.info(f"Found {len(items)} insights for patient {patient_id} without tenant filtering")
            return items
    except Exception as e:
        logger.error(f"Error fetching patient insights: {str(e)}")
        return []

def get_references(tenant_id=None):
    """
    Get references from DynamoDB with tenant filtering
    """
    try:
        if tenant_id:
            try:
                response = dynamodb.query(
                    TableName='MedoraReferences',
                    IndexName='tenantID-index',
                    KeyConditionExpression='tenantID = :tid',
                    ExpressionAttributeValues={
                        ':tid': {'S': tenant_id}
                    }
                )
                items = response.get('Items', [])
                logger.info(f"Found {len(items)} references for tenant {tenant_id} using GSI")
                return items
            except Exception as e:
                logger.warning(f"GSI query failed, falling back to scan: {str(e)}")

                response = dynamodb.scan(
                    TableName='MedoraReferences',
                    FilterExpression='tenantID = :tid',
                    ExpressionAttributeValues={
                        ':tid': {'S': tenant_id}
                    }
                )
                items = response.get('Items', [])
                logger.info(f"Found {len(items)} references for tenant {tenant_id} using scan")
                return items
        else:
            response = dynamodb.scan(TableName='MedoraReferences')
            items = response.get('Items', [])
            logger.info(f"Found {len(items)} references without tenant filtering")
            return items
    except Exception as e:
        logger.error(f"Error fetching references: {str(e)}")
        return []

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
    - enhanced_recommendations: [Provide a comprehensive, evidence-based set of recommendations with the following structure:
      1. Medication Management:
         - Detailed list of medications with specific dosages, frequencies, administration routes
         - Medication interactions and contraindications
         - Step-by-step protocol for adjusting medications based on symptom severity
         - Evidence-based rationale for each medication

      2. Lifestyle Modifications:
         - Specific environmental controls to implement immediately
         - Detailed trigger avoidance strategies personalized to the patient's situation
         - Dietary adjustments if relevant (specific foods to avoid/include)
         - Exercise recommendations or restrictions with clear guidelines
         - Stress management techniques specific to the condition

      3. Monitoring Protocol:
         - Specific parameters the patient should monitor (symptoms, vital signs)
         - Exact frequency and method of monitoring
         - Clear thresholds for contacting healthcare provider
         - Recommended tools or devices for home monitoring
         - Documentation approach (symptom diary, digital tracking)

      4. Emergency Action Plan:
         - Step-by-step guide for managing acute exacerbations or severe symptoms
         - Precise indicators for when to seek emergency care
         - Emergency medication usage instructions with exact dosing
         - Instructions for caregivers or family members

      5. Long-term Management Strategy:
         - Timeline for treatment reassessment (specific dates/intervals)
         - Concrete goals of therapy with measurable outcomes
         - Potential future treatment options based on response
         - Criteria for treatment success or failure
         - Specialized referral recommendations with rationale

      6. Patient Education Resources:
         - Specific educational materials recommended (exact titles, websites, resources)
         - Support groups or community resources with contact information
         - Reliable online resources for further information
         - Mobile applications that may help manage the condition

      7. Follow-up Schedule:
         - Precise timing for follow-up appointments
         - Tests to be completed before next visit
         - Information to bring to follow-up appointments
         - Clear expectations for treatment milestones
    ]

    Transcript: {text}

    Ensure all medical terms are accurate and contextualized for a professional allergist. Include specific details (e.g., medication names with exact dosages, test types). Avoid speculative diagnoses; flag uncertainty for human review. For the enhanced_recommendations section, be exceptionally thorough and specific, providing detailed actionable insights based on current clinical guidelines and evidence-based best practices. Include precise timelines and measurable outcomes where appropriate.

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
        "summary": "string",
        "enhanced_recommendations": "string"
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
        "max_tokens": 2500,
        "temperature": 0.25
    }

    try:
        logger.debug(f"Sending request to xAI API: URL={XAI_API_URL}, Headers={headers}, Payload={payload}")
        response = requests.post(XAI_API_URL, headers=headers, json=payload, timeout=45)
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

                    if "enhanced_recommendations" in parsed_data:
                        enhanced_recs = parsed_data["enhanced_recommendations"]
                        if "patient_education" in parsed_data:
                            parsed_data["recommendations"] = enhanced_recs

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

# New helper functions for AllergenIQ profile
def get_default_symptom_data():
    """Return default symptom data for AllergenIQ profile"""
    return [
        {"name": "Sneezing", "severity": 7, "frequency": "Daily"},
        {"name": "Itchy Eyes", "severity": 5, "frequency": "Daily"},
        {"name": "Nasal Congestion", "severity": 6, "frequency": "Daily"},
        {"name": "Wheezing", "severity": 4, "frequency": "Occasional"},
        {"name": "Skin Rash", "severity": 3, "frequency": "Occasional"}
    ]

def get_default_medication_history():
    """Return default medication history for AllergenIQ profile"""
    return [
        {"name": "Cetirizine", "dosage": "10 mg daily", "status": "Active"},
        {"name": "Fluticasone", "dosage": "50 mcg per nostril daily", "status": "Active"},
        {"name": "Albuterol", "dosage": "2 puffs as needed", "status": "Active"},
        {"name": "Epinephrine", "dosage": "0.3 mg as needed", "status": "PRN"},
        {"name": "Prednisone", "dosage": "20 mg daily", "status": "Discontinued"}
    ]

def get_default_allergen_data():
    """Return default allergen data for AllergenIQ profile"""
    return [
        {"name": "Pollen", "reaction": "Sneezing, Itchy Eyes"},
        {"name": "Dust Mites", "reaction": "Nasal Congestion"},
        {"name": "Pet Dander", "reaction": "Wheezing"},
        {"name": "Peanuts", "reaction": "Anaphylaxis"},
        {"name": "Mold", "reaction": "Skin Rash"}
    ]

def get_default_summary():
    """Return default summary for AllergenIQ profile"""
    return {
        "primaryDiagnosis": "Seasonal allergic rhinitis with asthma exacerbation.",
        "alternativeDiagnoses": [
            "Atopic dermatitis secondary to allergen exposure.",
            "Food allergy with risk of anaphylaxis."
        ]
    }

def process_transcript_for_allergeniq(transcript):
    """
    Process the transcript to extract allergy-related data for AllergenIQ profile.
    Returns a dictionary with symptoms, medications, and allergens.
    """
    logger.info("ALLERGENIQ: Processing transcript for allergy data")
    try:
        transcript_lower = transcript.lower()
        lines = transcript.split('\n')

        symptoms_dict = {}
        medications_dict = {}
        allergens_dict = {}

        symptom_keywords = ['sneezing', 'itchy eyes', 'nasal congestion', 'wheezing', 'skin rash', 'snoring', 'loss of smell', 'asthma', 'sore throat', 'ear itching']
        medication_keywords = ['dupixent', 'symbicort', 'flonase', 'allegra', 'albuterol', 'montelukast', 'xolair', 'nucala', 'epipen', 'prednisone']
        allergen_keywords = ['codeine', 'grass', 'wasp', 'garlic', 'onion', 'pollen', 'dust mites', 'pet dander', 'peanuts', 'mold']

        recent_prednisone = False
        stopped_medications = set()

        for line in lines:
            line_lower = line.lower()
            for symptom in symptom_keywords:
                if symptom in line_lower:
                    symptom_key = symptom.lower()
                    if symptom_key in symptoms_dict:
                        continue
                    severity = 5
                    frequency = "Unknown"
                    if 'severe' in line_lower or 'bad' in line_lower:
                        severity = 8
                    elif 'mild' in line_lower:
                        severity = 3
                    elif 'constant' in line_lower and 'loss of smell' in symptom_key:
                        severity = 9
                    elif 'asthma' in symptom_key:
                        severity = 7
                    elif 'itchy eyes' in symptom_key:
                        severity = 6
                    elif 'snoring' in symptom_key:
                        severity = 7
                    elif 'nasal congestion' in symptom_key:
                        severity = 8
                    if 'daily' in line_lower:
                        frequency = "Daily"
                    elif 'constant' in line_lower:
                        frequency = "Constant"
                    elif 'occasional' in line_lower:
                        frequency = "Occasional"
                    elif 'nightly' in line_lower and 'snoring' in symptom_key:
                        frequency = "Nightly"
                    symptoms_dict[symptom_key] = {
                        "name": symptom.capitalize(),
                        "severity": severity,
                        "frequency": frequency
                    }
                    logger.debug(f"ALLERGENIQ: Extracted symptom - {symptom.capitalize()}: severity={severity}, frequency={frequency}")

            for med in medication_keywords:
                if med in line_lower:
                    med_key = med.lower() + "_" + line_lower
                    if med_key in medications_dict:
                        continue
                    status = "Active"
                    dosage = "Unknown"
                    if 'stop' in line_lower or 'discontinued' in line_lower:
                        status = "Discontinued"
                        stopped_medications.add(med)
                    elif 'pending' in line_lower or 'prescribed' in line_lower:
                        status = "Pending"
                    dosage_match = re.search(r'(\d+\s*(mg|mcg|puffs)[^\.]*)', line_lower)
                    if dosage_match:
                        dosage = dosage_match.group(0).strip()
                    if med.lower() == 'dupixent':
                        dosage = "300 mg every 2 weeks"
                        status = "Discontinued" if 'discontinued' in line_lower else "Active"
                    elif med.lower() == 'symbicort':
                        dosage = "160/4.5 mcg, 2 inhalations twice daily"
                        status = "Pending" if 'pending' in line_lower else "Discontinued"
                    elif med.lower() == 'flonase':
                        dosage = "50 mcg per nostril daily"
                        status = "Active"
                    elif med.lower() == 'allegra':
                        dosage = "180 mg daily"
                        status = "Active"
                    elif med.lower() == 'albuterol':
                        dosage = "2 puffs as needed"
                        status = "Active"
                    medications_dict[med_key] = {
                        "name": med.capitalize(),
                        "dosage": dosage,
                        "status": status
                    }
                    logger.debug(f"ALLERGENIQ: Extracted medication - {med.capitalize()}: dosage={dosage}, status={status}")

            for allergen in allergen_keywords:
                if allergen in line_lower:
                    allergen_key = allergen.lower()
                    if allergen_key in allergens_dict:
                        continue
                    reaction = "Unknown"
                    if 'allergy' in line_lower:
                        reaction = "Allergic Reaction"
                    if 'intolerance' in line_lower:
                        reaction = "Intolerance (Nausea, Heartburn)"
                    if 'anaphylaxis' in line_lower:
                        reaction = "Anaphylaxis"
                    if 'cellulitis' in line_lower:
                        reaction = "Cellulitis"
                    if 'rhinitis' in line_lower:
                        reaction = "Allergic Rhinitis"
                    allergens_dict[allergen_key] = {
                        "name": allergen.capitalize(),
                        "reaction": reaction
                    }
                    logger.debug(f"ALLERGENIQ: Extracted allergen - {allergen.capitalize()}: reaction={reaction}")

            if 'prednisone' in line_lower and '5 days ago' in line_lower:
                recent_prednisone = True

        symptoms = list(symptoms_dict.values())
        final_medications = {}
        for med_key, med_info in medications_dict.items():
            med_name = med_info["name"].lower()
            if med_name not in final_medications:
                final_medications[med_name] = med_info
            else:
                existing = final_medications[med_name]
                if existing["status"] == "Active" and med_info["status"] in ["Discontinued", "Pending"]:
                    final_medications[med_name] = med_info
        medications = list(final_medications.values())
        allergens = list(allergens_dict.values())

        return {
            "symptoms": symptoms,
            "medications": medications,
            "allergens": allergens
        }
    except Exception as e:
        logger.error(f"ALLERGENIQ: Error in process_transcript_for_allergeniq: {str(e)}")
        return {
            "symptoms": [],
            "medications": [],
            "allergens": []
        }

def structure_allergeniq_data(soap_notes, patient_insights, transcript_data):
    """
    Structure the AllergenIQ profile data using SOAP notes, patient insights, and transcript data.
    """
    logger.info("ALLERGENIQ: Structuring profile data")
    try:
        profile = {
            "symptomData": [],
            "medicationHistory": [],
            "allergenData": [],
            "summary": {
                "primaryDiagnosis": "Not specified",
                "alternativeDiagnoses": []
            }
        }

        if transcript_data and "symptoms" in transcript_data:
            profile["symptomData"] = transcript_data["symptoms"]
        if not profile["symptomData"]:
            review_of_systems = soap_notes.get("patient_history", {}).get("review_of_systems", "")
            if review_of_systems and review_of_systems != "No data available":
                symptoms = []
                for symptom in review_of_systems.split(','):
                    symptom = symptom.strip()
                    if symptom and "no " not in symptom.lower():
                        symptoms.append({
                            "name": symptom.capitalize(),
                            "severity": 5,
                            "frequency": "Unknown"
                        })
                profile["symptomData"] = symptoms
            logger.debug(f"ALLERGENIQ: Extracted symptoms: {profile['symptomData']}")

        medications_from_soap = []
        plan_of_care = soap_notes.get("plan_of_care", "")
        if plan_of_care and plan_of_care != "No data available":
            sections = plan_of_care.split('\n\n')
            allowed_medications = ['dupixent', 'symbicort', 'flonase', 'allegra', 'albuterol']
            for section in sections:
                if "In regards to" in section:
                    lines = section.split('\n')
                    for line in lines[1:]:
                        line = line.strip()
                        if line.startswith('-'):
                            med_info = line[1:].strip().lower()
                            dosage = "Unknown"
                            status = "Active"
                            medication_keywords = ['dupixent', 'symbicort', 'flonase', 'allegra', 'albuterol', 'montelukast', 'xolair', 'nucala', 'epipen', 'prednisone']
                            name = None
                            for med in medication_keywords:
                                if med in med_info:
                                    if med not in allowed_medications:
                                        continue
                                    name = med.capitalize()
                                    break
                            if not name:
                                continue
                            if 'discontinued' in med_info:
                                status = "Discontinued"
                            elif 'pending' in med_info:
                                status = "Pending"
                            dosage_match = re.search(r'(\d+\s*(mg|mcg|puffs)[^\.]*)', med_info)
                            if dosage_match:
                                dosage = dosage_match.group(0).strip()
                            if name.lower() == 'dupixent':
                                dosage = "300 mg every 2 weeks"
                                status = "Discontinued"
                            elif name.lower() == 'symbicort':
                                dosage = "160/4.5 mcg, 2 inhalations twice daily"
                                status = "Pending"
                            elif name.lower() == 'flonase':
                                dosage = "50 mcg per nostril daily"
                                status = "Active"
                            elif name.lower() == 'allegra':
                                dosage = "180 mg daily"
                                status = "Active"
                            elif name.lower() == 'albuterol':
                                dosage = "2 puffs as needed"
                                status = "Active"
                            medications_from_soap.append({
                                "name": name,
                                "dosage": dosage,
                                "status": status
                            })
        if medications_from_soap:
            profile["medicationHistory"] = medications_from_soap
        elif transcript_data and "medications" in transcript_data:
            profile["medicationHistory"] = transcript_data["medications"]
        logger.debug(f"ALLERGENIQ: Extracted medications: {profile['medicationHistory']}")

        if transcript_data and "allergens" in transcript_data:
            profile["allergenData"] = transcript_data["allergens"]
        if not profile["allergenData"]:
            allergies = soap_notes.get("patient_history", {}).get("allergies", "")
            if allergies and allergies != "No data available":
                allergens = []
                allergy_list = allergies.split(',')
                for allergy in allergy_list:
                    allergy = allergy.strip()
                    if allergy:
                        reaction = "Unknown"
                        if 'intolerance' in allergy.lower():
                            reaction = "Intolerance (Nausea, Heartburn)"
                        elif 'allergy' in allergy.lower():
                            reaction = "Allergic Reaction"
                        elif 'rhinitis' in allergy.lower():
                            reaction = "Allergic Rhinitis"
                        elif 'cellulitis' in allergy.lower():
                            reaction = "Cellulitis"
                        elif 'unspecified' in allergy.lower():
                            reaction = "Unspecified"
                        allergen_name = allergy.split(' ')[0].capitalize()
                        allergens.append({
                            "name": allergen_name,
                            "reaction": reaction
                        })
                profile["allergenData"] = allergens
            logger.debug(f"ALLERGENIQ: Extracted allergens: {profile['allergenData']}")

        differential_diagnosis = soap_notes.get("differential_diagnosis", "")
        if differential_diagnosis and differential_diagnosis != "No data available":
            parts = differential_diagnosis.split("Alternative Diagnoses:")
            primary_diagnosis = parts[0].replace("Primary Diagnosis:", "").strip()
            alternative_diagnoses = []
            if len(parts) > 1:
                alt_diagnoses = parts[1].strip()
                alt_diag_list = re.split(r'\d+\)', alt_diagnoses)
                for diag in alt_diag_list:
                    diag = diag.strip()
                    if diag:
                        diag = diag.rstrip('.,').strip()
                        alternative_diagnoses.append(diag)
            profile["summary"] = {
                "primaryDiagnosis": primary_diagnosis,
                "alternativeDiagnoses": alternative_diagnoses
            }
        logger.debug(f"ALLERGENIQ: Extracted summary: {profile['summary']}")

        return profile
    except Exception as e:
        logger.error(f"ALLERGENIQ: Error in structure_allergeniq_data: {str(e)}")
        return {
            "symptomData": get_default_symptom_data(),
            "medicationHistory": get_default_medication_history(),
            "allergenData": get_default_allergen_data(),
            "summary": get_default_summary()
        }

# IMPROVED VETERINARY FILTERING LOGIC

# Enhanced keyword categorization
VETERINARY_KEYWORDS = {
    'animals': ['dog', 'cat', 'horse', 'cow', 'pig', 'sheep', 'goat', 'rabbit', 'ferret'],
    'animal_types': ['canine', 'feline', 'equine', 'bovine', 'swine', 'rodent', 'avian'],
    'research_animals': ['mouse', 'mice', 'rat', 'rats', 'guinea pig', 'hamster'],
    'wildlife': ['wildlife', 'zoo', 'marine', 'aquatic', 'fish', 'bird', 'reptile'],
    'veterinary_terms': ['veterinary', 'vet', 'animal health', 'pet health', 'livestock']
}

# Human allergy contexts where animal mentions are relevant
HUMAN_ALLERGY_CONTEXTS = {
    'allergen_sources': [
        'allergen', 'allergy', 'allergic', 'sensitization', 'sensitized',
        'dander', 'hair', 'fur', 'saliva', 'urine', 'epithelial',
        'exposure to', 'exposed to', 'contact with'
    ],
    'medical_conditions': [
        'asthma', 'rhinitis', 'dermatitis', 'eczema', 'urticaria', 'hives',
        'anaphylaxis', 'allergic reaction', 'hypersensitivity'
    ],
    'research_terms': [
        'model', 'study', 'research', 'experiment', 'trial', 'investigation',
        'analysis', 'evaluation', 'assessment', 'comparison'
    ],
    'human_subjects': [
        'human', 'patient', 'subject', 'participant', 'individual',
        'people', 'person', 'clinical', 'children', 'adults'
    ]
}

# Terms that strongly indicate veterinary focus (should be excluded)
STRONG_VETERINARY_INDICATORS = [
    'veterinary medicine', 'animal medicine', 'pet therapy', 'animal welfare',
    'companion animal', 'small animal practice', 'large animal',
    'animal nutrition', 'pet food', 'animal diet', 'livestock management',
    'zoo medicine', 'wildlife medicine', 'animal behavior'
]

# Terms that strongly indicate human medical focus
STRONG_HUMAN_INDICATORS = [
    'human allergy', 'patient management', 'clinical practice',
    'human exposure', 'occupational allergy', 'environmental allergy',
    'allergic disease', 'immunotherapy', 'human immunology'
]

def get_enhanced_context_window(text: str, keyword: str, window_size: int = 150) -> str:
    """
    Extract a larger, more meaningful context window around a keyword.
    """
    if not text or not keyword:
        return ""
    
    text_lower = text.lower()
    keyword_lower = keyword.lower()
    
    # Find all occurrences of the keyword
    start_pos = text_lower.find(keyword_lower)
    if start_pos == -1:
        return ""
    
    # Extract context window
    context_start = max(0, start_pos - window_size)
    context_end = min(len(text), start_pos + len(keyword) + window_size)
    
    return text[context_start:context_end].strip()

def analyze_animal_mention_context(text: str, animal_keyword: str) -> Dict[str, any]:
    """
    Analyze the context of an animal mention to determine if it's relevant to human allergies.
    """
    context_window = get_enhanced_context_window(text, animal_keyword, window_size=200)
    context_lower = context_window.lower()
    
    analysis = {
        'context_type': 'unknown',
        'is_human_relevant': False,
        'confidence': 0.0,
        'reasoning': [],
        'context_snippet': context_window[:100] + "..." if len(context_window) > 100 else context_window
    }
    
    # Check for strong human medical indicators
    human_indicators_found = []
    for category, terms in HUMAN_ALLERGY_CONTEXTS.items():
        found_terms = [term for term in terms if term in context_lower]
        if found_terms:
            human_indicators_found.extend([(category, term) for term in found_terms])
    
    # Check for strong veterinary indicators
    vet_indicators_found = [term for term in STRONG_VETERINARY_INDICATORS if term in context_lower]
    
    # Check for strong human indicators
    strong_human_found = [term for term in STRONG_HUMAN_INDICATORS if term in context_lower]
    
    # Scoring logic
    human_score = 0
    vet_score = 0
    
    # Strong indicators carry more weight
    human_score += len(strong_human_found) * 10
    vet_score += len(vet_indicators_found) * 15
    
    # Category-based scoring
    allergen_terms = len([term for cat, term in human_indicators_found if cat == 'allergen_sources'])
    medical_terms = len([term for cat, term in human_indicators_found if cat == 'medical_conditions'])
    research_terms = len([term for cat, term in human_indicators_found if cat == 'research_terms'])
    human_subject_terms = len([term for cat, term in human_indicators_found if cat == 'human_subjects'])
    
    # Allergen context is highly relevant
    if allergen_terms > 0:
        human_score += allergen_terms * 8
        analysis['reasoning'].append(f"Found {allergen_terms} allergen-related terms")
    
    # Medical condition context is very relevant
    if medical_terms > 0:
        human_score += medical_terms * 6
        analysis['reasoning'].append(f"Found {medical_terms} medical condition terms")
    
    # Research context with human subjects is relevant
    if research_terms > 0 and human_subject_terms > 0:
        human_score += (research_terms + human_subject_terms) * 4
        analysis['reasoning'].append(f"Found research context with human subjects")
    elif research_terms > 0:
        human_score += research_terms * 2
        analysis['reasoning'].append(f"Found research context")
    
    # Human subjects mentioned
    if human_subject_terms > 0:
        human_score += human_subject_terms * 5
        analysis['reasoning'].append(f"Found {human_subject_terms} human subject terms")
    
    # Special patterns for allergy research
    allergy_patterns = [
        f"{animal_keyword} allergy", f"{animal_keyword} allergen", 
        f"{animal_keyword} dander", f"{animal_keyword} exposure",
        f"allergic to {animal_keyword}", f"{animal_keyword}-induced"
    ]
    
    pattern_matches = sum(1 for pattern in allergy_patterns if pattern in context_lower)
    if pattern_matches > 0:
        human_score += pattern_matches * 12
        analysis['reasoning'].append(f"Found {pattern_matches} specific allergy patterns")
    
    # Calculate final relevance
    total_score = human_score - vet_score
    analysis['human_score'] = human_score
    analysis['vet_score'] = vet_score
    analysis['total_score'] = total_score
    
    if total_score >= 10:
        analysis['is_human_relevant'] = True
        analysis['confidence'] = min(0.95, 0.5 + (total_score / 50))
        analysis['context_type'] = 'human_allergy_relevant'
    elif total_score >= 5:
        analysis['is_human_relevant'] = True
        analysis['confidence'] = 0.6
        analysis['context_type'] = 'likely_human_relevant'
    elif total_score <= -10:
        analysis['is_human_relevant'] = False
        analysis['confidence'] = 0.9
        analysis['context_type'] = 'veterinary_focused'
    else:
        analysis['is_human_relevant'] = False
        analysis['confidence'] = 0.7
        analysis['context_type'] = 'unclear_context'
    
    return analysis

def should_include_article_for_human_allergies(title: str, abstract: str, source: str = "PubMed") -> Dict[str, any]:
    """
    Determine if an article should be included based on enhanced veterinary filtering.
    """
    decision = {
        'include': True,
        'confidence': 0.8,
        'reasoning': [],
        'veterinary_analysis': {},
        'overall_assessment': 'human_relevant'
    }
    
    # Combine title and abstract for analysis
    full_text = f"{title or ''} {abstract or ''}"
    title_lower = (title or '').lower()
    abstract_lower = (abstract or '').lower()
    
    # Check for obvious veterinary exclusions first
    strong_vet_found = [term for term in STRONG_VETERINARY_INDICATORS if term in full_text.lower()]
    if strong_vet_found:
        decision['include'] = False
        decision['confidence'] = 0.95
        decision['reasoning'].append(f"Contains strong veterinary indicators: {strong_vet_found}")
        decision['overall_assessment'] = 'veterinary_focused'
        return decision
    
    # Check for strong human medical indicators
    strong_human_found = [term for term in STRONG_HUMAN_INDICATORS if term in full_text.lower()]
    if strong_human_found:
        decision['include'] = True
        decision['confidence'] = 0.95
        decision['reasoning'].append(f"Contains strong human medical indicators: {strong_human_found}")
        return decision
    
    # Find all veterinary keywords
    all_vet_keywords = []
    for category, keywords in VETERINARY_KEYWORDS.items():
        all_vet_keywords.extend(keywords)
    
    found_vet_keywords = [kw for kw in all_vet_keywords if kw in full_text.lower()]
    
    if not found_vet_keywords:
        decision['reasoning'].append("No veterinary keywords found")
        return decision
    
    # Analyze each veterinary keyword in context
    human_relevant_count = 0
    total_analyses = 0
    
    for keyword in found_vet_keywords:
        # Analyze in title
        if keyword in title_lower:
            title_analysis = analyze_animal_mention_context(title, keyword)
            decision['veterinary_analysis'][f"{keyword}_title"] = title_analysis
            total_analyses += 1
            if title_analysis['is_human_relevant']:
                human_relevant_count += 2  # Title context weighted more heavily
        
        # Analyze in abstract
        if keyword in abstract_lower:
            abstract_analysis = analyze_animal_mention_context(abstract, keyword)
            decision['veterinary_analysis'][f"{keyword}_abstract"] = abstract_analysis
            total_analyses += 1
            if abstract_analysis['is_human_relevant']:
                human_relevant_count += 1
    
    # Make inclusion decision based on analysis
    if total_analyses == 0:
        decision['reasoning'].append("No veterinary keywords found in context analysis")
    elif human_relevant_count == 0:
        decision['include'] = False
        decision['confidence'] = 0.85
        decision['reasoning'].append("All veterinary keyword mentions appear to be non-human relevant")
        decision['overall_assessment'] = 'likely_veterinary'
    elif human_relevant_count >= total_analyses * 0.7:
        decision['include'] = True
        decision['confidence'] = 0.9
        decision['reasoning'].append(f"Most veterinary mentions ({human_relevant_count}/{total_analyses}) are human-allergy relevant")
    else:
        decision['include'] = True
        decision['confidence'] = 0.6
        decision['reasoning'].append(f"Mixed context: {human_relevant_count}/{total_analyses} mentions are human-relevant")
        decision['overall_assessment'] = 'mixed_context'
    
    return decision

def simplify_diagnosis(diagnosis):
    """
    Simplify diagnosis strings by removing extraneous text like uncertainty statements.
    """
    try:
        for marker in ["Uncertainty", "uncertainty", "Further review", "further review"]:
            if marker in diagnosis:
                diagnosis = diagnosis.split(marker)[0].strip()
        diagnosis = diagnosis.rstrip('.,;').strip()
        return diagnosis
    except Exception as e:
        logger.error(f"Error simplifying diagnosis '{diagnosis}': {str(e)}")
        return diagnosis

def simplify_search_term(condition):
    """
    Simplify overly specific diagnosis terms for broader search results.
    Returns a list of terms to try, starting with the original, then a simplified version.
    """
    terms = [condition]
    # Remove qualifiers like "likely due to" and specific drugs, but prioritize a single simplified term
    simplified = condition.lower()
    qualifiers = ["likely due to", "due to", "caused by", "though less likely given the temporal relationship with meloxicam use"]
    for qualifier in qualifiers:
        if qualifier in simplified:
            base_term = simplified.split(qualifier)[0].strip()
            terms.append(base_term)
            break
    return terms[:2]  # Limit to 2 terms to reduce API calls

def query_semantic_scholar(condition, retmax=2, timeout=3, rate_limit_hit=None):
    """
    Query Semantic Scholar for articles related to the given condition, focusing on human allergies.
    Returns a list of insights with title, summary, URL, and relevance info.
    """
    try:
        api_url = "https://api.semanticscholar.org/graph/v1/paper/search"
        
        # Use simplified search without veterinary exclusions to let our improved filtering handle it
        query = f"{condition}"
        params = {
            "query": query,
            "limit": retmax,
            "fields": "title,abstract,url,year,authors,venue,citationCount"
        }
        logger.debug(f"Semantic Scholar query for '{condition}': {query}")
        
        headers = {}
        
        max_retries = 1
        retry_delay = 5
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    wait_time = retry_delay
                    logger.warning(f"Rate limit hit on Semantic Scholar API for condition '{condition}'. Retrying after {wait_time} seconds (Attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                logger.debug(f"Sending Semantic Scholar request for condition '{condition}' with params: {params} (Attempt {attempt + 1}/{max_retries})")
                response = requests.get(api_url, params=params, headers=headers, timeout=timeout)
                response.raise_for_status()
                try:
                    results = response.json()
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse Semantic Scholar JSON response for condition {condition}: {str(e)}")
                    return []
                break
            except HTTPError as e:
                if e.response.status_code == 429:
                    if attempt == max_retries - 1:
                        logger.error(f"Error querying Semantic Scholar for condition {condition}: {str(e)}")
                        if rate_limit_hit is not None:
                            rate_limit_hit['semantic_scholar'] = True
                        return []
                    continue
                else:
                    logger.error(f"Error querying Semantic Scholar for condition {condition}: {str(e)}")
                    return []
            except requests.exceptions.Timeout:
                logger.error(f"Timeout querying Semantic Scholar for condition {condition} after {timeout} seconds")
                return []
            except Exception as e:
                logger.error(f"Unexpected error querying Semantic Scholar for condition {condition}: {str(e)}")
                return []
        else:
            logger.error(f"Failed to query Semantic Scholar for condition {condition} after {max_retries} attempts due to rate limiting")
            if rate_limit_hit is not None:
                rate_limit_hit['semantic_scholar'] = True
            return []
        
        insights = []
        
        if "data" in results:
            for paper in results["data"]:
                try:
                    title_text = paper.get("title", "N/A")
                    abstract_text = paper.get("abstract", "N/A")
                    url = paper.get("url", "#")
                    year = paper.get("year", "N/A")
                    logger.debug(f"Semantic Scholar article title: {title_text}")
                    logger.debug(f"Semantic Scholar article abstract: {abstract_text}")
                    
                    # Apply improved filtering
                    inclusion_decision = should_include_article_for_human_allergies(
                        title_text, abstract_text, source="Semantic Scholar"
                    )
                    
                    if not inclusion_decision['include']:
                        safe_title = str(title_text).replace('\n', ' ').replace('\r', ' ')
                        logger.info(f"Excluding Semantic Scholar article '{safe_title}': {'; '.join(inclusion_decision['reasoning'])}")
                        continue
                    
                    safe_title = str(title_text).replace('\n', ' ').replace('\r', ' ')
                    logger.info(f"Including Semantic Scholar article '{safe_title}' (confidence: {inclusion_decision['confidence']:.2f}): {'; '.join(inclusion_decision['reasoning'])}")
                    
                    authors = []
                    if "authors" in paper:
                        authors = [author.get("name", "") for author in paper["authors"]]
                    authors_text = ", ".join(authors) if authors else "N/A"
                    logger.debug(f"Semantic Scholar article authors: {authors_text}")
                    
                    citation_count = paper.get("citationCount", 0)
                    logger.debug(f"Semantic Scholar citation count: {citation_count}")
                    
                    relevance_score = 0.0
                    condition_words = condition.lower().split()
                    logger.debug(f"Condition words for matching: {condition_words}")

                    # Enhanced relevance scoring with keyword matching
                    title_lower = title_text.lower() if title_text else ""
                    abstract_lower = abstract_text.lower() if abstract_text else ""
                    
                    title_matches = sum(1 for word in condition_words if word in title_lower)
                    if title_matches > 0:
                        title_weight = (title_matches / len(condition_words)) * 0.5
                        relevance_score += title_weight
                        logger.debug(f"Semantic Scholar title partial matches for '{condition}': {title_matches}/{len(condition_words)}. Added {title_weight:.2f} to relevance score")
                    else:
                        logger.debug(f"No title partial matches for '{condition}' in '{title_lower}'")
                        relevance_score -= 10.0  # Penalize if no title match

                    abstract_matches = sum(1 for word in condition_words if word in abstract_lower)
                    if abstract_matches > 0:
                        abstract_weight = (abstract_matches / len(condition_words)) * 0.3
                        relevance_score += abstract_weight
                        logger.debug(f"Semantic Scholar abstract partial matches for '{condition}': {abstract_matches}/{len(condition_words)}. Added {abstract_weight:.2f} to relevance score")
                    else:
                        logger.debug(f"No abstract partial matches for '{condition}' in '{abstract_lower}'")
                        relevance_score -= 5.0  # Penalize if no abstract match

                    citation_weight = min(citation_count / 200, 0.3)
                    relevance_score += citation_weight
                    logger.debug(f"Semantic Scholar citation weight for '{condition}' (citation_count={citation_count}): Added {citation_weight} to relevance score")

                    # Boost relevance for high-confidence human allergy articles
                    if inclusion_decision['confidence'] > 0.8:
                        relevance_score += 0.1
                        logger.debug(f"High-confidence human allergy article, boosting relevance score")

                    if relevance_score <= 0.0:
                        relevance_score = 5.0
                        logger.debug(f"Low relevance match, assigning minimum relevance score of 5.0")

                    relevance_score = min(relevance_score * 100, 100)
                    logger.debug(f"Semantic Scholar final relevance score for '{condition}': {relevance_score}")

                    confidence = "Recommended"
                    if relevance_score > 70:
                        confidence = "Highly Recommended"
                    elif relevance_score > 40:
                        confidence = "Recommended"
                    else:
                        confidence = "Relevant"
                    logger.debug(f"Semantic Scholar confidence for '{condition}': {confidence}")
                    
                    relevance_tag = f"Relevant to {condition.lower()}"
                    logger.debug(f"Semantic Scholar relevance tag: {relevance_tag}")

                    insight = {
                        "title": title_text,
                        "summary": abstract_text,
                        "url": url,
                        "authors": authors_text,
                        "year": year,
                        "citation_count": citation_count,
                        "source": "Semantic Scholar",
                        "confidence": confidence,
                        "relevance_score": f"{relevance_score:.1f}%",
                        "relevance_tag": relevance_tag,
                        "raw_relevance_score": relevance_score,
                        "inclusion_confidence": inclusion_decision['confidence']
                    }
                    insights.append(insight)
                    logger.debug(f"Semantic Scholar insight for condition '{condition}': {insight}")
                except Exception as e:
                    logger.error(f"Error processing Semantic Scholar article for condition {condition}: {str(e)}")
                    continue
        
        logger.info(f"Fetched {len(insights)} insights from Semantic Scholar for condition: {condition}")
        return insights
        
    except Exception as e:
        logger.error(f"Error querying Semantic Scholar for condition {condition}: {str(e)}")
        return []

def query_pubmed(condition, retmax=2, timeout=3, rate_limit_hit=None, max_attempts=2, max_rate_limit_hits=2, skip_guidelines=False):
    """
    Query PubMed for articles related to the given condition, focusing on human allergies.
    Returns a list of insights with title, summary, PubMed ID, URL, confidence, relevance score, and relevance tag.
    """
    # Check rate limit hits for this specific diagnosis
    diagnosis_key = f"pubmed_hits_{condition}"
    rate_limit_hits = rate_limit_hit.get(diagnosis_key, 0)
    if rate_limit_hits >= max_rate_limit_hits:
        logger.warning(f"Circuit breaker triggered: Skipping PubMed query for condition '{condition}' due to excessive rate limit hits ({rate_limit_hits}/{max_rate_limit_hits})")
        rate_limit_hit[diagnosis_key] = rate_limit_hits
        return []

    search_terms = simplify_search_term(condition)
    insights = []
    for search_term in search_terms:
        logger.debug(f"Attempting PubMed query with term: '{search_term}'")
        attempt_count = 0
        while attempt_count < max_attempts:
            try:
                search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
                # Use simplified search without veterinary exclusions to let our improved filtering handle it
                search_params = {
                    "db": "pubmed",
                    "term": search_term,
                    "retmax": retmax,
                    "sort": "relevance",
                    "retmode": "json"
                }
                logger.debug(f"PubMed search term: '{search_term}'")
                max_retries = 1  # Reduced to 1 retry to minimize rate limit hits
                retry_delay = 10  # Reduced retry delay
                for attempt in range(max_retries):
                    try:
                        if attempt > 0:
                            wait_time = retry_delay
                            logger.warning(f"Rate limit hit on PubMed API for condition '{search_term}'. Retrying after {wait_time} seconds (Attempt {attempt + 1}/{max_retries})")
                            time.sleep(wait_time)
                        logger.debug(f"Sending PubMed search request for condition '{search_term}' with params: {search_params} (Attempt {attempt + 1}/{max_retries})")
                        search_response = requests.get(search_url, params=search_params, timeout=timeout)
                        search_response.raise_for_status()
                        search_data = search_response.json()
                        break
                    except HTTPError as e:
                        if e.response.status_code == 429:
                            rate_limit_hits += 1
                            rate_limit_hit[diagnosis_key] = rate_limit_hits
                            if rate_limit_hits >= max_rate_limit_hits:
                                logger.warning(f"Circuit breaker triggered: Skipping PubMed query for condition '{condition}' due to excessive rate limit hits ({rate_limit_hits}/{max_rate_limit_hits})")
                                rate_limit_hit['skip_guidelines'] = True  # Skip clinical guidelines for this diagnosis
                                return []
                            if attempt == max_retries - 1:
                                logger.error(f"Error querying PubMed for condition {search_term}: {str(e)}")
                                return []  # Skip retries to save time
                            continue
                        else:
                            logger.error(f"Error querying PubMed for condition {search_term}: {str(e)}")
                            return []
                    except requests.exceptions.Timeout:
                        logger.error(f"Timeout querying PubMed for condition {search_term} after {timeout} seconds")
                        return []
                    except Exception as e:
                        logger.error(f"Unexpected error querying PubMed for condition {search_term}: {str(e)}")
                        return []
                else:
                    logger.error(f"Failed to query PubMed for condition {search_term} after {max_retries} retries due to rate limiting")
                    return []

                id_list = search_data.get("esearchresult", {}).get("idlist", [])
                logger.debug(f"PubMed returned article IDs for condition '{search_term}': {id_list}")

                if not id_list:
                    logger.warning(f"No PubMed articles found for condition: {search_term}")
                    continue  # Try the next search term

                fetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
                fetch_params = {
                    "db": "pubmed",
                    "id": ",".join(id_list),
                    "retmode": "xml"
                }
                try:
                    fetch_response = requests.get(fetch_url, params=fetch_params, timeout=timeout)
                    fetch_response.raise_for_status()
                except Exception as e:
                    logger.error(f"Failed to fetch PubMed articles for condition {search_term}: {str(e)}")
                    return []

                try:
                    root = ET.fromstring(fetch_response.content)
                except ET.ParseError as e:
                    logger.error(f"Failed to parse PubMed XML response for condition {search_term}: {str(e)}")
                    return []
                insights = []

                for article in root.findall(".//PubmedArticle"):
                    try:
                        title = article.find(".//ArticleTitle")
                        title_text = title.text if title is not None else "N/A"
                        logger.debug(f"PubMed article title: {title_text}")

                        abstract = article.find(".//Abstract/AbstractText")
                        abstract_text = abstract.text if abstract is not None else "N/A"
                        logger.debug(f"PubMed article abstract: {abstract_text}")

                        # Apply improved filtering
                        inclusion_decision = should_include_article_for_human_allergies(
                            title_text, abstract_text, source="PubMed"
                        )
                        
                        if not inclusion_decision['include']:
                            safe_title = str(title_text).replace('\n', ' ').replace('\r', ' ')
                            logger.info(f"Excluding PubMed article '{safe_title}': {'; '.join(inclusion_decision['reasoning'])}")
                            continue
                        
                        # Log inclusion with reasoning
                        safe_title = str(title_text).replace('\n', ' ').replace('\r', ' ')
                        logger.info(f"Including PubMed article '{safe_title}' (confidence: {inclusion_decision['confidence']:.2f}): {'; '.join(inclusion_decision['reasoning'])}")
                        
                        pubmed_id = article.find(".//PMID")
                        pubmed_id_text = pubmed_id.text if pubmed_id is not None else "N/A"

                        url = f"https://pubmed.ncbi.nlm.nih.gov/{pubmed_id_text}/"

                        authors = []
                        author_list = article.findall(".//AuthorList/Author")
                        for author in author_list:
                            last_name = author.find("LastName")
                            fore_name = author.find("ForeName")
                            if last_name is not None and last_name.text:
                                if fore_name is not None and fore_name.text:
                                    authors.append(f"{fore_name.text} {last_name.text}")
                                else:
                                    authors.append(last_name.text)
                        authors_text = ", ".join(authors) if authors else "N/A"
                        logger.debug(f"PubMed article authors: {authors_text}")

                        pub_date = article.find(".//PubDate/Year")
                        year = pub_date.text if pub_date is not None else "N/A"
                        logger.debug(f"PubMed article year: {year}")

                        relevance_score = 0.0
                        condition_words = condition.lower().split()
                        logger.debug(f"Condition words for matching: {condition_words}")

                        # Enhanced relevance scoring with keyword matching
                        title_lower = title_text.lower() if title_text else ""
                        abstract_lower = abstract_text.lower() if abstract_text else ""
                        
                        title_matches = sum(1 for word in condition_words if word in title_lower)
                        if title_matches > 0:
                            title_weight = (title_matches / len(condition_words)) * 0.5
                            relevance_score += title_weight
                            logger.debug(f"PubMed title partial matches for '{condition}': {title_matches}/{len(condition_words)}. Added {title_weight:.2f} to relevance score")
                        else:
                            logger.debug(f"No title partial matches for '{condition}' in '{title_lower}'")
                            relevance_score -= 10.0  # Penalize if no title match

                        abstract_matches = sum(1 for word in condition_words if word in abstract_lower)
                        if abstract_matches > 0:
                            abstract_weight = (abstract_matches / len(condition_words)) * 0.3
                            relevance_score += abstract_weight
                            logger.debug(f"PubMed abstract partial matches for '{condition}': {abstract_matches}/{len(condition_words)}. Added {abstract_weight:.2f} to relevance score")
                        else:
                            logger.debug(f"No abstract partial matches for '{condition}' in '{abstract_lower}'")
                            relevance_score -= 5.0  # Penalize if no abstract match

                        # Boost relevance for high-confidence human allergy articles
                        if inclusion_decision['confidence'] > 0.8:
                            relevance_score += 0.1
                            logger.debug(f"High-confidence human allergy article, boosting relevance score")

                        if relevance_score <= 0.0:
                            relevance_score = 5.0
                            logger.debug(f"Low relevance match, assigning minimum relevance score of 5.0")

                        relevance_score = min(relevance_score * 100, 100)
                        logger.debug(f"PubMed final relevance score for '{condition}': {relevance_score}")

                        confidence = "Recommended"
                        if relevance_score > 70:
                            confidence = "Highly Recommended"
                        elif relevance_score > 40:
                            confidence = "Recommended"
                        else:
                            confidence = "Relevant"
                        logger.debug(f"PubMed confidence for '{condition}': {confidence}")

                        relevance_tag = f"Relevant to {condition.lower()}"
                        logger.debug(f"PubMed relevance tag: {relevance_tag}")

                        insight = {
                            "title": title_text,
                            "summary": abstract_text,
                            "pubmed_id": pubmed_id_text,
                            "url": url,
                            "confidence": confidence,
                            "relevance_score": f"{relevance_score:.1f}%",
                            "relevance_tag": relevance_tag,
                            "source": "PubMed",
                            "authors": authors_text,
                            "year": year,
                            "raw_relevance_score": relevance_score,
                            "inclusion_confidence": inclusion_decision['confidence']
                        }
                        insights.append(insight)
                        logger.debug(f"PubMed insight for condition '{condition}': {insight}")
                    except Exception as e:
                        logger.error(f"Error processing PubMed article for condition {condition}: {str(e)}")
                        continue

                logger.info(f"Fetched {len(insights)} insights from PubMed for condition: {condition} with search term '{search_term}'")
                if insights:  # If we found insights, stop trying additional search terms
                    return insights

            except Exception as e:
                logger.error(f"Error querying PubMed for condition {condition} after {max_attempts} attempts: {str(e)}")
                return []

        logger.warning(f"No PubMed articles found for condition '{condition}' after trying all search terms: {search_terms}")
        return insights

def query_clinical_guidelines(condition, retmax=1, timeout=3, rate_limit_hit=None, max_attempts=2, max_rate_limit_hits=2, skip_guidelines=False):
    """
    Query for clinical guidelines related to the given condition, focusing on human allergies.
    Returns a list of guidelines with title, source, URL, and relevance info.
    """
    if skip_guidelines or (rate_limit_hit and rate_limit_hit.get('skip_guidelines')):
        logger.warning(f"Skipping clinical guidelines query for condition '{condition}' due to previous PubMed rate limit hit")
        return []

    # Check rate limit hits for this specific diagnosis
    diagnosis_key = f"pubmed_hits_{condition}"
    rate_limit_hits = rate_limit_hit.get(diagnosis_key, 0)
    if rate_limit_hits >= max_rate_limit_hits:
        logger.warning(f"Circuit breaker triggered: Skipping clinical guidelines query for condition '{condition}' due to excessive rate limit hits ({rate_limit_hits}/{max_rate_limit_hits})")
        rate_limit_hit[diagnosis_key] = rate_limit_hits
        return []

    search_terms = simplify_search_term(condition)
    guidelines = []
    for search_term in search_terms:
        logger.debug(f"Attempting clinical guidelines query with term: '{search_term}'")
        attempt_count = 0
        while attempt_count < max_attempts:
            try:
                search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
                # Use simplified search without veterinary exclusions
                term_with_guidelines = f"{search_term} (clinical practice guideline OR consensus statement)"
                search_params = {
                    "db": "pubmed",
                    "term": term_with_guidelines,
                    "retmax": retmax,
                    "sort": "relevance",
                    "retmode": "json"
                }
                logger.debug(f"Clinical guidelines search term: '{term_with_guidelines}'")
                
                max_retries = 1  # Reduced to 1 retry to minimize rate limit hits
                retry_delay = 10  # Reduced retry delay
                for attempt in range(max_retries):
                    try:
                        if attempt > 0:
                            wait_time = retry_delay
                            logger.warning(f"Rate limit hit on PubMed API (guidelines) for condition '{search_term}'. Retrying after {wait_time} seconds (Attempt {attempt + 1}/{max_retries})")
                            time.sleep(wait_time)
                        logger.debug(f"Sending guideline search request for condition '{search_term}' with params: {search_params} (Attempt {attempt + 1}/{max_retries})")
                        search_response = requests.get(search_url, params=search_params, timeout=timeout)
                        search_response.raise_for_status()
                        search_data = search_response.json()
                        break
                    except HTTPError as e:
                        if e.response.status_code == 429:
                            rate_limit_hits += 1
                            rate_limit_hit[diagnosis_key] = rate_limit_hits
                            if rate_limit_hits >= max_rate_limit_hits:
                                logger.warning(f"Circuit breaker triggered: Skipping clinical guidelines query for condition '{condition}' due to excessive rate limit hits ({rate_limit_hits}/{max_rate_limit_hits})")
                                rate_limit_hit['skip_guidelines'] = True  # Skip future guideline queries for this diagnosis
                                return []
                            if attempt == max_retries - 1:
                                logger.error(f"Error querying clinical guidelines for condition {search_term}: {str(e)}")
                                return []  # Skip retries to save time
                            continue
                        else:
                            logger.error(f"Error querying clinical guidelines for condition {search_term}: {str(e)}")
                            return []
                    except requests.exceptions.Timeout:
                        logger.error(f"Timeout querying clinical guidelines for condition {search_term} after {timeout} seconds")
                        return []
                    except Exception as e:
                        logger.error(f"Unexpected error querying clinical guidelines for condition {search_term}: {str(e)}")
                        return []
                else:
                    logger.error(f"Failed to query clinical guidelines for condition {search_term} after {max_retries} retries due to rate limiting")
                    return []

                id_list = search_data.get("esearchresult", {}).get("idlist", [])
                logger.debug(f"Clinical guideline search returned article IDs for condition '{search_term}': {id_list}")

                if not id_list:
                    logger.warning(f"No clinical guidelines found for condition: {search_term}")
                    continue  # Try the next search term

                fetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
                fetch_params = {
                    "db": "pubmed",
                    "id": ",".join(id_list),
                    "retmode": "xml"
                }
                try:
                    fetch_response = requests.get(fetch_url, params=fetch_params, timeout=timeout)
                    fetch_response.raise_for_status()
                except Exception as e:
                    logger.error(f"Failed to fetch clinical guidelines for condition {search_term}: {str(e)}")
                    return []

                try:
                    root = ET.fromstring(fetch_response.content)
                except ET.ParseError as e:
                    logger.error(f"Failed to parse PubMed XML response for guidelines on condition {search_term}: {str(e)}")
                    return []
                guidelines = []

                for article in root.findall(".//PubmedArticle"):
                    try:
                        title = article.find(".//ArticleTitle")
                        title_text = title.text if title is not None else "N/A"
                        
                        abstract = article.find(".//Abstract/AbstractText")
                        abstract_text = abstract.text if abstract is not None else "N/A"
                        
                        # Apply improved filtering - guidelines have a more lenient standard
                        inclusion_decision = should_include_article_for_human_allergies(
                            title_text, abstract_text, source="Clinical Guideline"
                        )
                        
                        # For guidelines, we're more permissive if they mention animals in the context of allergens
                        if not inclusion_decision['include'] and inclusion_decision['overall_assessment'] != 'veterinary_focused':
                            # Check if this might be a guideline about human allergies that mentions animal allergens
                            title_lower = title_text.lower() if title_text else ""
                            abstract_lower = abstract_text.lower() if abstract_text else ""
                            
                            # Look for human allergy indicators in guidelines
                            human_allergy_terms = ['allergy', 'allergic', 'rhinitis', 'asthma', 'dermatitis', 'immunotherapy']
                            guideline_terms = ['guideline', 'consensus', 'practice parameter', 'recommendation']
                            
                            has_human_allergy = any(term in title_lower or term in abstract_lower for term in human_allergy_terms)
                            is_guideline = any(term in title_lower or term in abstract_lower for term in guideline_terms)
                            
                            if has_human_allergy and is_guideline:
                                inclusion_decision['include'] = True
                                inclusion_decision['reasoning'].append("Clinical guideline about human allergies")
                                logger.info(f"Including clinical guideline with human allergy focus: '{title_text}'")
                        
                        if not inclusion_decision['include']:
                            safe_title = str(title_text).replace('\n', ' ').replace('\r', ' ')
                            logger.info(f"Excluding clinical guideline '{safe_title}': {'; '.join(inclusion_decision['reasoning'])}")
                            continue
                        
                        pubmed_id = article.find(".//PMID")
                        pubmed_id_text = pubmed_id.text if pubmed_id is not None else "N/A"
                        
                        url = f"https://pubmed.ncbi.nlm.nih.gov/{pubmed_id_text}/"
                        
                        authors = []
                        author_list = article.findall(".//AuthorList/Author")
                        for author in author_list:
                            last_name = author.find("LastName")
                            fore_name = author.find("ForeName")
                            if last_name is not None and last_name.text:
                                if fore_name is not None and fore_name.text:
                                    authors.append(f"{fore_name.text} {last_name.text}")
                                else:
                                    authors.append(last_name.text)
                        
                        journal_name = article.find(".//Journal/Title")
                        organization = journal_name.text if journal_name is not None else "Medical Journal"
                        
                        pub_date = article.find(".//PubDate/Year")
                        year = pub_date.text if pub_date is not None else "N/A"
                        
                        is_guideline = False
                        guideline_terms = ["guideline", "consensus", "practice parameter", "recommendation", "position statement"]
                        
                        title_lower = title_text.lower() if title_text else ""
                        abstract_lower = abstract_text.lower() if abstract_text else ""
                        
                        for term in guideline_terms:
                            if term in title_lower:
                                is_guideline = True
                                break
                        
                        if not is_guideline:
                            for term in guideline_terms:
                                if term in abstract_lower:
                                    is_guideline = True
                                    break
                        
                        if is_guideline:
                            summary = abstract_text[:500] + "..." if len(abstract_text) > 500 else abstract_text
                            
                            # Enhanced relevance scoring for guidelines
                            relevance_score = 95.0  # Base score for guidelines
                            condition_words = condition.lower().split()
                            title_matches = sum(1 for word in condition_words if word in title_lower)
                            if title_matches == 0:
                                relevance_score -= 20.0  # Penalize if title doesn't match diagnosis
                                logger.debug(f"Guideline title '{title_text}' does not match condition '{condition}', reducing relevance score by 20")
                            abstract_matches = sum(1 for word in condition_words if word in abstract_lower)
                            if abstract_matches == 0:
                                relevance_score -= 10.0  # Penalize if abstract doesn't match diagnosis
                                logger.debug(f"Guideline abstract for '{title_text}' does not match condition '{condition}', reducing relevance score by 10")

                            guideline = {
                                "title": title_text,
                                "summary": summary,
                                "url": url,
                                "source": organization,
                                "authors": ", ".join(authors) if authors else "N/A",
                                "year": year,
                                "content_type": "Clinical Guideline",
                                "relevance_tag": f"Clinical Practice Guideline for {condition}",
                                "confidence": "Highly Recommended" if relevance_score > 70 else "Recommended",
                                "relevance_score": f"{relevance_score:.1f}%",
                                "raw_relevance_score": relevance_score,
                                "inclusion_confidence": inclusion_decision['confidence']
                            }
                            
                            guidelines.append(guideline)
                            logger.debug(f"Found clinical guideline for '{condition}': {title_text}")
                    except Exception as e:
                        logger.error(f"Error processing clinical guideline article for condition {condition}: {str(e)}")
                        continue
                
                logger.info(f"Fetched {len(guidelines)} clinical guidelines for condition: {condition} with search term '{search_term}'")
                if guidelines:  # If we found guidelines, stop trying additional search terms
                    return guidelines
            
            except Exception as e:
                logger.error(f"Error querying clinical guidelines for condition {condition} after {max_attempts} attempts: {str(e)}")
                return []

        logger.warning(f"No clinical guidelines found for condition '{condition}' after trying all search terms: {search_terms}")
        return guidelines

# [Rest of your existing Flask routes and functions remain unchanged]

@app.route('/api/transcribe-audio', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({"success": False, "error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    email = request.form.get('email')
    tenant_id = request.form.get('tenantId', 'default_tenant')
    tenant_id = validate_tenant_id(tenant_id, email)

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
        email = data.get('email')
        tenant_id = data.get('tenantId', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)
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

@app.route('/api/debug/patients', methods=['GET'])
def debug_patients():
    try:
        all_patients = list(patients_collection.find({}, {"name": 1, "tenantId": 1}))
        result = []
        for patient in all_patients:
            result.append({
                "id": str(patient["_id"]),
                "name": patient.get("name", "Unknown"),
                "tenantId": patient.get("tenantId", "MISSING")
            })
        
        tenant_counts = {}
        for patient in result:
            tenant_id = patient.get("tenantId", "MISSING")
            tenant_counts[tenant_id] = tenant_counts.get(tenant_id, 0) + 1
        
        return jsonify({
            "patients": result,
            "tenant_counts": tenant_counts,
            "total_patients": len(result)
        }), 200
    except Exception as e:
        logger.error(f"Error in debug endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-patients', methods=['GET'])
def get_patients():
    try:
        email = request.args.get('email')
        tenant_id = request.args.get('tenantId', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)
        
        logger.info(f"Fetching patients for tenant_id: {tenant_id}")
        
        patients = list(patients_collection.find({"tenantId": tenant_id}))
        
        logger.info(f"Found {len(patients)} patients for tenant {tenant_id}")
        
        for patient in patients:
            patient["patientId"] = str(patient["_id"])
            patient.pop("_id")
        
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
        email = request.args.get('email')
        tenant_id = request.args.get('tenantId', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)
        patient_id = request.args.get('patientId')

        if not patient_id:
            return jsonify({"success": False, "error": "Missing patientId"}), 400

        logger.info(f"Fetching history for patient {patient_id} in tenant {tenant_id}")
        transcripts = list(transcripts_collection.find({"tenantId": tenant_id, "patientId": patient_id}))
        for transcript in transcripts:
            transcript["id"] = str(transcript["_id"])
            transcript.pop("_id")
        logger.info(f"Retrieved {len(transcripts)} transcripts for patient {patient_id} in tenant {tenant_id}")
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
        logger.debug(f"Request headers: {request.headers}")
        logger.debug(f"Request JSON: {request.get_json()}")

        data = request.get_json()
        patient_id = data.get('patientId')
        email = data.get('email')
        tenant_id = data.get('tenantId', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)

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
        email = data.get('email')
        tenant_id = data.get('tenantId', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)

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
        tenant_id = validate_tenant_id(tenant_id, email)

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

        recommendations = result.get("enhanced_recommendations", result.get("patient_education", "N/A"))
        
        transcript_doc = {
            "tenantId": tenant_id,
            "patientId": patient_id,
            "visitId": visit_id,
            "transcript": text,
            "soapNotes": result,
            "insights": {
                "allergy_triggers": result.get("patient_history", {}).get("allergies", "N/A"),
                "condition": result.get("differential_diagnosis", "N/A").split('\n')[0],
                "recommendations": recommendations
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

@app.route('/api/analyze-transcript', methods=['POST', 'OPTIONS'])
def analyze_transcript_endpoint():
    logger.info("Received request for /api/analyze-transcript")
    if request.method == 'OPTIONS':
        logger.info("Handling OPTIONS request for /api/analyze-transcript")
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response

    logger.info("Handling POST request for /api/analyze-transcript")
    tenant_id = 'default_tenant'
    patient_id = None
    visit_id = None
    email = None
    transcript = None

    try:
        data = request.get_json()
        if not data:
            logger.error("No JSON data provided in the request")
            return jsonify({"statusCode": 400, "error": "Request body must contain JSON data"}), 400

        patient_id = data.get('patientId') or data.get('patient_id')
        transcript = data.get('transcript')
        visit_id = data.get('visitId') or data.get('visit_id')
        email = data.get('email')
        tenant_id = data.get('tenantId') or data.get('tenant_id', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)

        logger.info(f"Processing transcript with data: patient_id={patient_id}, visit_id={visit_id}, tenant_id={tenant_id}, email={email}")
        
        if not all([patient_id, transcript, visit_id]):
            logger.error(f"Missing required fields: patient_id={patient_id}, transcript={'provided' if transcript else 'missing'}, visit_id={visit_id}")
            return jsonify({"statusCode": 400, "error": "patientId, transcript, and visitId are required"}), 400

        logger.info("Generating SOAP notes via xAI API")
        soap_notes = analyze_transcript(transcript)
        logger.info(f"Generated SOAP notes: {json.dumps(soap_notes, indent=2)}")

        recommendations = soap_notes.get("enhanced_recommendations", soap_notes.get("patient_education", "N/A"))

        logger.info(f"Storing SOAP notes in MedoraSOAPNotes for patient_id: {patient_id}, visit_id: {visit_id}, tenant_id: {tenant_id}")
        try:
            dynamodb_response = dynamodb.put_item(
                TableName='MedoraSOAPNotes',
                Item={
                    'patient_id': {'S': patient_id},
                    'visit_id': {'S': visit_id},
                    'soap_notes': {'S': json.dumps(soap_notes)},
                    'ttl': {'N': str(int(datetime.now().timestamp()) + 30 * 24 * 60 * 60)},
                    'tenantID': {'S': tenant_id}
                }
            )
            logger.info(f"Successfully stored SOAP notes in MedoraSOAPNotes for tenant {tenant_id}")
        except Exception as e:
            logger.error(f"Failed to store SOAP notes in MedoraSOAPNotes: {str(e)}")
            return jsonify({
                "statusCode": 500,
                "error": f"Failed to store SOAP notes in DynamoDB: {str(e)}"
            }), 500

        transcript_doc = {
            "tenantId": tenant_id,
            "patientId": patient_id,
            "visitId": visit_id,
            "transcript": transcript,
            "soapNotes": soap_notes,
            "insights": {
                "allergy_triggers": soap_notes.get("patient_history", {}).get("allergies", "N/A"),
                "condition": soap_notes.get("differential_diagnosis", "N/A").split('\n')[0],
                "recommendations": recommendations
            },
            "createdAt": datetime.now().isoformat()
        }
        logger.info(f"Preparing to save transcript for patient {patient_id} with tenant {tenant_id}")
        try:
            transcript_result = transcripts_collection.insert_one(transcript_doc)
            logger.info(f"Stored transcript for patient {patient_id}, tenant {tenant_id}: Inserted ID {transcript_result.inserted_id}")
        except Exception as e:
            logger.error(f"Failed to store transcript in MongoDB: {str(e)}")
            return jsonify({
                "statusCode": 500,
                "error": f"Failed to store transcript in MongoDB: {str(e)}"
            }), 500

        return jsonify({
            "statusCode": 200,
            "body": {
                "soap_notes": soap_notes,
                "visit_id": visit_id,
                "tenant_id": tenant_id
            }
        }), 200

    except Exception as e:
        logger.error(f"Unexpected error in /api/analyze-transcript: {str(e)}")
        return jsonify({
            "statusCode": 500,
            "error": f"Unexpected error: {str(e)}"
        }), 500

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
        email = data.get('email')
        tenant_id = data.get('tenantId') or data.get('tenant_id', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)

        if not all([patient_id, transcript, visit_id]):
            logger.error(f"Missing required fields: patient_id={patient_id}, transcript={'provided' if transcript else 'missing'}, visit_id={visit_id}")
            return jsonify({"error": "patient_id, transcript, and visit_id are required"}), 400

        logger.info(f"Processing transcript for patient_id: {patient_id}, visit_id: {visit_id}, tenant_id: {tenant_id}")

        logger.info("Generating SOAP notes via xAI API")
        soap_notes = analyze_transcript(transcript)
        logger.info(f"Generated SOAP notes: {json.dumps(soap_notes, indent=2)}")

        recommendations = soap_notes.get("enhanced_recommendations", soap_notes.get("patient_education", "N/A"))

        logger.info(f"Storing SOAP notes in MedoraSOAPNotes for patient_id: {patient_id}, visit_id: {visit_id}, tenant_id: {tenant_id}")
        try:
            dynamodb_response = dynamodb.put_item(
                TableName='MedoraSOAPNotes',
                Item={
                    'patient_id': {'S': patient_id},
                    'visit_id': {'S': visit_id},
                    'soap_notes': {'S': json.dumps(soap_notes)},
                    'ttl': {'N': str(int(datetime.now().timestamp()) + 30 * 24 * 60 * 60)},
                    'tenantID': {'S': tenant_id}
                }
            )
            logger.info(f"Successfully stored SOAP notes in MedoraSOAPNotes for tenant {tenant_id}")
        except Exception as e:
            logger.error(f"Failed to store SOAP notes in MedoraSOAPNotes: {str(e)}")
            return jsonify({"error": f"Failed to store SOAP notes in DynamoDB: {str(e)}"}), 500

        transcript_doc = {
            "tenantId": tenant_id,
            "patientId": patient_id,
            "visitId": visit_id,
            "transcript": transcript,
            "soapNotes": soap_notes,
            "insights": {
                "allergy_triggers": soap_notes.get("patient_history", {}).get("allergies", "N/A"),
                "condition": soap_notes.get("differential_diagnosis", "N/A").split('\n')[0],
                "recommendations": recommendations
            },
            "createdAt": datetime.now().isoformat()
        }
        logger.info(f"Preparing to save transcript for patient {patient_id} with tenant {tenant_id}")
        try:
            transcript_result = transcripts_collection.insert_one(transcript_doc)
            logger.info(f"Stored transcript for patient {patient_id}, tenant {tenant_id}: Inserted ID {transcript_result.inserted_id}")
        except Exception as e:
            logger.error(f"Failed to store transcript in MongoDB: {str(e)}")
            return jsonify({"error": f"Failed to store transcript in MongoDB: {str(e)}"}), 500

        return jsonify({
            "statusCode": 200,
            "body": {
                "soap_notes": soap_notes,
                "visit_id": visit_id,
                "tenant_id": tenant_id
            }
        }), 200

    except Exception as e:
        logger.error(f"Unexpected error in /submit-transcript: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/get-insights', methods=['GET', 'OPTIONS'])
def get_insights():
    logger.info("Handling GET request for /get-insights")
    api_cache = {}  # Per-request cache
    rate_limit_hit = {'pubmed_hits': 0, 'semantic_scholar': False, 'skip_guidelines': False}  # Reset rate limit tracker for this request

    # Thread-safe timeout mechanism
    from threading import Timer, Event
    timeout_event = Event()
    all_insights = []  # Collect insights incrementally

    def timeout_callback():
        timeout_event.set()
        logger.warning("Timeout reached (45 seconds) for /get-insights. Returning partial results.")

    # Set a 45-second timer
    timer = Timer(45.0, timeout_callback)
    timer.start()

    try:
        if request.method == 'OPTIONS':
            logger.info("Handling OPTIONS request for /get-insights")
            response = make_response()
            response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
            response.headers.add("Access-Control-Allow-Headers", "Content-Type")
            response.headers.add("Access-Control-Allow-Methods", "GET, OPTIONS")
            timer.cancel()  # Cancel the timer for OPTIONS requests
            return response

        logger.debug(f"Raw request arguments: {dict(request.args)}")

        patient_id = request.args.get('patient_id')
        visit_id = request.args.get('visit_id')
        email = (request.args.get('email') or
                 request.args.get('Email') or
                 request.args.get('user_email') or
                 request.args.get('userEmail'))
        tenant_id = request.args.get('tenantId', 'default_tenant')

        # Temporarily revert to fallback email while frontend team adds the email parameter
        if not email:
            logger.warning("Email parameter is required but was not provided in the request; using fallback email 'doctor@allergyaffiliates.com'. Expected parameters: 'email', 'Email', 'user_email', or 'userEmail'")
            email = "doctor@allergyaffiliates.com"
            # Uncomment the following lines once the frontend includes the email parameter
            # logger.error("Email parameter is required but was not provided in the request. Expected parameters: 'email', 'Email', 'user_email', or 'userEmail'")
            # return jsonify({"error": "Email parameter is required. Expected parameters: 'email', 'Email', 'user_email', or 'userEmail'"}), 400

        logger.debug(f"Before validation - tenant_id: {tenant_id}, email: {email}")
        try:
            tenant_id = validate_tenant_id(tenant_id, email)
        except Exception as e:
            logger.error(f"Error validating tenant_id for email '{email}': {str(e)}")
            timer.cancel()
            return jsonify({"error": "Failed to validate tenant_id"}), 500
        logger.debug(f"After validation - tenant_id: {tenant_id}")

        logger.debug(f"Request parameters - patient_id: {patient_id}, visit_id: {visit_id}, tenant_id: {tenant_id}")

        if not patient_id or not visit_id:
            logger.error(f"Missing required parameters: patient_id={patient_id}, visit_id={visit_id}")
            timer.cancel()
            return jsonify({"error": "patient_id and visit_id are required"}), 400

        try:
            soap_notes = get_soap_notes(patient_id, visit_id, tenant_id)
        except Exception as e:
            logger.error(f"Error fetching SOAP notes for patient_id {patient_id}, visit_id {visit_id}: {str(e)}")
            timer.cancel()
            return jsonify({"error": "Failed to fetch SOAP notes"}), 500
        if not soap_notes:
            logger.warning(f"No SOAP notes found for patient_id: {patient_id}, visit_id: {visit_id}")
            timer.cancel()
            return jsonify({
                "patient_id": patient_id,
                "visit_id": visit_id,
                "insights": []
            }), 200

        conditions = soap_notes.get("differential_diagnosis", "")
        if not conditions or conditions == "No data available":
            logger.warning(f"No differential diagnosis found for patient_id: {patient_id}, visit_id: {visit_id}")
            timer.cancel()
            return jsonify({
                "patient_id": patient_id,
                "visit_id": visit_id,
                "insights": []
            }), 200

        diagnoses = []
        parts = re.split(r"(?i)Alternative Diagnoses:", conditions)
        primary_part = parts[0].strip()
        primary_diagnosis = re.sub(r"(?i)Primary Diagnosis:", "", primary_part).strip()
        primary_diagnosis = primary_diagnosis.split('.')[0].strip()
        if primary_diagnosis:
            diagnoses.append(primary_diagnosis)

        if len(parts) > 1:
            alternatives = parts[1].strip()
            alt_diagnoses = re.split(r'\d+\)', alternatives)
            for alt in alt_diagnoses:
                alt = alt.strip()
                if alt:
                    alt = alt.rstrip('.,').strip()
                    if alt:
                        diagnoses.append(alt)

        diagnoses = [simplify_diagnosis(diag) for diag in diagnoses]
        logger.info(f"Parsed and simplified diagnoses for patient_id {patient_id}: {diagnoses}")

        if not diagnoses:
            logger.warning(f"No diagnoses parsed for patient_id: {patient_id}, conditions: {conditions}")
            timer.cancel()
            return jsonify({
                "patient_id": patient_id,
                "visit_id": visit_id,
                "insights": []
            }), 200

        # Collect insights for each diagnosis separately to ensure representation
        insights_by_diagnosis = {diag: [] for diag in diagnoses}
        for diagnosis in diagnoses:
            if timeout_event.is_set():
                logger.warning(f"Timeout reached while processing diagnosis '{diagnosis}'. Returning partial results.")
                break

            logger.debug(f"Processing diagnosis: {diagnosis}")
            try:
                # Reset circuit breaker for this diagnosis
                diagnosis_key = f"pubmed_hits_{diagnosis}"
                rate_limit_hit[diagnosis_key] = 0
                rate_limit_hit['skip_guidelines'] = False

                # Query Semantic Scholar first (faster, less likely to hit rate limits)
                cache_key_semantic = f"semantic_{diagnosis}"
                cached_semantic = None
                try:
                    cached_semantic = get_cached_result(cache_key_semantic, ttl_minutes=120)
                except Exception as e:
                    logger.error(f"Error fetching cached Semantic Scholar insights for '{diagnosis}': {str(e)}")

                if cached_semantic is not None:
                    if not cached_semantic:  # Invalidate empty cache entries
                        logger.debug(f"Invalidating empty cache for Semantic Scholar insights for '{diagnosis}'")
                        cached_semantic = None
                    else:
                        logger.debug(f"Cache hit for Semantic Scholar insights for '{diagnosis}'")
                        insights_by_diagnosis[diagnosis].extend(cached_semantic)
                if cached_semantic is None:
                    logger.debug(f"Cache miss or invalidated for Semantic Scholar insights for '{diagnosis}'")
                    semantic_insights = query_semantic_scholar(diagnosis, retmax=2, timeout=3, rate_limit_hit=rate_limit_hit)
                    insights_by_diagnosis[diagnosis].extend(semantic_insights)
                    # Skip caching for now due to set_cached_result issue
                    if timeout_event.is_set():
                        logger.warning(f"Timeout reached after fetching Semantic Scholar insights for '{diagnosis}'. Returning partial results.")
                        break

                # Query PubMed
                cache_key_pubmed = f"pubmed_{diagnosis}"
                cached_pubmed = None
                try:
                    cached_pubmed = get_cached_result(cache_key_pubmed, ttl_minutes=120)
                except Exception as e:
                    logger.error(f"Error fetching cached PubMed insights for '{diagnosis}': {str(e)}")

                if cached_pubmed is not None:
                    if not cached_pubmed:  # Invalidate empty cache entries
                        logger.debug(f"Invalidating empty cache for PubMed insights for '{diagnosis}'")
                        cached_pubmed = None
                    else:
                        logger.debug(f"Cache hit for PubMed insights for '{diagnosis}'")
                        insights_by_diagnosis[diagnosis].extend(cached_pubmed)
                if cached_pubmed is None:
                    logger.debug(f"Cache miss or invalidated for PubMed insights for '{diagnosis}'")
                    pubmed_insights = query_pubmed(diagnosis, retmax=2, timeout=3, rate_limit_hit=rate_limit_hit)
                    insights_by_diagnosis[diagnosis].extend(pubmed_insights)
                    # Skip caching for now due to set_cached_result issue
                    time.sleep(5)  # Increased delay to manage rate limits
                    if timeout_event.is_set():
                        logger.warning(f"Timeout reached after fetching PubMed insights for '{diagnosis}'. Returning partial results.")
                        break

                # Query clinical guidelines
                cache_key_guidelines = f"guidelines_{diagnosis}"
                cached_guidelines = None
                try:
                    cached_guidelines = get_cached_result(cache_key_guidelines, ttl_minutes=120)
                except Exception as e:
                    logger.error(f"Error fetching cached guidelines for '{diagnosis}': {str(e)}")

                if cached_guidelines is not None:
                    if not cached_guidelines:  # Invalidate empty cache entries
                        logger.debug(f"Invalidating empty cache for clinical guidelines for '{diagnosis}'")
                        cached_guidelines = None
                    else:
                        logger.debug(f"Cache hit for clinical guidelines for '{diagnosis}'")
                        insights_by_diagnosis[diagnosis].extend(cached_guidelines)
                if cached_guidelines is None:
                    logger.debug(f"Cache miss or invalidated for clinical guidelines for '{diagnosis}'")
                    guidelines = query_clinical_guidelines(diagnosis, retmax=1, timeout=3, rate_limit_hit=rate_limit_hit, skip_guidelines=rate_limit_hit.get('skip_guidelines', False))
                    insights_by_diagnosis[diagnosis].extend(guidelines)
                    # Skip caching for now due to set_cached_result issue
                    time.sleep(5)  # Increased delay to manage rate limits
                    if timeout_event.is_set():
                        logger.warning(f"Timeout reached after fetching clinical guidelines for '{diagnosis}'. Returning partial results.")
                        break

            except Exception as e:
                logger.error(f"Error processing diagnosis '{diagnosis}': {str(e)}. Continuing with next diagnosis.")
                continue

        # Select insights to ensure representation from each diagnosis
        def get_relevance_score(insight):
            return insight.get("raw_relevance_score", 0.0)

        # Sort insights for each diagnosis by relevance score
        for diagnosis in insights_by_diagnosis:
            insights_by_diagnosis[diagnosis].sort(key=get_relevance_score, reverse=True)

        # Ensure at least one insight per diagnosis, then fill remaining slots with highest-scoring insights
        final_insights = []
        max_insights = 3  # Total number of insights to return

        # Step 1: Add the highest-scoring insight from each diagnosis
        for diagnosis in diagnoses:
            if insights_by_diagnosis[diagnosis]:
                final_insights.append(insights_by_diagnosis[diagnosis][0])
                logger.debug(f"Added top insight for '{diagnosis}' to final response: {insights_by_diagnosis[diagnosis][0]['title']}")

        # Step 2: If fewer than max_insights, fill remaining slots with highest-scoring insights from all diagnoses
        remaining_slots = max_insights - len(final_insights)
        if remaining_slots > 0:
            # Collect all remaining insights
            all_remaining_insights = []
            for diagnosis in diagnoses:
                all_remaining_insights.extend(insights_by_diagnosis[diagnosis][1:])  # Skip the first one already added
            all_remaining_insights.sort(key=get_relevance_score, reverse=True)
            final_insights.extend(all_remaining_insights[:remaining_slots])
            logger.debug(f"Filled remaining {remaining_slots} slots with highest-scoring insights")

        # Remove raw_relevance_score from final insights
        for insight in final_insights:
            insight.pop("raw_relevance_score", None)
            insight.pop("inclusion_confidence", None)  # Remove debugging field

        if not final_insights:
            logger.warning(f"No insights found for patient_id: {patient_id}, visit_id: {visit_id}, diagnoses: {diagnoses}")
            timer.cancel()
            return jsonify({
                "patient_id": patient_id,
                "visit_id": visit_id,
                "insights": []
            }), 200

        result = {
            "patient_id": patient_id,
            "visit_id": visit_id,
            "insights": final_insights
        }
        logger.info(f"Final response for patient_id {patient_id}: {json.dumps(result, indent=2)}")
        
        try:
            for insight in final_insights:
                insight_id = str(uuid.uuid4())
                dynamodb.put_item(
                    TableName='MedoraReferences',
                    Item={
                        'id': {'S': insight_id},
                        'patient_id': {'S': patient_id},
                        'visit_id': {'S': visit_id},
                        'references': {'S': json.dumps(insight)},
                        'ttl': {'N': str(int(datetime.now().timestamp()) + 30 * 24 * 60 * 60)},
                        'tenantID': {'S': tenant_id}
                    }
                )
                logger.info(f"Stored reference {insight_id} for patient {patient_id}, tenant {tenant_id}")
        except Exception as e:
            logger.error(f"Error storing references in DynamoDB: {str(e)}")
        
        timer.cancel()  # Cancel the timer before returning
        return jsonify(result), 200

    except Exception as e:
        timer.cancel()  # Cancel the timer on error
        logger.error(f"Unexpected error in /get-insights: {str(e)}")
        return jsonify({
            "patient_id": patient_id,
            "visit_id": visit_id,
            "insights": all_insights if 'all_insights' in locals() else [],
            "error": f"Unexpected error: {str(e)}"
        }), 500

@app.route('/api/admin/fix-patients', methods=['POST'])
def fix_patient_tenant_ids():
    try:
        data = request.get_json()
        admin_key = data.get('admin_key')
        if admin_key != "medora_admin_key_2025":
            return jsonify({"success": False, "error": "Unauthorized"}), 401
            
        default_tenant = data.get('default_tenant', 'doctor@allergyaffiliates.com')
        
        result = patients_collection.update_many(
            {"tenantId": {"$exists": False}},
            {"$set": {"tenantId": default_tenant}}
        )
        
        transcript_result = transcripts_collection.update_many(
            {"tenantId": {"$exists": False}},
            {"$set": {"tenantId": default_tenant}}
        )
        
        visit_result = visits_collection.update_many(
            {"tenantId": {"$exists": False}},
            {"$set": {"tenantId": default_tenant}}
        )
        
        return jsonify({
            "success": True,
            "updated_patients": result.modified_count,
            "updated_transcripts": transcript_result.modified_count,
            "updated_visits": visit_result.modified_count
        }), 200
    except Exception as e:
        logger.error(f"Error fixing tenant IDs: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

from pymongo.errors import ConnectionFailure, OperationFailure

@app.route('/api/allergeniq-profile', methods=['GET', 'OPTIONS'])
def get_allergeniq_profile():
    """Get AllergenIQ profile data for a patient"""
    logger.info("ALLERGENIQ: API endpoint called")
    
    if request.method == 'OPTIONS':
        logger.info("ALLERGENIQ: Handling OPTIONS request")
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "GET, OPTIONS")
        return response
        
    try:
        req_details = {
            "method": request.method,
            "url": request.url,
            "headers": dict(request.headers),
            "args": dict(request.args),
            "remote_addr": request.remote_addr
        }
        logger.info(f"ALLERGENIQ: Request details: {req_details}")
        
        patient_id = request.args.get('patient_id')
        visit_id = request.args.get('visit_id')
        email = request.args.get('email')
        tenant_id = request.args.get('tenantId', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)
        
        logger.info(f"ALLERGENIQ: Request params - patient_id: {patient_id}, visit_id: {visit_id}, tenant_id: {tenant_id}, email: {email}")
        
        if not patient_id or not visit_id:
            logger.error(f"ALLERGENIQ: Missing required parameters: patient_id={patient_id}, visit_id={visit_id}")
            return jsonify({
                "success": False,
                "error": "patient_id and visit_id are required"
            }), 400
            
        request_timeout = 5
        start_time = time.time()
            
        soap_notes = None
        try:
            soap_notes = get_soap_notes(patient_id, visit_id, tenant_id)
            logger.info(f"ALLERGENIQ: SOAP notes retrieval result: {soap_notes is not None}")
        except Exception as e:
            logger.error(f"ALLERGENIQ: Error retrieving SOAP notes: {str(e)}")
        
        if time.time() - start_time > request_timeout:
            logger.warning(f"ALLERGENIQ: SOAP notes retrieval timeout exceeded")
            soap_notes = None
            
        if not soap_notes:
            logger.warning(f"ALLERGENIQ: SOAP notes not found or timed out for patient {patient_id}, visit {visit_id}")
            soap_notes = {
                "patient_history": {
                    "allergies": "No data available",
                    "review_of_systems": "No data available"
                },
                "differential_diagnosis": "No data available",
                "plan_of_care": "No data available"
            }
            logger.info("ALLERGENIQ: Using default SOAP notes structure")
            
        patient_insights = []
        if time.time() - start_time <= request_timeout:
            try:
                patient_insights = get_patient_insights(patient_id, tenant_id)
                logger.info(f"ALLERGENIQ: Retrieved {len(patient_insights) if patient_insights else 0} patient insights")
            except Exception as e:
                logger.error(f"ALLERGENIQ: Error retrieving patient insights: {str(e)}")
        else:
            logger.warning(f"ALLERGENIQ: Skipping patient insights due to timeout")
            
        transcript_data = None
        if time.time() - start_time <= request_timeout:
            try:
                client.admin.command('ping')
                transcript = transcripts_collection.find_one({
                    "patientId": patient_id,
                    "visitId": visit_id,
                    "tenantId": tenant_id
                })
                
                if transcript:
                    raw_transcript = transcript.get("transcript")
                    if raw_transcript:
                        transcript_data = process_transcript_for_allergeniq(raw_transcript)
                        logger.info("ALLERGENIQ: Successfully processed transcript for allergen data")
                    else:
                        logger.warning("ALLERGENIQ: Transcript found but missing 'transcript' field")
                else:
                    logger.warning(f"ALLERGENIQ: No transcript found for patient {patient_id}, visit {visit_id}")
            except (ConnectionFailure, OperationFailure) as e:
                logger.error(f"ALLERGENIQ: MongoDB connection error while retrieving transcript: {str(e)}")
            except Exception as e:
                logger.error(f"ALLERGENIQ: Error retrieving or processing transcript: {str(e)}")
        else:
            logger.warning(f"ALLERGENIQ: Skipping transcript processing due to timeout")
        
        profile_data = structure_allergeniq_data(soap_notes, patient_insights, transcript_data)
        
        patient_name = "Unknown Patient"
        patient_age = None
        if time.time() - start_time <= request_timeout:
            try:
                client.admin.command('ping')
                patient_doc = patients_collection.find_one({"_id": ObjectId(patient_id), "tenantId": tenant_id})
                if not patient_doc:
                    patient_doc = patients_collection.find_one({"name": patient_id, "tenantId": tenant_id})
                if patient_doc:
                    patient_name = patient_doc.get("name", "Unknown Patient")
                    patient_age = patient_doc.get("age")
                    logger.info(f"ALLERGENIQ: Found patient: {patient_name}, age: {patient_age}")
                else:
                    logger.warning(f"ALLERGENIQ: Patient not found in MongoDB: {patient_id}")
            except (ConnectionFailure, OperationFailure) as e:
                logger.error(f"ALLERGENIQ: MongoDB connection error while retrieving patient details: {str(e)}")
            except Exception as e:
                logger.error(f"ALLERGENIQ: Error retrieving patient details: {str(e)}")
        else:
            logger.warning(f"ALLERGENIQ: Skipping patient details retrieval due to timeout")
        
        visit_date = datetime.now().isoformat().split('T')[0]
        if time.time() - start_time <= request_timeout:
            try:
                client.admin.command('ping')
                visit_doc = visits_collection.find_one({"visitId": visit_id, "tenantId": tenant_id})
                if visit_doc and "startTime" in visit_doc:
                    visit_date = visit_doc["startTime"].split('T')[0]
                    logger.info(f"ALLERGENIQ: Found visit date: {visit_date}")
                else:
                    logger.warning(f"ALLERGENIQ: Visit not found in MongoDB: {visit_id}")
            except (ConnectionFailure, OperationFailure) as e:
                logger.error(f"ALLERGENIQ: MongoDB connection error while retrieving visit date: {str(e)}")
            except Exception as e:
                logger.error(f"ALLERGENIQ: Error retrieving visit date: {str(e)}")
        else:
            logger.warning(f"ALLERGENIQ: Skipping visit date retrieval due to timeout")
        
        result = {
            "success": True,
            "patient_id": patient_id,
            "visit_id": visit_id,
            "patient_name": patient_name,
            "patient_age": patient_age if patient_age is not None else None,
            "visit_date": visit_date,
            "profile": profile_data
        }
        
        logger.info("ALLERGENIQ: Successfully generated profile data")
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"ALLERGENIQ: Error generating AllergenIQ profile: {str(e)}")
        logger.error(f"ALLERGENIQ: Stack trace: {traceback.format_exc()}")
        return jsonify({
            "success": False,
            "error": f"Failed to generate AllergenIQ profile: {str(e)}"
        }), 500

# Load the private key for JWT signing
try:
    with open(PRIVATE_KEY_PATH, 'r') as f:
        PRIVATE_KEY = f.read()
    logger.info("Successfully loaded private key for IMS FHIR authentication")
except Exception as e:
    logger.error(f"Failed to load private key: {str(e)}")
    raise

def generate_jwt_assertion():
    try:
        now = int(time.time())
        payload = {
            "sub": IMS_CLIENT_ID,
            "aud": IMS_TOKEN_ENDPOINT,
            "iss": IMS_CLIENT_ID,
            "exp": now + 300,
            "iat": now,
            "jti": str(uuid.uuid4())
        }
        assertion = jwt.encode(payload, PRIVATE_KEY, algorithm="RS384")
        logger.debug(f"Generated JWT assertion: {assertion}")
        return assertion
    except Exception as e:
        logger.error(f"Failed to generate JWT assertion: {str(e)}")
        return None

def get_fhir_access_token():
    try:
        assertion = generate_jwt_assertion()
        if not assertion:
            raise ValueError("Failed to generate JWT assertion")
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        payload = {
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "grant_type": "client_credentials",
            "client_id": IMS_CLIENT_ID,
            "client_assertion": assertion
        }
        logger.debug(f"Sending token request to IMS: {IMS_TOKEN_ENDPOINT}")
        response = requests.post(IMS_TOKEN_ENDPOINT, headers=headers, data=payload, timeout=10)
        response.raise_for_status()
        token_data = response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError("No access token in response")
        logger.info("Successfully obtained IMS FHIR access token")
        return access_token
    except Exception as e:
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Failed to get IMS FHIR access token: {str(e)} - Response: {e.response.text}")
        else:
            logger.error(f"Failed to get IMS FHIR access token: {str(e)}")
        return None

def push_to_fhir_server(patient_id, visit_id, tenant_id):
    try:
        access_token = get_fhir_access_token()
        if not access_token:
            raise ValueError("Failed to obtain FHIR access token")
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/fhir+json"
        }
        patient = patients_collection.find_one({"_id": ObjectId(patient_id), "tenantId": tenant_id})
        if not patient:
            raise ValueError(f"Patient {patient_id} not found")
        fhir_patient = {
            "resourceType": "Patient",
            "id": patient_id,
            "name": [{"text": patient.get("name", "Unknown Patient")}],
            "birthDate": None,
            "meta": {"tag": [{"system": "http://medora.ai/tenant", "code": tenant_id}]}
        }
        response = requests.put(
            f"{IMS_FHIR_SERVER_URL}/Patient/{patient_id}",
            headers=headers,
            json=fhir_patient,
            timeout=10
        )
        response.raise_for_status()
        logger.info(f"Pushed Patient {patient_id} to IMS FHIR server")
        visit = visits_collection.find_one({"visitId": visit_id, "tenantId": tenant_id})
        if not visit:
            raise ValueError(f"Visit {visit_id} not found")
        fhir_encounter = {
            "resourceType": "Encounter",
            "id": visit_id,
            "status": "finished" if visit.get("status") == "completed" else "in-progress",
            "subject": {"reference": f"Patient/{patient_id}"},
            "period": {"start": visit.get("startTime")},
            "meta": {"tag": [{"system": "http://medora.ai/tenant", "code": tenant_id}]}
        }
        response = requests.put(
            f"{IMS_FHIR_SERVER_URL}/Encounter/{visit_id}",
            headers=headers,
            json=fhir_encounter,
            timeout=10
        )
        response.raise_for_status()
        logger.info(f"Pushed Encounter {visit_id} to IMS FHIR server")
        soap_notes = get_soap_notes(patient_id, visit_id, tenant_id)
        if not soap_notes:
            logger.warning(f"No SOAP notes found for patient {patient_id}, visit {visit_id}")
            return True
        fhir_observation = {
            "resourceType": "Observation",
            "id": f"{visit_id}-soap",
            "status": "final",
            "code": {"text": "SOAP Notes"},
            "subject": {"reference": f"Patient/{patient_id}"},
            "encounter": {"reference": f"Encounter/{visit_id}"},
            "valueString": json.dumps(soap_notes),
            "meta": {"tag": [{"system": "http://medora.ai/tenant", "code": tenant_id}]}
        }
        response = requests.put(
            f"{IMS_FHIR_SERVER_URL}/Observation/{visit_id}-soap",
            headers=headers,
            json=fhir_observation,
            timeout=10
        )
        response.raise_for_status()
        logger.info(f"Pushed SOAP notes as Observation for visit {visit_id} to IMS FHIR server")
        return True
    except Exception as e:
        logger.error(f"Failed to push data to IMS FHIR server: {str(e)}")
        return False

@app.route('/api/push-to-ims', methods=['POST', 'OPTIONS'])
def push_to_ims():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response

    try:
        data = request.get_json()
        patient_id = data.get('patientId')
        visit_id = data.get('visitId')
        email = data.get('email')
        tenant_id = data.get('tenantId', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)

        if not patient_id or not visit_id or not email:
            logger.error(f"Missing required parameters: patientId={patient_id}, visitId={visit_id}, email={email}")
            return jsonify({"success": False, "error": "patientId, visitId, and email are required"}), 400

        logger.info(f"Attempting to push data to IMS for patient {patient_id}, visit {visit_id}, tenant {tenant_id}")
        success = push_to_fhir_server(patient_id, visit_id, tenant_id)
        if success:
            logger.info(f"Successfully pushed data to IMS FHIR server for patient {patient_id}, visit {visit_id}")
            return jsonify({"success": True, "message": "Data pushed to IMS FHIR server"}), 200
        else:
            logger.error(f"Failed to push data to IMS FHIR server for patient {patient_id}, visit {visit_id}")
            return jsonify({"success": False, "error": "Failed to push data to IMS FHIR server"}), 500
    except Exception as e:
        logger.error(f"Error in push-to-ims: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    try:
        patients_collection.create_index([("tenantId", 1)])
        transcripts_collection.create_index([("tenantId", 1), ("patientId", 1)])
        visits_collection.create_index([("tenantId", 1), ("patientId", 1)])
        logger.info("MongoDB indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating MongoDB indexes: {str(e)}")
        
    app.run(host='0.0.0.0', port=PORT, debug=False)
