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
    
    # Create index on tenantId field for better performance
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
    "geepan1806@gmail.com": {"tier": "Premium", "trial_start": None, "card_last4": "7890"}
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

# FIXED Function to validate and standardize tenantId
def validate_tenant_id(tenant_id, email=None):
    """
    Ensure tenant_id is valid and standardized
    If tenant_id is 'default_tenant' but email is provided, use email instead
    """
    if not tenant_id or tenant_id == 'default_tenant':
        # If email is provided, use it as the tenant_id
        if email:
            logger.info(f"Converting default_tenant to email: {email}")
            return email
        # Otherwise, fall back to default_tenant for backward compatibility
        return 'default_tenant'
    
    # Otherwise, return the tenant_id as-is
    return tenant_id

# New function to get SOAP notes by tenant
def get_soap_notes(patient_id, visit_id, tenant_id=None):
    """
    Get SOAP notes from DynamoDB with tenant filtering
    """
    try:
        # First try direct lookup by primary key
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
        
        # If tenant_id is provided, check if it matches
        if tenant_id:
            item_tenant_id = item.get('tenantID', {}).get('S')
            # Return the item if it has no tenantID (legacy data) or if tenant matches
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
            # No tenant filtering, return the item
            soap_notes_json = item.get('soap_notes', {}).get('S')
            if soap_notes_json:
                return json.loads(soap_notes_json)
            else:
                logger.warning(f"SOAP notes field missing for patient {patient_id}, visit {visit_id}")
                return None
                
    except Exception as e:
        logger.error(f"Error fetching SOAP notes from DynamoDB: {str(e)}")
        return None

# New function to get all SOAP notes for a tenant
def get_all_soap_notes_for_tenant(tenant_id):
    """
    Get all SOAP notes for a specific tenant
    """
    try:
        # Try using GSI if available
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
            
            # Fall back to scan with filter
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

# New function to get patient insights for a tenant
def get_patient_insights(patient_id, tenant_id=None):
    """
    Get patient insights from DynamoDB with tenant filtering
    """
    try:
        if tenant_id:
            # Try using GSI if available
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
                
                # Fall back to scan with filter
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
            # No tenant filtering, query directly by patient_id
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

# New function to get references for a tenant
def get_references(tenant_id=None):
    """
    Get references from DynamoDB with tenant filtering
    """
    try:
        if tenant_id:
            # Try using GSI if available
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
                
                # Fall back to scan with filter
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
            # No tenant filtering, scan all references
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
        "max_tokens": 2500,  # Increased from 1500 to allow for more detailed response
        "temperature": 0.25   # Slightly reduced to increase precision and consistency
    }

    try:
        logger.debug(f"Sending request to xAI API: URL={XAI_API_URL}, Headers={headers}, Payload={payload}")
        response = requests.post(XAI_API_URL, headers=headers, json=payload, timeout=45)  # Increased timeout
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
                    
                    # Extract enhanced recommendations for displaying in the recommendations section
                    if "enhanced_recommendations" in parsed_data:
                        enhanced_recs = parsed_data["enhanced_recommendations"]
                        # If patient_education exists, complement it with the enhanced recommendations
                        if "patient_education" in parsed_data:
                            # We'll keep the original patient_education but make the recommendations field more comprehensive
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

@app.route('/api/transcribe-audio', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({"success": False, "error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    email = request.form.get('email')
    tenant_id = request.form.get('tenantId', 'default_tenant')
    tenant_id = validate_tenant_id(tenant_id, email)  # FIXED: Pass email parameter

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
        tenant_id = validate_tenant_id(tenant_id, email)  # FIXED: Pass email parameter
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

# Debug endpoint to check patients by tenant
@app.route('/api/debug/patients', methods=['GET'])
def debug_patients():
    try:
        # List all patients with their tenantId
        all_patients = list(patients_collection.find({}, {"name": 1, "tenantId": 1}))
        result = []
        for patient in all_patients:
            result.append({
                "id": str(patient["_id"]),
                "name": patient.get("name", "Unknown"),
                "tenantId": patient.get("tenantId", "MISSING")
            })
        
        # Get total patients by tenant
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
        tenant_id = validate_tenant_id(tenant_id, email)  # FIXED: Pass email parameter
        
        logger.info(f"Fetching patients for tenant_id: {tenant_id}")
        
        # Find patients with exact match for this tenant
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
        tenant_id = validate_tenant_id(tenant_id, email)  # FIXED: Pass email parameter
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
        # Log the incoming request
        logger.debug(f"Request headers: {request.headers}")
        logger.debug(f"Request JSON: {request.get_json()}")

        data = request.get_json()
        patient_id = data.get('patientId')
        email = data.get('email')
        tenant_id = data.get('tenantId', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)  # FIXED: Pass email parameter

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
        tenant_id = validate_tenant_id(tenant_id, email)  # FIXED: Pass email parameter

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
        tenant_id = validate_tenant_id(tenant_id, email)  # FIXED: Pass email parameter

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

        # Prepare recommendations for the insights section
        # First check if we have enhanced recommendations, otherwise use patient_education
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
    try:
        data = request.get_json()
        # Extract data from request with both camelCase and snake_case support
        patient_id = data.get('patientId') or data.get('patient_id')
        transcript = data.get('transcript')
        visit_id = data.get('visitId') or data.get('visit_id')
        email = data.get('email')
        # Get tenant ID from any available source, prioritizing email
        tenant_id = data.get('tenantId') or data.get('tenant_id', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)  # FIXED: Pass email parameter

        logger.info(f"Processing transcript with data: patient_id={patient_id}, visit_id={visit_id}, tenant_id={tenant_id}, email={email}")
        
        if not all([patient_id, transcript, visit_id]):
            logger.error(f"Missing required fields: patient_id={patient_id}, transcript={'provided' if transcript else 'missing'}, visit_id={visit_id}")
            return jsonify({"statusCode": 400, "error": "patientId, transcript, and visitId are required"}), 400

        # Step 1: Generate SOAP notes using xAI API
        logger.info("Generating SOAP notes via xAI API")
        soap_notes = analyze_transcript(transcript)
        logger.info(f"Generated SOAP notes: {json.dumps(soap_notes, indent=2)}")

        # Check for enhanced recommendations
        recommendations = soap_notes.get("enhanced_recommendations", soap_notes.get("patient_education", "N/A"))

        # Step 2: Store SOAP notes in MedoraSOAPNotes table - MODIFIED to include tenantID
        logger.info(f"Storing SOAP notes in MedoraSOAPNotes for patient_id: {patient_id}, visit_id: {visit_id}, tenant_id: {tenant_id}")
        try:
            dynamodb_response = dynamodb.put_item(
                TableName='MedoraSOAPNotes',
                Item={
                    'patient_id': {'S': patient_id},
                    'visit_id': {'S': visit_id},
                    'soap_notes': {'S': json.dumps(soap_notes)},
                    'ttl': {'N': str(int(datetime.now().timestamp()) + 30 * 24 * 60 * 60)},
                    'tenantID': {'S': tenant_id}  # Use validated tenant_id
                }
            )
            logger.info(f"Successfully stored SOAP notes in MedoraSOAPNotes for tenant {tenant_id}")
        except Exception as e:
            logger.error(f"Failed to store SOAP notes in MedoraSOAPNotes: {str(e)}")
            return jsonify({
                "statusCode": 500, 
                "error": f"Failed to store SOAP notes in DynamoDB: {str(e)}"
            }), 500

        # Step 3: Store transcript in MongoDB
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
                "tenant_id": tenant_id  # Return the validated tenant_id
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
        tenant_id = validate_tenant_id(tenant_id, email)  # FIXED: Pass email parameter

        if not all([patient_id, transcript, visit_id]):
            logger.error(f"Missing required fields: patient_id={patient_id}, transcript={'provided' if transcript else 'missing'}, visit_id={visit_id}")
            return jsonify({"error": "patient_id, transcript, and visit_id are required"}), 400

        logger.info(f"Processing transcript for patient_id: {patient_id}, visit_id: {visit_id}, tenant_id: {tenant_id}")

        # Step 1: Generate SOAP notes using xAI API
        logger.info("Generating SOAP notes via xAI API")
        soap_notes = analyze_transcript(transcript)
        logger.info(f"Generated SOAP notes: {json.dumps(soap_notes, indent=2)}")

        # Check for enhanced recommendations
        recommendations = soap_notes.get("enhanced_recommendations", soap_notes.get("patient_education", "N/A"))

        # Step 2: Store SOAP notes in MedoraSOAPNotes table - MODIFIED to include tenantID
        logger.info(f"Storing SOAP notes in MedoraSOAPNotes for patient_id: {patient_id}, visit_id: {visit_id}, tenant_id: {tenant_id}")
        try:
            dynamodb_response = dynamodb.put_item(
                TableName='MedoraSOAPNotes',
                Item={
                    'patient_id': {'S': patient_id},
                    'visit_id': {'S': visit_id},
                    'soap_notes': {'S': json.dumps(soap_notes)},
                    'ttl': {'N': str(int(datetime.now().timestamp()) + 30 * 24 * 60 * 60)},
                    'tenantID': {'S': tenant_id}  # Use validated tenant_id
                }
            )
            logger.info(f"Successfully stored SOAP notes in MedoraSOAPNotes for tenant {tenant_id}")
        except Exception as e:
            logger.error(f"Failed to store SOAP notes in MedoraSOAPNotes: {str(e)}")
            return jsonify({"error": f"Failed to store SOAP notes in DynamoDB: {str(e)}"}), 500

        # Step 3: Store transcript in MongoDB
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
                "tenant_id": tenant_id  # Return the validated tenant_id
            }
        }), 200

    except Exception as e:
        logger.error(f"Unexpected error in /submit-transcript: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

def query_pubmed(condition, retmax=1):
    """
    Query PubMed for articles related to the given condition.
    Returns a list of insights with title, summary, PubMed ID, URL, confidence, relevance score, and relevance tag.
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
        logger.debug(f"Sending PubMed search request for condition '{condition}' with params: {search_params}")
        search_response = requests.get(search_url, params=search_params, timeout=10)
        search_response.raise_for_status()
        search_data = search_response.json()

        id_list = search_data.get("esearchresult", {}).get("idlist", [])
        logger.debug(f"PubMed returned article IDs for condition '{condition}': {id_list}")
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
            logger.debug(f"PubMed article title: {title_text}")

            # Extract abstract (summary)
            abstract = article.find(".//Abstract/AbstractText")
            abstract_text = abstract.text if abstract is not None else "N/A"
            logger.debug(f"PubMed article abstract: {abstract_text}")

            # Extract PubMed ID
            pubmed_id = article.find(".//PMID")
            pubmed_id_text = pubmed_id.text if pubmed_id is not None else "N/A"

            # Construct URL
            url = f"https://pubmed.ncbi.nlm.nih.gov/{pubmed_id_text}/"

            # Extract authors
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

            # Extract publication year
            pub_date = article.find(".//PubDate/Year")
            year = pub_date.text if pub_date is not None else "N/A"
            logger.debug(f"PubMed article year: {year}")

            # Compute relevance score with partial matching
            relevance_score = 0.0
            condition_words = condition.lower().split()
            logger.debug(f"Condition words for matching: {condition_words}")
            title_lower = title_text.lower()
            abstract_lower = abstract_text.lower()

            # Check for partial matches in title
            title_matches = sum(1 for word in condition_words if word in title_lower)
            if title_matches > 0:
                title_weight = (title_matches / len(condition_words)) * 0.5  # Scale based on number of matching words
                relevance_score += title_weight
                logger.debug(f"PubMed title partial matches for '{condition}': {title_matches}/{len(condition_words)}. Added {title_weight:.2f} to relevance score")
            else:
                logger.debug(f"No title partial matches for '{condition}' in '{title_lower}'")

            # Check for partial matches in abstract
            abstract_matches = sum(1 for word in condition_words if word in abstract_lower)
            if abstract_matches > 0:
                abstract_weight = (abstract_matches / len(condition_words)) * 0.3  # Scale based on number of matching words
                relevance_score += abstract_weight
                logger.debug(f"PubMed abstract partial matches for '{condition}': {abstract_matches}/{len(condition_words)}. Added {abstract_weight:.2f} to relevance score")
            else:
                logger.debug(f"No abstract partial matches for '{condition}' in '{abstract_lower}'")

            # Ensure a minimum score if the article was returned (since it's relevant by search)
            if relevance_score == 0.0:
                relevance_score = 10.0  # Minimum score to avoid 0.0%
                logger.debug(f"No direct matches found, assigning minimum relevance score of 10.0")

            # Normalize to 0-100
            relevance_score = min(relevance_score * 100, 100)
            logger.debug(f"PubMed final relevance score for '{condition}': {relevance_score}")

            # Assign confidence (textual) based on relevance score
            confidence = "Recommended"
            if relevance_score > 70:
                confidence = "Highly Recommended"
            elif relevance_score > 40:
                confidence = "Recommended"
            else:
                confidence = "Relevant"
            logger.debug(f"PubMed confidence for '{condition}': {confidence}")

            # Create relevance tag
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
                "raw_relevance_score": relevance_score  # Store raw score for sorting
            }
            insights.append(insight)
            logger.debug(f"PubMed insight for condition '{condition}': {insight}")

        logger.info(f"Fetched {len(insights)} insights from PubMed for condition: {condition}")
        return insights

    except Exception as e:
        logger.error(f"Error querying PubMed for condition {condition}: {str(e)}")
        return []

def query_semantic_scholar(condition, retmax=1):
    """
    Query Semantic Scholar for articles related to the given condition.
    Returns a list of insights with title, summary, URL, and relevance info.
    """
    try:
        # Semantic Scholar API endpoint
        api_url = "https://api.semanticscholar.org/graph/v1/paper/search"
        
        params = {
            "query": f"{condition} treatment OR management",
            "limit": retmax,
            "fields": "title,abstract,url,year,authors,venue,citationCount"
        }
        
        headers = {
            # Optional API key if you have registered one
            # "x-api-key": os.getenv('SEMANTIC_SCHOLAR_API_KEY')
        }
        
        logger.debug(f"Sending Semantic Scholar request for condition '{condition}' with params: {params}")
        response = requests.get(api_url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        results = response.json()
        
        insights = []
        
        if "data" in results:
            for paper in results["data"]:
                title_text = paper.get("title", "N/A")
                abstract_text = paper.get("abstract", "N/A")
                url = paper.get("url", "#")
                year = paper.get("year", "N/A")
                logger.debug(f"Semantic Scholar article title: {title_text}")
                logger.debug(f"Semantic Scholar article abstract: {abstract_text}")
                
                # Format authors
                authors = []
                if "authors" in paper:
                    authors = [author.get("name", "") for author in paper["authors"]]
                authors_text = ", ".join(authors) if authors else "N/A"
                logger.debug(f"Semantic Scholar article authors: {authors_text}")
                
                # Get citation count as a proxy for importance
                citation_count = paper.get("citationCount", 0)
                logger.debug(f"Semantic Scholar citation count: {citation_count}")
                
                # Compute relevance score with partial matching
                relevance_score = 0.0
                condition_words = condition.lower().split()
                logger.debug(f"Condition words for matching: {condition_words}")
                title_lower = title_text.lower()
                abstract_lower = abstract_text.lower()

                # Check for partial matches in title
                title_matches = sum(1 for word in condition_words if word in title_lower)
                if title_matches > 0:
                    title_weight = (title_matches / len(condition_words)) * 0.4  # Scale based on number of matching words
                    relevance_score += title_weight
                    logger.debug(f"Semantic Scholar title partial matches for '{condition}': {title_matches}/{len(condition_words)}. Added {title_weight:.2f} to relevance score")
                else:
                    logger.debug(f"No title partial matches for '{condition}' in '{title_lower}'")

                # Check for partial matches in abstract
                abstract_matches = sum(1 for word in condition_words if word in abstract_lower)
                if abstract_matches > 0:
                    abstract_weight = (abstract_matches / len(condition_words)) * 0.3  # Scale based on number of matching words
                    relevance_score += abstract_weight
                    logger.debug(f"Semantic Scholar abstract partial matches for '{condition}': {abstract_matches}/{len(condition_words)}. Added {abstract_weight:.2f} to relevance score")
                else:
                    logger.debug(f"No abstract partial matches for '{condition}' in '{abstract_lower}'")

                # Add weight for citation count (normalize to 0-0.3)
                citation_weight = min(citation_count / 200, 0.3)  # Cap at 200 citations for max weight
                relevance_score += citation_weight
                logger.debug(f"Semantic Scholar citation weight for '{condition}' (citation_count={citation_count}): Added {citation_weight} to relevance score")

                # Ensure a minimum score if the article was returned
                if relevance_score == 0.0:
                    relevance_score = 10.0  # Minimum score to avoid 0.0%
                logger.debug(f"No direct matches found, assigning minimum relevance score of 10.0")

                # Normalize to 0-100
                relevance_score = min(relevance_score * 100, 100)
                logger.debug(f"Semantic Scholar final relevance score for '{condition}': {relevance_score}")

                # Determine confidence level based on relevance score
                confidence = "Recommended"
                if relevance_score > 70:
                    confidence = "Highly Recommended"
                elif relevance_score > 40:
                    confidence = "Recommended"
                else:
                    confidence = "Relevant"
                logger.debug(f"Semantic Scholar confidence for '{condition}': {confidence}")
                
                # Create relevance tag
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
                    "raw_relevance_score": relevance_score  # Store raw score for sorting
                }
                insights.append(insight)
                logger.debug(f"Semantic Scholar insight for condition '{condition}': {insight}")
        
        logger.info(f"Fetched {len(insights)} insights from Semantic Scholar for condition: {condition}")
        return insights
        
    except Exception as e:
        logger.error(f"Error querying Semantic Scholar for condition {condition}: {str(e)}")
        return []

# Enhanced function to fetch related clinical guidelines
def query_clinical_guidelines(condition, retmax=1):
    """
    Query for clinical guidelines related to the given condition.
    Returns a list of guidelines with title, source, URL, and relevance info.
    """
    try:
        # For demonstration, we're using PubMed to find guidelines
        # In a production environment, you might want to use specialized API endpoints
        search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
        search_params = {
            "db": "pubmed",
            "term": f"{condition} clinical practice guideline OR consensus statement",
            "retmax": retmax,
            "sort": "relevance",
            "retmode": "json"
        }
        
        logger.debug(f"Sending guideline search request for condition '{condition}' with params: {search_params}")
        search_response = requests.get(search_url, params=search_params, timeout=10)
        search_response.raise_for_status()
        search_data = search_response.json()

        id_list = search_data.get("esearchresult", {}).get("idlist", [])
        logger.debug(f"Clinical guideline search returned article IDs for condition '{condition}': {id_list}")
        if not id_list:
            logger.warning(f"No clinical guidelines found for condition: {condition}")
            return []

        # Fetch guideline details
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
        guidelines = []

        for article in root.findall(".//PubmedArticle"):
            # Extract title
            title = article.find(".//ArticleTitle")
            title_text = title.text if title is not None else "N/A"
            
            # Extract abstract
            abstract = article.find(".//Abstract/AbstractText")
            abstract_text = abstract.text if abstract is not None else "N/A"
            
            # Extract PubMed ID
            pubmed_id = article.find(".//PMID")
            pubmed_id_text = pubmed_id.text if pubmed_id is not None else "N/A"
            
            # Construct URL
            url = f"https://pubmed.ncbi.nlm.nih.gov/{pubmed_id_text}/"
            
            # Extract authors and organizations
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
            
            # Extract organization or society if available
            journal_name = article.find(".//Journal/Title")
            organization = journal_name.text if journal_name is not None else "Medical Journal"
            
            # Extract publication year
            pub_date = article.find(".//PubDate/Year")
            year = pub_date.text if pub_date is not None else "N/A"
            
            # Compute relevance and determine if it's a guideline
            is_guideline = False
            guideline_terms = ["guideline", "consensus", "practice parameter", "recommendation", "position statement"]
            title_lower = title_text.lower()
            
            for term in guideline_terms:
                if term in title_lower:
                    is_guideline = True
                    break
            
            if not is_guideline:
                abstract_lower = abstract_text.lower()
                for term in guideline_terms:
                    if term in abstract_lower:
                        is_guideline = True
                        break
            
            # Only include if it appears to be a guideline
            if is_guideline:
                # Format a cleaner summary
                summary = abstract_text[:500] + "..." if len(abstract_text) > 500 else abstract_text
                
                guideline = {
                    "title": title_text,
                    "summary": summary,
                    "url": url,
                    "source": organization,
                    "authors": ", ".join(authors) if authors else "N/A",
                    "year": year,
                    "content_type": "Clinical Guideline",
                    "relevance_tag": f"Clinical Practice Guideline for {condition}",
                    "confidence": "Highly Recommended",
                    "relevance_score": "95.0%",  # Guidelines are always highly relevant
                    "raw_relevance_score": 95.0  # For sorting purposes
                }
                
                guidelines.append(guideline)
                logger.debug(f"Found clinical guideline for '{condition}': {title_text}")
        
        logger.info(f"Fetched {len(guidelines)} clinical guidelines for condition: {condition}")
        return guidelines
    
    except Exception as e:
        logger.error(f"Error querying clinical guidelines for condition {condition}: {str(e)}")
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
        email = request.args.get('email')
        tenant_id = request.args.get('tenantId', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)  # FIXED: Pass email parameter

        logger.debug(f"Request parameters - patient_id: {patient_id}, visit_id: {visit_id}, conditions: {conditions}, tenant_id: {tenant_id}")

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
        diagnoses = []
        parts = conditions.split("Alternative diagnoses:")
        primary_part = parts[0].strip()
        primary_diagnosis = primary_part.split('.')[0].replace("Primary diagnosis:", "").strip()
        if primary_diagnosis:
            diagnoses.append(primary_diagnosis)

        if len(parts) > 1:
            alternatives = parts[1].strip()
            alt_diagnoses = re.split(r'\d+\)', alternatives)
            for alt in alt_diagnoses:
                alt = alt.strip()
                if alt:
                    alt = alt.rstrip('.,').strip()
                    diagnoses.append(alt)

        logger.info(f"Parsed diagnoses for patient_id {patient_id}: {diagnoses}")

        if not diagnoses:
            logger.warning(f"No diagnoses parsed for patient_id: {patient_id}, conditions: {conditions}")
            return jsonify({
                "patient_id": patient_id,
                "visit_id": visit_id,
                "insights": []
            }), 200

        # Query sources for each diagnosis
        all_insights = []
        for diagnosis in diagnoses:
            logger.debug(f"Querying references for diagnosis: {diagnosis}")
            
            # First try to get clinical guidelines (high priority)
            guidelines = query_clinical_guidelines(diagnosis, retmax=1)
            logger.debug(f"Clinical guidelines for '{diagnosis}': {guidelines}")
            all_insights.extend(guidelines)
            
            # Then get PubMed articles
            pubmed_insights = query_pubmed(diagnosis, retmax=2)
            logger.debug(f"PubMed insights for '{diagnosis}': {pubmed_insights}")
            all_insights.extend(pubmed_insights)
            
            # Finally get Semantic Scholar articles
            semantic_insights = query_semantic_scholar(diagnosis, retmax=1)
            logger.debug(f"Semantic Scholar insights for '{diagnosis}': {semantic_insights}")
            all_insights.extend(semantic_insights)

        # Sort insights by raw relevance score and limit to top 3
        def get_relevance_score(insight):
            return insight.get("raw_relevance_score", 0.0)

        logger.debug(f"All insights before sorting: {all_insights}")
        all_insights.sort(key=get_relevance_score, reverse=True)
        # Remove the raw_relevance_score field from the final output
        for insight in all_insights:
            insight.pop("raw_relevance_score", None)
        all_insights = all_insights[:3]  # Limit to top 3 insights

        if not all_insights:
            logger.warning(f"No insights found for patient_id: {patient_id}, visit_id: {visit_id}, diagnoses: {diagnoses}")
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
        logger.info(f"Final response for patient_id {patient_id}: {json.dumps(result, indent=2)}")
        
        # Store insights in MedoraReferences with tenantID
        try:
            for insight in all_insights:
                insight_id = str(uuid.uuid4())
                dynamodb.put_item(
                    TableName='MedoraReferences',
                    Item={
                        'id': {'S': insight_id},
                        'patient_id': {'S': patient_id},
                        'visit_id': {'S': visit_id}, 
                        'references': {'S': json.dumps(insight)},
                        'ttl': {'N': str(int(datetime.now().timestamp()) + 30 * 24 * 60 * 60)},
                        'tenantID': {'S': tenant_id}  # Added tenantID
                    }
                )
                logger.info(f"Stored reference {insight_id} for patient {patient_id}, tenant {tenant_id}")
        except Exception as e:
            logger.error(f"Error storing references in DynamoDB: {str(e)}")
            # Continue with response even if storage fails
        
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Unexpected error in /get-insights: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

# Add a script to fix existing MongoDB patient records that might be missing tenantId
@app.route('/api/admin/fix-patients', methods=['POST'])
def fix_patient_tenant_ids():
    try:
        # This endpoint should be protected in production!
        data = request.get_json()
        admin_key = data.get('admin_key')
        if admin_key != "medora_admin_key_2025":  # Simple protection for demo purposes
            return jsonify({"success": False, "error": "Unauthorized"}), 401
            
        default_tenant = data.get('default_tenant', 'doctor@allergyaffiliates.com')
        
        # Update all patients without a tenantId
        result = patients_collection.update_many(
            {"tenantId": {"$exists": False}},
            {"$set": {"tenantId": default_tenant}}
        )
        
        # Update all transcripts without a tenantId
        transcript_result = transcripts_collection.update_many(
            {"tenantId": {"$exists": False}},
            {"$set": {"tenantId": default_tenant}}
        )
        
        # Update all visits without a tenantId
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
        # Get request details for debugging
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
        tenant_id = validate_tenant_id(tenant_id, email)  # Use validated tenant_id
        
        logger.info(f"ALLERGENIQ: Request params - patient_id: {patient_id}, visit_id: {visit_id}, tenant_id: {tenant_id}, email: {email}")
        
        if not patient_id or not visit_id:
            logger.error(f"ALLERGENIQ: Missing required parameters: patient_id={patient_id}, visit_id={visit_id}")
            return jsonify({
                "success": True,  # Return success with default data instead of error
                "patient_id": patient_id or "unknown",
                "visit_id": visit_id or "unknown",
                "patient_name": "Unknown Patient",
                "patient_age": 37,
                "visit_date": datetime.now().isoformat().split('T')[0],
                "profile": {
                    "symptomData": get_default_symptom_data(),
                    "medicationHistory": get_default_medication_history(),
                    "allergenData": get_default_allergen_data(),
                    "summary": get_default_summary()
                },
                "error": "Missing patient_id or visit_id"
            }), 200  # Return 200 even for invalid params
            
        # Set a timeout for database operations
        request_timeout = 5  # 5 second timeout
        start_time = time.time()
            
        # Get SOAP notes from DynamoDB with timeout
        soap_notes = None
        try:
            soap_notes = get_soap_notes(patient_id, visit_id, tenant_id)
            logger.info(f"ALLERGENIQ: SOAP notes retrieval result: {soap_notes is not None}")
        except Exception as e:
            logger.error(f"ALLERGENIQ: Error retrieving SOAP notes: {str(e)}")
        
        # Check timeout
        if time.time() - start_time > request_timeout:
            logger.warning(f"ALLERGENIQ: SOAP notes retrieval timeout exceeded")
            soap_notes = None
            
        if not soap_notes:
            logger.warning(f"ALLERGENIQ: SOAP notes not found or timed out for patient {patient_id}, visit {visit_id}")
            # Use default data structure for SOAP notes
            soap_notes = {
                "patient_history": {
                    "chief_complaint": "No data available",
                    "history_of_present_illness": "No data available",
                    "allergies": "No data available"
                },
                "differential_diagnosis": "No data available",
                "plan_of_care": "No data available"
            }
            
        # Get patient insights from DynamoDB with timeout check
        patient_insights = []
        if time.time() - start_time <= request_timeout:
            try:
                patient_insights = get_patient_insights(patient_id, tenant_id)
                logger.info(f"ALLERGENIQ: Retrieved {len(patient_insights) if patient_insights else 0} patient insights")
            except Exception as e:
                logger.error(f"ALLERGENIQ: Error retrieving patient insights: {str(e)}")
        else:
            logger.warning(f"ALLERGENIQ: Skipping patient insights due to timeout")
            
        # Process transcript for allergy data with timeout check
        transcript_data = None
        if time.time() - start_time <= request_timeout:
            try:
                # Try to find the transcript in MongoDB
                transcript = transcripts_collection.find_one({
                    "patientId": patient_id, 
                    "visitId": visit_id,
                    "tenantId": tenant_id
                })
                
                if transcript and "transcript" in transcript:
                    transcript_data = process_transcript_for_allergeniq(transcript["transcript"])
                    logger.info("ALLERGENIQ: Successfully processed transcript for allergen data")
                else:
                    logger.warning("ALLERGENIQ: No transcript found for processing")
            except Exception as e:
                logger.error(f"ALLERGENIQ: Error processing transcript: {str(e)}")
        else:
            logger.warning(f"ALLERGENIQ: Skipping transcript processing due to timeout")
        
        # Structure data for AllergenIQ profile - use fallback mechanisms if any component fails
        try:
            profile_data = structure_allergeniq_data(soap_notes, patient_insights, transcript_data)
        except Exception as e:
            logger.error(f"ALLERGENIQ: Error structuring profile data: {str(e)}")
            profile_data = {
                "symptomData": get_default_symptom_data(),
                "medicationHistory": get_default_medication_history(),
                "allergenData": get_default_allergen_data(),
                "summary": get_default_summary()
            }
        
        # Get patient name and age from MongoDB with timeout check
        patient_name = "Unknown Patient"
        patient_age = None
        if time.time() - start_time <= request_timeout:
            try:
                # Try looking up by ObjectId first
                try:
                    patient_doc = patients_collection.find_one({"_id": ObjectId(patient_id), "tenantId": tenant_id})
                except:
                    # If that fails, try looking up by name field
                    patient_doc = patients_collection.find_one({"name": patient_id, "tenantId": tenant_id})
                    
                if patient_doc:
                    patient_name = patient_doc.get("name", "Unknown Patient")
                    patient_age = patient_doc.get("age")
                    logger.info(f"ALLERGENIQ: Found patient: {patient_name}, age: {patient_age}")
                else:
                    logger.warning(f"ALLERGENIQ: Patient not found in MongoDB: {patient_id}")
            except Exception as e:
                logger.error(f"ALLERGENIQ: Error retrieving patient details: {str(e)}")
        else:
            logger.warning(f"ALLERGENIQ: Skipping patient details retrieval due to timeout")
        
        # Get visit date from visits collection with timeout check
        visit_date = datetime.now().isoformat().split('T')[0]
        if time.time() - start_time <= request_timeout:
            try:
                visit_doc = visits_collection.find_one({"visitId": visit_id, "tenantId": tenant_id})
                if visit_doc and "startTime" in visit_doc:
                    visit_date = visit_doc["startTime"].split('T')[0]
                    logger.info(f"ALLERGENIQ: Found visit date: {visit_date}")
                else:
                    logger.warning(f"ALLERGENIQ: Visit not found in MongoDB: {visit_id}")
            except Exception as e:
                logger.error(f"ALLERGENIQ: Error retrieving visit date: {str(e)}")
        else:
            logger.warning(f"ALLERGENIQ: Skipping visit date retrieval due to timeout")
        
        # Return the response with full profile data
        result = {
            "success": True,
            "patient_id": patient_id,
            "visit_id": visit_id,
            "patient_name": patient_name,
            "patient_age": patient_age if patient_age is not None else 37,  # Default age if not found
            "visit_date": visit_date,
            "profile": profile_data
        }
        
        logger.info("ALLERGENIQ: Successfully generated profile data")
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"ALLERGENIQ: Error generating AllergenIQ profile: {str(e)}")
        # Always return a valid response with default data
        default_profile = {
            "success": True,
            "patient_id": patient_id if 'patient_id' in locals() else "unknown",
            "visit_id": visit_id if 'visit_id' in locals() else "unknown",
            "patient_name": "Error Patient",
            "patient_age": 37,
            "visit_date": datetime.now().isoformat().split('T')[0],
            "profile": {
                "symptomData": get_default_symptom_data(),
                "medicationHistory": get_default_medication_history(),
                "allergenData": get_default_allergen_data(),
                "summary": get_default_summary()
            },
            "error": str(e)
        }
        return jsonify(default_profile), 200  # Return 200 with default data

if __name__ == '__main__':
    # At startup, ensure MongoDB indexes exist
    try:
        patients_collection.create_index([("tenantId", 1)])
        transcripts_collection.create_index([("tenantId", 1), ("patientId", 1)])
        visits_collection.create_index([("tenantId", 1), ("patientId", 1)])
        logger.info("MongoDB indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating MongoDB indexes: {str(e)}")
        
    app.run(host='0.0.0.0', port=PORT, debug=False)
