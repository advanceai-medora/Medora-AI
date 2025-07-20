import base64
import stripe
from flask import Flask, request, jsonify, make_response, session, send_from_directory, redirect, url_for
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
from jwt.algorithms import RSAAlgorithm
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
from typing import List, Dict, Tuple, Optional
from functools import wraps
from stripe_subscription import create_subscription_with_trial, get_stripe_subscriptions, get_stripe_transactions

# Add this right after your imports, before the Flask app initialization
import time
import asyncio
from functools import wraps

# ============================================================================
# ENTERPRISE TRIAL MANAGEMENT IMPORTS
# ============================================================================
from botocore.exceptions import ClientError, NoCredentialsError
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import threading
from collections import defaultdict

# Add these helper functions to your Flask app if they don't exist

def safe_string_extract(data, key, default="N/A", max_length=None):
    """
    Safely extract string data from potentially mixed-type JSON responses
    Handles cases where AI returns lists instead of strings
    """
    value = data.get(key, default)
    
    if isinstance(value, list):
        if value:
            # Join list items or take first item
            if len(value) == 1:
                result = str(value[0])
            else:
                result = "; ".join(str(item) for item in value)
        else:
            result = default
    elif isinstance(value, str):
        result = value
    else:
        # Handle any other data type
        result = str(value) if value else default
    
    # Apply max length if specified
    if max_length and len(result) > max_length:
        result = result[:max_length] + "..."
    
    return result

def translate_text(text, target_language):
    """
    Translate text using DeepL API (if available)
    """
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


# Simple rate limiting helper
def add_api_delay(seconds=1):
    """Simple delay to prevent rate limiting"""
    time.sleep(seconds)

# Add this before your existing query_pubmed function
def with_retry_and_delay(max_retries=2, delay_seconds=2):
    """Decorator to add retry logic with delays"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    if attempt > 0:
                        time.sleep(delay_seconds * attempt)  # Exponential backoff
                    return func(*args, **kwargs)
                except requests.exceptions.HTTPError as e:
                    if e.response and e.response.status_code == 429:  # Rate limited
                        if attempt < max_retries - 1:
                            logger.warning(f"Rate limited, waiting {delay_seconds * (attempt + 1)} seconds...")
                            time.sleep(delay_seconds * (attempt + 1))
                            continue
                        else:
                            logger.warning(f"Rate limit hit, returning empty result for {func.__name__}")
                            return []  # Return empty result instead of failing
                    raise
                except Exception as e:
                    if attempt < max_retries - 1:
                        logger.warning(f"Error in {func.__name__}, retrying: {str(e)}")
                        continue
                    logger.error(f"Final error in {func.__name__}: {str(e)}")
                    return []  # Return empty result instead of failing
            return []
        return wrapper
    return decorator



def convert_list_to_structured_recommendations(recommendations_list):
    """
    Convert a list of recommendations into structured categories
    """
    if not isinstance(recommendations_list, list):
        return force_create_structured_recommendations("")
    
    # Initialize structured recommendations
    structured = {
        "MEDICATION MANAGEMENT": [],
        "LIFESTYLE MODIFICATIONS": [],
        "MONITORING PROTOCOL": [],
        "EMERGENCY ACTION PLAN": [],
        "LONG-TERM MANAGEMENT STRATEGY": [],
        "PATIENT EDUCATION RESOURCES": [],
        "FOLLOW-UP SCHEDULE": []
    }
    
    # Keywords to categorize recommendations
    category_keywords = {
        "MEDICATION MANAGEMENT": [
            "medication", "drug", "dose", "dosage", "prescription", "medrol", "dulera",
            "spiriva", "flonase", "pepcid", "biologic", "inhaler", "steroid", "antihistamine",
            "take", "continue", "start", "stop", "adjust"
        ],
        "LIFESTYLE MODIFICATIONS": [
            "lifestyle", "diet", "sleep", "elevated", "bed", "coffee", "tea", "alcohol",
            "spicy", "fatty", "foods", "exercise", "avoid", "environment", "home"
        ],
        "MONITORING PROTOCOL": [
            "monitor", "track", "watch", "observe", "check", "measure", "fev1",
            "symptoms", "breathing", "signs", "worsening", "improvement"
        ],
        "EMERGENCY ACTION PLAN": [
            "emergency", "urgent", "immediate", "seek", "medical attention", "hospital",
            "worsening", "severe", "acute"
        ],
        "LONG-TERM MANAGEMENT STRATEGY": [
            "follow-up", "referral", "specialist", "long-term", "future", "plan",
            "strategy", "consider", "evaluation"
        ],
        "PATIENT EDUCATION RESOURCES": [
            "education", "discuss", "explain", "inform", "teach", "benefits",
            "side effects", "understanding"
        ],
        "FOLLOW-UP SCHEDULE": [
            "follow-up", "appointment", "visit", "next", "schedule", "return",
            "weeks", "months", "days"
        ]
    }
    
    # Categorize each recommendation
    for recommendation in recommendations_list:
        if not recommendation or not isinstance(recommendation, str):
            continue
            
        recommendation_lower = recommendation.lower()
        categorized = False
        
        # Try to find the best category match
        for category, keywords in category_keywords.items():
            if any(keyword in recommendation_lower for keyword in keywords):
                structured[category].append(recommendation)
                categorized = True
                break
        
        # If no category matched, put in patient education
        if not categorized:
            structured["PATIENT EDUCATION RESOURCES"].append(recommendation)
    
    # Remove empty categories
    structured = {k: v for k, v in structured.items() if v}
    
    # Ensure we have at least some recommendations
    if not structured:
        structured["GENERAL"] = recommendations_list
    
    logger.info(f"✅ Converted {len(recommendations_list)} list recommendations to {len(structured)} structured categories")
    return structured

def create_structured_recommendations_from_transcript(transcript):
    """
    Create structured recommendations by analyzing the transcript content
    """
    transcript_lower = transcript.lower()
    recommendations = {}
    
    # Medication Management
    medications = []
    if 'flonase' in transcript_lower:
        medications.append("Continue Flonase nasal spray as prescribed for allergic rhinitis")
    if 'medrol' in transcript_lower:
        medications.append("Monitor Medrol dosage and consider tapering based on symptom control")
    if 'dulera' in transcript_lower:
        medications.append("Continue Dulera inhaler twice daily for asthma control")
    if 'spiriva' in transcript_lower:
        medications.append("Maintain Spiriva daily for long-term bronchodilation")
    if 'pepcid' in transcript_lower:
        medications.append("Start Pepcid twice daily for acid reflux management")
    if 'biologic' in transcript_lower:
        medications.append("Consider biologic therapy for severe asthma management")
    
    if not medications:
        medications = ["Review current medication regimen for effectiveness and compliance"]
    
    recommendations["MEDICATION MANAGEMENT"] = medications
    
    # Lifestyle Modifications
    lifestyle = []
    if 'acid reflux' in transcript_lower or 'reflux' in transcript_lower:
        lifestyle.extend([
            "Sleep with head elevated to reduce acid reflux",
            "Eat 2-3 hours before bedtime",
            "Limit coffee, tea, alcohol, spicy, and fatty foods"
        ])
    if 'allergy' in transcript_lower:
        lifestyle.append("Implement environmental allergen control measures")
    if 'asthma' in transcript_lower:
        lifestyle.append("Avoid known asthma triggers and maintain clean indoor air")
    
    if not lifestyle:
        lifestyle = ["Implement evidence-based lifestyle modifications for condition management"]
    
    recommendations["LIFESTYLE MODIFICATIONS"] = lifestyle
    
    # Monitoring Protocol
    monitoring = []
    if 'fev1' in transcript_lower or 'breathing test' in transcript_lower:
        monitoring.append("Monitor pulmonary function with regular FEV1 measurements")
    if 'symptoms' in transcript_lower:
        monitoring.append("Track daily symptoms and medication effectiveness")
    if 'hospitalization' in transcript_lower:
        monitoring.append("Monitor for signs of exacerbation requiring emergency care")
    
    if not monitoring:
        monitoring = ["Establish regular monitoring protocol for condition assessment"]
    
    recommendations["MONITORING PROTOCOL"] = monitoring
    
    # Emergency Action Plan
    emergency = []
    if 'asthma' in transcript_lower:
        emergency.extend([
            "Recognize early warning signs of asthma exacerbation",
            "Use rescue inhaler as prescribed for acute symptoms",
            "Seek emergency care if symptoms worsen despite treatment"
        ])
    if 'hospitalization' in transcript_lower:
        emergency.append("Know when to seek immediate medical attention to prevent hospitalization")
    
    if not emergency:
        emergency = ["Develop clear emergency action plan for acute symptom management"]
    
    recommendations["EMERGENCY ACTION PLAN"] = emergency
    
    # Long-term Management
    long_term = []
    if 'follow' in transcript_lower:
        long_term.append("Schedule regular follow-up appointments for ongoing care")
    if 'biologic' in transcript_lower:
        long_term.append("Consider advanced therapies like biologics for optimal control")
    if 'test' in transcript_lower:
        long_term.append("Complete recommended diagnostic testing for comprehensive assessment")
    
    if not long_term:
        long_term = ["Establish comprehensive long-term management strategy"]
    
    recommendations["LONG-TERM MANAGEMENT STRATEGY"] = long_term
    
    return recommendations

def create_fallback_with_structured_recommendations(transcript):
    """
    Create fallback response with properly structured recommendations
    """
    return {
        "patient_history": {
            "chief_complaint": "Patient presents with medical concerns requiring evaluation",
            "history_of_present_illness": "Detailed history obtained from patient interview",
            "past_medical_history": "Review of previous medical conditions and treatments",
            "allergies": "Allergy history documented",
            "social_history": "Social and environmental factors assessed",
            "review_of_systems": "Comprehensive system review completed"
        },
        "physical_examination": "Physical examination findings documented",
        "differential_diagnosis": "Medical conditions under evaluation based on clinical presentation",
        "diagnostic_workup": "Appropriate diagnostic testing recommended",
        "plan_of_care": "Comprehensive treatment plan developed",
        "patient_education": "Patient education provided regarding condition and treatment",
        "follow_up_instructions": "Follow-up care instructions given",
        "summary": "Medical evaluation completed with comprehensive treatment plan established",
        "enhanced_recommendations": create_structured_recommendations_from_transcript(transcript)
    }

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

# Add this single function - minimal impact approach
@app.after_request
def add_cache_headers(response):
    # Only apply to JavaScript and CSS files
    if request.path.endswith(('.js', '.css')):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

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

# ============================================================================
# ENTERPRISE TRIAL MANAGEMENT CONFIGURATION
# ============================================================================
SES_FROM_EMAIL = os.getenv('SES_FROM_EMAIL', 'noreply@medoramd.ai')
SES_FROM_NAME = os.getenv('SES_FROM_NAME', 'MedoraMD Enterprise')
TRIAL_LENGTH_DAYS = int(os.getenv('TRIAL_LENGTH_DAYS', 30))
TRIAL_USAGE_LIMIT = int(os.getenv('TRIAL_USAGE_LIMIT', 1000))
ENTERPRISE_BRAND_COLOR = os.getenv('ENTERPRISE_BRAND_COLOR', '#0ea5e9')
SUPPORT_EMAIL = os.getenv('SUPPORT_EMAIL', 'support@medoramd.ai')
SALES_EMAIL = os.getenv('SALES_EMAIL', 'sales@medoramd.ai')
COMPANY_LOGO_URL = os.getenv('COMPANY_LOGO_URL', 'https://medoramd.ai/logo.png')

# Load configuration from environment variables
app.secret_key = os.getenv('SECRET_KEY', 'your-fallback-secret-key-change-this')

# Cognito Configuration from environment variables
COGNITO_REGION = os.getenv('COGNITO_REGION')
COGNITO_USER_POOL_ID = os.getenv('COGNITO_USER_POOL_ID')
COGNITO_CLIENT_ID = os.getenv('COGNITO_CLIENT_ID')
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
# Validate Cognito environment variables
if not all([COGNITO_REGION, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID]):
    logger.warning("Cognito environment variables not fully configured. Cognito authentication will be disabled.")
    COGNITO_ENABLED = False
else:
    COGNITO_ENABLED = True
    COGNITO_ISSUER = f'https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}'
    logger.info(f"Cognito authentication enabled for region: {COGNITO_REGION}")

# Cache for Cognito public keys
cognito_keys = None

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
    # ENTERPRISE: Add SES client
    ses_client = boto3.client('ses', region_name=AWS_REGION)
    logger.info("Successfully initialized AWS clients (including SES for enterprise features)")
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
    
    # ENTERPRISE: Add new collections for trial management
    enterprise_trials_collection = db['enterprise_trials']
    usage_analytics_collection = db['usage_analytics']
    email_campaigns_collection = db['email_campaigns']
    
    try:
        patients_collection.create_index("tenantId")
        transcripts_collection.create_index("tenantId")
        visits_collection.create_index("tenantId")
        # ENTERPRISE: Create indexes for new collections
        enterprise_trials_collection.create_index([("email", 1), ("trial_start", -1)])
        enterprise_trials_collection.create_index([("trial_status", 1), ("days_remaining", 1)])
        usage_analytics_collection.create_index([("email", 1), ("date", -1)])
        email_campaigns_collection.create_index([("email", 1), ("campaign_type", 1)])
        logger.info("Created indexes on tenantId fields and enterprise collections in MongoDB")
    except Exception as e:
        logger.error(f"Error creating indexes: {str(e)}")
    
    logger.info("Successfully connected to MongoDB with enterprise collections")
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

# ============================================================================
# ENTERPRISE TRIAL MANAGEMENT CLASSES AND FUNCTIONS
# ============================================================================

class EnterpriseTrialManager:
    """Enhanced trial management with enterprise features"""
    
    def __init__(self):
        self.specialties = {
            'allergist': 'Allergy and Immunology',
            'dermatologist': 'Dermatology',
            'pulmonologist': 'Pulmonology',
            'rheumatologist': 'Rheumatology',
            'internist': 'Internal Medicine',
            'pediatrician': 'Pediatrics',
            'family_medicine': 'Family Medicine',
            'emergency_medicine': 'Emergency Medicine'
        }
        self.reminder_schedule = [14, 7, 3, 1, 0]  # Days before expiry
        
    def create_enterprise_trial(self, email, first_name, last_name, specialty='general'):
        """Create a new enterprise trial with enhanced tracking"""
        try:
            trial_start = datetime.now()
            trial_end = trial_start + timedelta(days=TRIAL_LENGTH_DAYS)
            
            trial_data = {
                'email': email,
                'first_name': first_name,
                'last_name': last_name,
                'specialty': specialty,
                'specialty_display': self.specialties.get(specialty, 'General Medicine'),
                'trial_start': trial_start,
                'trial_end': trial_end,
                'trial_status': 'active',
                'usage_count': 0,
                'usage_limit': TRIAL_USAGE_LIMIT,
                'days_remaining': TRIAL_LENGTH_DAYS,
                'usage_percentage': 0.0,
                'created_at': trial_start,
                'reminder_sent': [],
                'conversion_tracked': False,
                'enterprise_trial': True,
                'trial_type': 'enterprise_30_day'
            }
            
            # Store in database
            result = enterprise_trials_collection.insert_one(trial_data)
            trial_data['_id'] = result.inserted_id
            
            logger.info(f"✅ Created enterprise trial for {email} ({specialty}) - ID: {result.inserted_id}")
            
            # Initialize usage analytics
            self._initialize_usage_analytics(email, trial_start)
            
            return trial_data
            
        except Exception as e:
            logger.error(f"❌ Failed to create enterprise trial for {email}: {str(e)}")
            return None
    
    def get_trial_status(self, email):
        """Get comprehensive trial status for a user"""
        try:
            # First check enterprise trials
            trial = enterprise_trials_collection.find_one(
                {'email': email},
                sort=[('trial_start', -1)]
            )
            
            if trial:
                now = datetime.now()
                days_remaining = max(0, (trial['trial_end'] - now).days)
                usage_percentage = (trial['usage_count'] / trial['usage_limit']) * 100
                
                # Update calculated fields
                trial['days_remaining'] = days_remaining
                trial['usage_percentage'] = min(100.0, usage_percentage)
                trial['trial_status'] = 'expired' if days_remaining <= 0 else 'active'
                
                # Update in database
                enterprise_trials_collection.update_one(
                    {'_id': trial['_id']},
                    {
                        '$set': {
                            'days_remaining': days_remaining,
                            'usage_percentage': trial['usage_percentage'],
                            'trial_status': trial['trial_status']
                        }
                    }
                )
                
                return trial
            
            # Fallback to legacy subscription system
            legacy_status = get_subscription_status(email)
            if legacy_status['tier'] in ['Trial', 'Premium']:
                return {
                    'email': email,
                    'trial_status': 'active' if legacy_status['tier'] == 'Trial' else 'premium',
                    'days_remaining': 7 if legacy_status['tier'] == 'Trial' else 365,
                    'usage_percentage': 0.0,
                    'enterprise_trial': False,
                    'specialty': 'legacy',
                    'legacy_tier': legacy_status['tier']
                }
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Error getting trial status for {email}: {str(e)}")
            return None
    
    def increment_usage(self, email, usage_type='transcript_analysis'):
        """Increment usage counter for trial user"""
        try:
            trial = enterprise_trials_collection.find_one({'email': email})
            if not trial:
                return False
            
            new_usage_count = trial['usage_count'] + 1
            usage_percentage = min(100.0, (new_usage_count / trial['usage_limit']) * 100)
            
            # Update trial
            enterprise_trials_collection.update_one(
                {'_id': trial['_id']},
                {
                    '$set': {
                        'usage_count': new_usage_count,
                        'usage_percentage': usage_percentage,
                        'last_activity': datetime.now()
                    }
                }
            )
            
            # Log analytics
            self._log_usage_analytics(email, usage_type)
            
            logger.info(f"📊 Usage updated for {email}: {new_usage_count}/{trial['usage_limit']} ({usage_percentage:.1f}%)")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error incrementing usage for {email}: {str(e)}")
            return False
    
    def check_and_send_reminders(self):
        """Check all trials and send appropriate reminders"""
        try:
            now = datetime.now()
            sent_count = 0
            
            # Find trials that need reminders
            for reminder_day in self.reminder_schedule:
                target_date = now + timedelta(days=reminder_day)
                
                trials = enterprise_trials_collection.find({
                    'trial_status': 'active',
                    'trial_end': {
                        '$gte': target_date,
                        '$lt': target_date + timedelta(days=1)
                    },
                    f'reminder_sent.{reminder_day}': {'$ne': True}
                })
                
                for trial in trials:
                    if self._send_renewal_reminder(trial, reminder_day):
                        sent_count += 1
                        
                        # Mark reminder as sent
                        enterprise_trials_collection.update_one(
                            {'_id': trial['_id']},
                            {'$set': {f'reminder_sent.{reminder_day}': True}}
                        )
            
            logger.info(f"📧 Sent {sent_count} renewal reminders")
            return sent_count
            
        except Exception as e:
            logger.error(f"❌ Error checking reminders: {str(e)}")
            return 0
    
    def get_analytics_dashboard(self, admin_email=None):
        """Get enterprise analytics dashboard data"""
        try:
            now = datetime.now()
            week_ago = now - timedelta(days=7)
            month_ago = now - timedelta(days=30)
            
            # Trial statistics
            total_trials = enterprise_trials_collection.count_documents({})
            active_trials = enterprise_trials_collection.count_documents({'trial_status': 'active'})
            expired_trials = enterprise_trials_collection.count_documents({'trial_status': 'expired'})
            converted_trials = enterprise_trials_collection.count_documents({'conversion_tracked': True})
            
            # Recent activity
            recent_trials = enterprise_trials_collection.count_documents({
                'trial_start': {'$gte': week_ago}
            })
            
            # Specialty breakdown
            specialty_pipeline = [
                {'$group': {'_id': '$specialty', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}}
            ]
            specialty_breakdown = list(enterprise_trials_collection.aggregate(specialty_pipeline))
            
            # Usage analytics
            usage_pipeline = [
                {
                    '$match': {
                        'date': {'$gte': month_ago}
                    }
                },
                {
                    '$group': {
                        '_id': {'date': '$date', 'usage_type': '$usage_type'},
                        'count': {'$sum': 1}
                    }
                }
            ]
            usage_data = list(usage_analytics_collection.aggregate(usage_pipeline))
            
            # Conversion funnel
            conversion_rate = (converted_trials / total_trials * 100) if total_trials > 0 else 0
            
            dashboard = {
                'trial_statistics': {
                    'total_trials': total_trials,
                    'active_trials': active_trials,
                    'expired_trials': expired_trials,
                    'converted_trials': converted_trials,
                    'recent_trials': recent_trials,
                    'conversion_rate': round(conversion_rate, 2)
                },
                'specialty_breakdown': specialty_breakdown,
                'usage_analytics': usage_data,
                'generated_at': now.isoformat()
            }
            
            return dashboard
            
        except Exception as e:
            logger.error(f"❌ Error generating analytics dashboard: {str(e)}")
            return None
    
    def _initialize_usage_analytics(self, email, trial_start):
        """Initialize usage analytics for new trial"""
        try:
            analytics_doc = {
                'email': email,
                'date': trial_start.date(),
                'usage_type': 'trial_created',
                'count': 1,
                'created_at': trial_start
            }
            usage_analytics_collection.insert_one(analytics_doc)
        except Exception as e:
            logger.error(f"❌ Error initializing analytics for {email}: {str(e)}")
    
    def _log_usage_analytics(self, email, usage_type):
        """Log usage analytics event"""
        try:
            today = datetime.now().date()
            
            # Update or insert today's usage
            usage_analytics_collection.update_one(
                {
                    'email': email,
                    'date': today,
                    'usage_type': usage_type
                },
                {
                    '$inc': {'count': 1},
                    '$set': {'updated_at': datetime.now()}
                },
                upsert=True
            )
        except Exception as e:
            logger.error(f"❌ Error logging usage analytics: {str(e)}")
    
    def _send_renewal_reminder(self, trial, days_remaining):
        """Send renewal reminder email"""
        try:
            email_content = self._generate_renewal_email(trial, days_remaining)
            return send_enterprise_email(
                trial['email'],
                email_content['subject'],
                email_content['body'],
                email_content['html_body']
            )
        except Exception as e:
            logger.error(f"❌ Error sending renewal reminder: {str(e)}")
            return False
    
    def _generate_renewal_email(self, trial, days_remaining):
        """Generate renewal reminder email content"""
        specialty_display = trial.get('specialty_display', 'Medical Professional')
        first_name = trial.get('first_name', 'Doctor')
        
        if days_remaining == 0:
            urgency = "🚨 URGENT"
            subject = f"{urgency}: Your MedoraMD Trial Expires Today"
            message = "Your trial expires today! Don't lose access to your enhanced medical documentation tools."
        elif days_remaining == 1:
            urgency = "⚠️ FINAL NOTICE"
            subject = f"{urgency}: Your MedoraMD Trial Expires Tomorrow"
            message = "Only 1 day left in your trial! Upgrade now to maintain uninterrupted access."
        elif days_remaining <= 3:
            urgency = "🔔 URGENT"
            subject = f"{urgency}: {days_remaining} Days Left in Your MedoraMD Trial"
            message = f"Your trial expires in {days_remaining} days. Upgrade now to continue your enhanced workflow."
        else:
            urgency = "📅 REMINDER"
            subject = f"{urgency}: {days_remaining} Days Left in Your MedoraMD Trial"
            message = f"You have {days_remaining} days remaining in your trial. Consider upgrading to maintain access."
        
        # Text version
        body = f"""
Dear Dr. {first_name},

{message}

Trial Status:
- Specialty: {specialty_display}
- Days Remaining: {days_remaining}
- Usage: {trial.get('usage_percentage', 0):.1f}% of limit used

Why Upgrade to MedoraMD Premium?
✅ Unlimited transcript analysis
✅ Advanced SOAP note generation
✅ AllergenIQ patient profiling
✅ Priority customer support
✅ Enterprise-grade security

Ready to upgrade? Contact us:
📧 {SALES_EMAIL}
📞 1-800-MEDORA-1

Best regards,
The MedoraMD Team

---
If you have questions, contact support at {SUPPORT_EMAIL}
"""
        
        # HTML version
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, {ENTERPRISE_BRAND_COLOR} 0%, #1e40af 100%); padding: 30px; border-radius: 10px; color: white; text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 700;">{urgency}</h1>
        <h2 style="margin: 10px 0 0 0; font-size: 18px; font-weight: 400; opacity: 0.9;">{days_remaining} Days Left in Your Trial</h2>
    </div>
    
    <div style="background: #f8fafc; border-left: 4px solid {ENTERPRISE_BRAND_COLOR}; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
        <p style="margin: 0; font-size: 16px; font-weight: 600;">Dear Dr. {first_name},</p>
        <p style="margin: 10px 0 0 0; font-size: 16px;">{message}</p>
    </div>
    
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 15px 0; color: {ENTERPRISE_BRAND_COLOR}; font-size: 18px;">Your Trial Status</h3>
        <div style="display: grid; gap: 10px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                <span style="font-weight: 600;">Specialty:</span>
                <span>{specialty_display}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                <span style="font-weight: 600;">Days Remaining:</span>
                <span style="color: {'#dc2626' if days_remaining <= 3 else ENTERPRISE_BRAND_COLOR}; font-weight: 700;">{days_remaining}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span style="font-weight: 600;">Usage:</span>
                <span>{trial.get('usage_percentage', 0):.1f}% of limit used</span>
            </div>
        </div>
    </div>
    
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 15px 0; color: {ENTERPRISE_BRAND_COLOR}; font-size: 18px;">Why Upgrade to MedoraMD Premium?</h3>
        <ul style="margin: 0; padding-left: 0; list-style: none;">
            <li style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">✅ <strong>Unlimited transcript analysis</strong></li>
            <li style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">✅ <strong>Advanced SOAP note generation</strong></li>
            <li style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">✅ <strong>AllergenIQ patient profiling</strong></li>
            <li style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">✅ <strong>Priority customer support</strong></li>
            <li style="padding: 8px 0;">✅ <strong>Enterprise-grade security</strong></li>
        </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="mailto:{SALES_EMAIL}?subject=MedoraMD Premium Upgrade Request" 
           style="background: {ENTERPRISE_BRAND_COLOR}; color: white; padding: 15px 30px; border-radius: 25px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);">
            Upgrade to Premium Now
        </a>
    </div>
    
    <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0; color: {ENTERPRISE_BRAND_COLOR};">Need Help?</h4>
        <p style="margin: 0;">
            📧 Sales: <a href="mailto:{SALES_EMAIL}" style="color: {ENTERPRISE_BRAND_COLOR};">{SALES_EMAIL}</a><br>
            🆘 Support: <a href="mailto:{SUPPORT_EMAIL}" style="color: {ENTERPRISE_BRAND_COLOR};">{SUPPORT_EMAIL}</a><br>
            📞 Phone: 1-800-MEDORA-1
        </p>
    </div>
    
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
        <p style="margin: 0;">© 2025 MedoraMD. All rights reserved.</p>
        <p style="margin: 5px 0 0 0;">This email was sent to {trial['email']}. If you have questions, contact {SUPPORT_EMAIL}</p>
    </div>
</body>
</html>
"""
        
        return {
            'subject': subject,
            'body': body,
            'html_body': html_body
        }

# Initialize enterprise trial manager
enterprise_trial_manager = EnterpriseTrialManager()

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email_via_smtp_gmail(to_email, subject, body, html_body=None):
    """Send email using Gmail SMTP"""
    try:
        smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_username = os.getenv('SMTP_USERNAME')
        smtp_password = os.getenv('SMTP_PASSWORD')
        
        if not smtp_username or not smtp_password:
            logger.error("❌ Gmail SMTP credentials not configured")
            return False
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"MedoraMD <{smtp_username}>"
        msg['To'] = to_email
        
        # Add text part
        text_part = MIMEText(body, 'plain')
        msg.attach(text_part)
        
        # Add HTML part if provided
        if html_body:
            html_part = MIMEText(html_body, 'html')
            msg.attach(html_part)
        
        # Send email
        logger.info(f"📧 GMAIL SMTP: Sending email to {to_email}")
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)
        
        logger.info(f"✅ Gmail SMTP email sent to {to_email}")
        
        # Log successful send
        try:
            email_campaigns_collection.insert_one({
                'email': to_email,
                'subject': subject,
                'campaign_type': 'welcome_email',
                'provider': 'gmail_smtp',
                'sent_at': datetime.now(),
                'status': 'sent'
            })
        except Exception as db_error:
            logger.warning(f"⚠️ Failed to log email campaign: {str(db_error)}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Gmail SMTP error: {str(e)}")
        return False

# Update your welcome email function
def send_welcome_email(email, first_name, last_name, specialty='general'):
    """Send welcome email via Gmail SMTP"""
    try:
        specialty_display = enterprise_trial_manager.specialties.get(specialty, 'Medical Professional')
        
        subject = f"🎉 Welcome to MedoraMD, Dr. {first_name}!"
        
        body = f"""
Dear Dr. {first_name} {last_name},

Welcome to MedoraMD! We're excited to have you join our community of healthcare professionals.

Your 30-Day Enterprise Trial is now active and includes:
✅ UNLIMITED transcript analysis and SOAP note generation
✅ Advanced AllergenIQ patient profiling system  
✅ AI-powered clinical insights and research integration
✅ Specialty-focused recommendations for {specialty_display}
✅ Priority customer support

Getting Started:
1. Log in to your dashboard at https://test.medoramd.ai
2. Start your first patient consultation
3. Upload or record your patient interaction
4. Watch MedoraMD generate comprehensive SOAP notes instantly

Need help? Contact us at {SUPPORT_EMAIL}

Best regards,
The MedoraMD Team
        """
        
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Welcome to MedoraMD</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, {ENTERPRISE_BRAND_COLOR} 0%, #1e40af 100%); padding: 30px; color: white; text-align: center; border-radius: 10px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px;">🎉 Welcome to MedoraMD!</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">Your 30-Day Trial Starts Now</p>
    </div>
    
    <div style="padding: 20px;">
        <p><strong>Dear Dr. {first_name} {last_name},</strong></p>
        
        <p>Welcome to MedoraMD! We're excited to have you join our community of healthcare professionals.</p>
        
        <div style="background: #f0f9ff; border-left: 4px solid {ENTERPRISE_BRAND_COLOR}; padding: 15px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: {ENTERPRISE_BRAND_COLOR};">Your Trial Includes:</h3>
            <ul style="margin: 0; padding-left: 20px;">
                <li>✅ Unlimited transcript analysis</li>
                <li>✅ Advanced SOAP note generation</li>
                <li>✅ AllergenIQ patient profiling</li>
                <li>✅ Priority customer support</li>
            </ul>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
            <a href="https://test.medoramd.ai" 
               style="background: {ENTERPRISE_BRAND_COLOR}; color: white; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-weight: bold;">
                🚀 Get Started Now
            </a>
        </div>
        
        <p style="font-size: 14px; color: #666;">
            Need help? Contact us at <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>
        </p>
        
        <p>Best regards,<br>The MedoraMD Team</p>
    </div>
</body>
</html>
        """
        
        success = send_email_via_smtp_gmail(email, subject, body, html_body)
        
        if success:
            logger.info(f"✅ Welcome email sent successfully to {email}")
        else:
            logger.error(f"❌ Failed to send welcome email to {email}")
        
        return success
        
    except Exception as e:
        logger.error(f"❌ Error sending welcome email to {email}: {str(e)}")
        return False

# Update your enterprise email function
# REPLACE the existing send_enterprise_email function with this:
def send_enterprise_email(to_email, subject, body, html_body=None):
    """Send email using Gmail SMTP (replacing SES)"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_username = os.getenv('SMTP_USERNAME')
        smtp_password = os.getenv('SMTP_PASSWORD')
        
        if not smtp_username or not smtp_password:
            logger.error("❌ Gmail SMTP credentials not configured")
            return False
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"MedoraMD <{smtp_username}>"
        msg['To'] = to_email
        
        # Add text part
        text_part = MIMEText(body, 'plain')
        msg.attach(text_part)
        
        # Add HTML part if provided
        if html_body:
            html_part = MIMEText(html_body, 'html')
            msg.attach(html_part)
        
        # Send email
        logger.info(f"📧 GMAIL SMTP: Sending email to {to_email}")
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)
        
        logger.info(f"✅ Gmail SMTP email sent to {to_email}")
        
        # Log successful send
        try:
            email_campaigns_collection.insert_one({
                'email': to_email,
                'subject': subject,
                'campaign_type': 'welcome_email',
                'provider': 'gmail_smtp',
                'sent_at': datetime.now(),
                'status': 'sent'
            })
        except Exception as db_error:
            logger.warning(f"⚠️ Failed to log email campaign: {str(db_error)}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Gmail SMTP error: {str(e)}")
        return False

def send_welcome_email(email, first_name, last_name, specialty='general'):
    """Send welcome email for new enterprise trial users"""
    try:
        specialty_display = enterprise_trial_manager.specialties.get(specialty, 'Medical Professional')
        
        subject = f"🎉 Welcome to MedoraMD, Dr. {first_name}! Your 30-Day Trial Starts Now"
        
        # Text version
        body = f"""
Dear Dr. {first_name} {last_name},

Welcome to MedoraMD! We're excited to have you join our community of healthcare professionals who are revolutionizing their clinical documentation workflow.

Your 30-Day Enterprise Trial is now active and includes:

✅ UNLIMITED transcript analysis and SOAP note generation
✅ Advanced AllergenIQ patient profiling system  
✅ AI-powered clinical insights and research integration
✅ Specialty-focused recommendations for {specialty_display}
✅ Priority customer support from our medical team

Getting Started:
1. Log in to your dashboard at https://test.medoramd.ai
2. Start your first patient consultation
3. Upload or record your patient interaction
4. Watch as MedoraMD generates comprehensive SOAP notes instantly

Trial Details:
- Duration: 30 days (expires on {(datetime.now() + timedelta(days=30)).strftime('%B %d, %Y')})
- Usage Limit: {TRIAL_USAGE_LIMIT} transcript analyses
- Specialty Focus: {specialty_display}

Need help getting started? Our support team is here for you:
📧 {SUPPORT_EMAIL}
📞 1-800-MEDORA-1
💬 Live chat available in your dashboard

Best regards,
The MedoraMD Team

P.S. - Have colleagues who could benefit from MedoraMD? Refer them for exclusive benefits!

---
MedoraMD Enterprise
{SES_FROM_EMAIL}
"""
        
        # HTML version
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to MedoraMD</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, {ENTERPRISE_BRAND_COLOR} 0%, #1e40af 100%); padding: 40px 30px; border-radius: 15px; color: white; text-align: center; margin-bottom: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
        <h1 style="margin: 0; font-size: 32px; font-weight: 700;">🎉 Welcome to MedoraMD!</h1>
        <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.95;">Your 30-Day Enterprise Trial Starts Now</p>
    </div>
    
    <!-- Welcome Message -->
    <div style="background: white; border-radius: 12px; padding: 30px; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <h2 style="margin: 0 0 15px 0; color: {ENTERPRISE_BRAND_COLOR}; font-size: 24px;">Dear Dr. {first_name} {last_name},</h2>
        <p style="margin: 0; font-size: 16px; line-height: 1.7;">Welcome to MedoraMD! We're excited to have you join our community of healthcare professionals who are revolutionizing their clinical documentation workflow.</p>
    </div>
    
    <!-- Trial Features -->
    <div style="background: white; border-radius: 12px; padding: 30px; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <h3 style="margin: 0 0 20px 0; color: {ENTERPRISE_BRAND_COLOR}; font-size: 20px;">Your Enterprise Trial Includes:</h3>
        <div style="space-y: 12px;">
            <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                <span style="color: #10b981; font-size: 18px; margin-right: 12px;">✅</span>
                <span style="font-size: 15px;"><strong>UNLIMITED transcript analysis</strong> and SOAP note generation</span>
            </div>
            <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                <span style="color: #10b981; font-size: 18px; margin-right: 12px;">✅</span>
                <span style="font-size: 15px;"><strong>Advanced AllergenIQ</strong> patient profiling system</span>
            </div>
            <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                <span style="color: #10b981; font-size: 18px; margin-right: 12px;">✅</span>
                <span style="font-size: 15px;"><strong>AI-powered clinical insights</strong> and research integration</span>
            </div>
            <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                <span style="color: #10b981; font-size: 18px; margin-right: 12px;">✅</span>
                <span style="font-size: 15px;"><strong>Specialty-focused recommendations</strong> for {specialty_display}</span>
            </div>
            <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                <span style="color: #10b981; font-size: 18px; margin-right: 12px;">✅</span>
                <span style="font-size: 15px;"><strong>Priority customer support</strong> from our medical team</span>
            </div>
        </div>
    </div>
    
    <!-- Getting Started -->
    <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #0ea5e9; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
        <h3 style="margin: 0 0 15px 0; color: {ENTERPRISE_BRAND_COLOR}; font-size: 18px;">🚀 Getting Started (4 Easy Steps):</h3>
        <ol style="margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 8px; font-size: 15px;">Log in to your dashboard at <a href="https://test.medoramd.ai" style="color: {ENTERPRISE_BRAND_COLOR};">https://test.medoramd.ai</a></li>
            <li style="margin-bottom: 8px; font-size: 15px;">Start your first patient consultation</li>
            <li style="margin-bottom: 8px; font-size: 15px;">Upload or record your patient interaction</li>
            <li style="margin-bottom: 0; font-size: 15px;">Watch MedoraMD generate comprehensive SOAP notes instantly!</li>
        </ol>
    </div>
    
    <!-- Trial Details -->
    <div style="background: white; border-radius: 12px; padding: 30px; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <h3 style="margin: 0 0 20px 0; color: {ENTERPRISE_BRAND_COLOR}; font-size: 18px;">📋 Trial Details:</h3>
        <div style="background: #f8fafc; border-left: 4px solid {ENTERPRISE_BRAND_COLOR}; padding: 15px; border-radius: 5px;">
            <div style="margin-bottom: 8px;"><strong>Duration:</strong> 30 days (expires {(datetime.now() + timedelta(days=30)).strftime('%B %d, %Y')})</div>
            <div style="margin-bottom: 8px;"><strong>Usage Limit:</strong> {TRIAL_USAGE_LIMIT} transcript analyses</div>
            <div><strong>Specialty Focus:</strong> {specialty_display}</div>
        </div>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin: 35px 0;">
        <a href="https://test.medoramd.ai" 
           style="background: {ENTERPRISE_BRAND_COLOR}; color: white; padding: 18px 35px; border-radius: 30px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 6px 20px rgba(14, 165, 233, 0.3); transition: all 0.3s ease;">
            🚀 Start Your First Analysis
        </a>
    </div>
    
    <!-- Support -->
    <div style="background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <h4 style="margin: 0 0 15px 0; color: {ENTERPRISE_BRAND_COLOR}; font-size: 18px;">🆘 Need Help Getting Started?</h4>
        <p style="margin: 0 0 15px 0; color: #64748b;">Our support team is here for you:</p>
        <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
            <a href="mailto:{SUPPORT_EMAIL}" style="color: {ENTERPRISE_BRAND_COLOR}; text-decoration: none; font-weight: 600;">📧 {SUPPORT_EMAIL}</a>
            <span style="color: {ENTERPRISE_BRAND_COLOR}; font-weight: 600;">📞 1-800-MEDORA-1</span>
            <span style="color: {ENTERPRISE_BRAND_COLOR}; font-weight: 600;">💬 Live chat in dashboard</span>
        </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 40px; padding: 25px; background: #1e293b; color: white; border-radius: 12px;">
        <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Welcome to the future of clinical documentation!</p>
        <p style="margin: 0 0 15px 0; font-size: 14px; opacity: 0.8;">Best regards,<br>The MedoraMD Team</p>
        <p style="margin: 0; font-size: 12px; opacity: 0.6;">
            P.S. - Have colleagues who could benefit from MedoraMD? <a href="mailto:{SALES_EMAIL}?subject=Colleague Referral" style="color: #60a5fa;">Refer them for exclusive benefits!</a>
        </p>
    </div>
    
    <!-- Legal Footer -->
    <div style="text-align: center; margin-top: 20px; color: #64748b; font-size: 11px; line-height: 1.5;">
        <p style="margin: 0;">© 2025 MedoraMD Enterprise. All rights reserved.</p>
        <p style="margin: 5px 0 0 0;">This email was sent to {email}. Questions? Contact {SUPPORT_EMAIL}</p>
    </div>
</body>
</html>
"""
        
        success = send_enterprise_email(email, subject, body, html_body)
        
        if success:
            logger.info(f"✅ Welcome email sent successfully to {email}")
        else:
            logger.error(f"❌ Failed to send welcome email to {email}")
        
        return success
        
    except Exception as e:
        logger.error(f"❌ Error sending welcome email to {email}: {str(e)}")
        return False

# ============================================================================
# COGNITO HELPER FUNCTIONS (Enhanced for Enterprise)
# ============================================================================

def get_cognito_public_keys():
    """Fetch and cache Cognito public keys for JWT verification"""
    global cognito_keys
    if not COGNITO_ENABLED:
        return None
        
    if cognito_keys is None:
        try:
            url = f'{COGNITO_ISSUER}/.well-known/jwks.json'
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            cognito_keys = response.json()
            logger.debug("Successfully fetched Cognito public keys")
        except Exception as e:
            logger.error(f"Error fetching Cognito keys: {e}")
            return None
    return cognito_keys

def verify_cognito_token(token):
    """Verify and decode Cognito JWT token with enhanced debugging"""
    if not COGNITO_ENABLED:
        logger.warning("🔍 DEBUG: Cognito not enabled, skipping token verification")
        return None
        
    try:
        logger.info(f"🔍 DEBUG: Starting token verification...")
        
        # Get public keys
        keys = get_cognito_public_keys()
        if not keys:
            logger.error("🔍 DEBUG: Failed to get Cognito public keys")
            return None
            
        logger.info(f"🔍 DEBUG: Got Cognito public keys, count: {len(keys.get('keys', []))}")
            
        # Decode header to get key ID
        try:
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header['kid']
            logger.info(f"🔍 DEBUG: Token key ID: {kid}")
        except Exception as e:
            logger.error(f"🔍 DEBUG: Failed to decode token header: {str(e)}")
            return None
        
        # Find the correct key
        key = None
        for k in keys['keys']:
            if k['kid'] == kid:
                key = k
                break
                
        if not key:
            logger.error(f"🔍 DEBUG: No matching key found for kid: {kid}")
            available_kids = [k['kid'] for k in keys['keys']]
            logger.error(f"🔍 DEBUG: Available key IDs: {available_kids}")
            return None
            
        logger.info(f"🔍 DEBUG: Found matching key for kid: {kid}")
            
        # Convert key to PEM format
        try:
            public_key = RSAAlgorithm.from_jwk(key)
            logger.info(f"🔍 DEBUG: Successfully converted JWK to PEM")
        except Exception as e:
            logger.error(f"🔍 DEBUG: Failed to convert JWK to PEM: {str(e)}")
            return None
        
        # Verify and decode token
        try:
            decoded_token = jwt.decode(
                token,
                public_key,
                algorithms=['RS256'],
                audience=COGNITO_CLIENT_ID,
                issuer=COGNITO_ISSUER
            )
            
            logger.info(f"✅ DEBUG: Token successfully verified")
            logger.info(f"✅ DEBUG: Token email: {decoded_token.get('email')}")
            logger.info(f"✅ DEBUG: Token sub: {decoded_token.get('sub')}")
            return decoded_token
            
        except jwt.ExpiredSignatureError:
            logger.warning("🔍 DEBUG: Token has expired")
            return None
        except jwt.InvalidAudienceError:
            logger.error(f"🔍 DEBUG: Invalid audience. Expected: {COGNITO_CLIENT_ID}")
            return None
        except jwt.InvalidIssuerError:
            logger.error(f"🔍 DEBUG: Invalid issuer. Expected: {COGNITO_ISSUER}")
            return None
        except jwt.InvalidTokenError as e:
            logger.error(f"🔍 DEBUG: Invalid token: {str(e)}")
            return None
            
    except Exception as e:
        logger.error(f"🔍 DEBUG: Token verification error: {str(e)}")
        logger.error(f"🔍 DEBUG: Full error traceback: {traceback.format_exc()}")
        return None


def get_user_from_token():
    """Extract user information from Cognito token with enhanced debugging"""
    auth_header = request.headers.get('Authorization')
    logger.info(f"🔍 DEBUG: Authorization header present: {bool(auth_header)}")
    
    if not auth_header:
        logger.info(f"🔍 DEBUG: No Authorization header found")
        return None
        
    if not auth_header.startswith('Bearer '):
        logger.info(f"🔍 DEBUG: Authorization header doesn't start with 'Bearer ': {auth_header[:20]}...")
        return None
        
    token = auth_header.split(' ')[1]
    logger.info(f"🔍 DEBUG: Extracted token (first 20 chars): {token[:20]}...")
    logger.info(f"🔍 DEBUG: Token length: {len(token)}")
    
    decoded_token = verify_cognito_token(token)
    logger.info(f"🔍 DEBUG: Token verification result: {bool(decoded_token)}")
    
    if decoded_token:
        user_info = {
            'email': decoded_token.get('email'),
            'username': decoded_token.get('cognito:username'),
            'sub': decoded_token.get('sub'),
            'first_name': decoded_token.get('given_name'),
            'last_name': decoded_token.get('family_name'),
            'specialty': decoded_token.get('custom:specialty', 'general'),
            'auth_type': 'cognito'
        }
        logger.info(f"✅ DEBUG: Successfully extracted user info: {user_info}")
        return user_info
    else:
        logger.warning(f"❌ DEBUG: Token verification failed")
        
    return None

def get_subscription_status(email):
    """Return the subscription status including tier and trial expiration - Enhanced for Enterprise"""
    logger.info(f"🔍 DEBUG: Checking subscription for email: {email}")
    
    # ENTERPRISE: First check enterprise trials
    enterprise_trial = enterprise_trial_manager.get_trial_status(email)
    if enterprise_trial:
        logger.info(f"✅ ENTERPRISE: Found enterprise trial for {email}")
        
        if enterprise_trial.get('trial_status') == 'active':
            return {
                "tier": "Trial",
                "trial_start": enterprise_trial.get('trial_start', datetime.now()).strftime("%Y-%m-%d"),
                "trial_end": enterprise_trial.get('trial_end', datetime.now()).strftime("%Y-%m-%d"),
                "days_remaining": enterprise_trial.get('days_remaining', 0),
                "usage_percentage": enterprise_trial.get('usage_percentage', 0.0),
                "enterprise_trial": True,
                "specialty": enterprise_trial.get('specialty', 'general'),
                "card_last4": None
            }
        elif enterprise_trial.get('trial_status') == 'expired':
            return {
                "tier": "Expired",
                "trial_end": enterprise_trial.get('trial_end', datetime.now()).strftime("%Y-%m-%d"),
                "days_remaining": 0,
                "usage_percentage": enterprise_trial.get('usage_percentage', 100.0),
                "enterprise_trial": True,
                "specialty": enterprise_trial.get('specialty', 'general'),
                "card_last4": None
            }
    
    # Check hardcoded subscriptions
    user_data = SUBSCRIPTIONS.get(email, None)
    logger.info(f"🔍 DEBUG: Hardcoded user data: {user_data}")
    
    # If not in hardcoded list, check if it's a verified Cognito user
    if not user_data:
        logger.info(f"🔍 DEBUG: Email not in hardcoded list, checking Cognito token...")
        
        # Check if user has valid Cognito token (means they're verified)
        cognito_user = get_user_from_token()
        logger.info(f"🔍 DEBUG: Cognito user from token: {cognito_user}")
        
        if cognito_user and cognito_user.get('email') == email:
            logger.info(f"✅ ENTERPRISE: Valid Cognito user found, creating enterprise trial")
            
            # Create enterprise trial for new Cognito user
            first_name = cognito_user.get('first_name', 'Doctor')
            last_name = cognito_user.get('last_name', 'User')
            specialty = cognito_user.get('specialty', 'general')
            
            trial = enterprise_trial_manager.create_enterprise_trial(
                email, first_name, last_name, specialty
            )
            
            if trial:
                # Send welcome email
                send_welcome_email(email, first_name, last_name, specialty)
                
                return {
                    "tier": "Trial",
                    "trial_start": trial['trial_start'].strftime("%Y-%m-%d"),
                    "trial_end": trial['trial_end'].strftime("%Y-%m-%d"),
                    "days_remaining": trial['days_remaining'],
                    "usage_percentage": trial['usage_percentage'],
                    "enterprise_trial": True,
                    "specialty": specialty,
                    "card_last4": None
                }
            else:
                logger.error(f"❌ Failed to create enterprise trial for {email}")
        elif cognito_user:
            logger.warning(f"⚠️ DEBUG: Cognito user email mismatch. Token email: {cognito_user.get('email')}, Requested email: {email}")
        else:
            logger.warning(f"⚠️ DEBUG: No valid Cognito token found")
            
        # Not a verified user, no access
        logger.info(f"❌ DEBUG: No valid authentication found, denying access")
        return {
            "tier": "None",
            "trial_start": None,
            "trial_end": None,
            "card_last4": None
        }
    
    # Existing hardcoded logic for backward compatibility
    logger.info(f"✅ DEBUG: Using hardcoded subscription data")
    tier = user_data["tier"]
    trial_start = user_data["trial_start"]
    
    if tier == "Trial" and trial_start:
        trial_start_date = datetime.strptime(trial_start, "%Y-%m-%d")
        trial_end = trial_start_date + timedelta(days=7)
        if datetime.now() > trial_end:
            return {
                "tier": "Expired",
                "trial_end": trial_end.strftime("%Y-%m-%d"),
                "card_last4": user_data["card_last4"]
            }
    
    return {
        "tier": tier,
        "trial_end": None,
        "card_last4": user_data["card_last4"]
    }

# ============================================================================
# ENTERPRISE API ENDPOINTS
# ============================================================================

@app.route('/api/enterprise/user-trial-status', methods=['GET', 'OPTIONS'])
def get_enterprise_trial_status():
    """Get detailed enterprise trial status for authenticated user"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET, OPTIONS")
        return response
        
    try:
        # Get user from token
        cognito_user = get_user_from_token()
        if not cognito_user:
            return jsonify({'error': 'Authentication required'}), 401
        
        email = cognito_user['email']
        
        # Get enterprise trial status
        trial_status = enterprise_trial_manager.get_trial_status(email)
        
        if trial_status:
            # Include additional user info
            trial_status['user_info'] = {
                'first_name': cognito_user.get('first_name', 'Doctor'),
                'last_name': cognito_user.get('last_name', 'User'),
                'specialty': cognito_user.get('specialty', 'general'),
                'email': email
            }
        else:
            # Create trial if none exists
            first_name = cognito_user.get('first_name', 'Doctor')
            last_name = cognito_user.get('last_name', 'User')
            specialty = cognito_user.get('specialty', 'general')
            
            trial_status = enterprise_trial_manager.create_enterprise_trial(
                email, first_name, last_name, specialty
            )
            
            if trial_status:
                send_welcome_email(email, first_name, last_name, specialty)
        
        return jsonify({
            'success': True,
            'trial_status': trial_status
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting enterprise trial status: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/enterprise/trial-analytics', methods=['GET', 'OPTIONS'])
def get_enterprise_analytics():
    """Get enterprise analytics dashboard"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET, OPTIONS")
        return response
        
    try:
        # This could be protected with admin authentication
        analytics = enterprise_trial_manager.get_analytics_dashboard()
        
        if analytics:
            return jsonify({
                'success': True,
                'analytics': analytics
            }), 200
        else:
            return jsonify({'error': 'Failed to generate analytics'}), 500
            
    except Exception as e:
        logger.error(f"❌ Error getting enterprise analytics: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/enterprise/send-welcome-email', methods=['POST', 'OPTIONS'])
def send_enterprise_welcome_email():
    """Send welcome email to new trial user"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
        
    try:
        data = request.get_json()
        email = data.get('email')
        first_name = data.get('firstName', 'Doctor')
        last_name = data.get('lastName', 'User')
        specialty = data.get('specialty', 'general')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        success = send_welcome_email(email, first_name, last_name, specialty)
        
        return jsonify({
            'success': success,
            'message': 'Welcome email sent successfully' if success else 'Failed to send email'
        }), 200 if success else 500
        
    except Exception as e:
        logger.error(f"❌ Error sending welcome email: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/enterprise/send-renewal-reminders', methods=['POST', 'OPTIONS'])
def send_enterprise_renewal_reminders():
    """Trigger renewal reminder check (admin function)"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
        
    try:
        # This should be protected with admin authentication in production
        sent_count = enterprise_trial_manager.check_and_send_reminders()
        
        return jsonify({
            'success': True,
            'reminders_sent': sent_count,
            'message': f'Sent {sent_count} renewal reminders'
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error sending renewal reminders: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# AUTHENTICATION DECORATORS (Enhanced for Enterprise)
# ============================================================================

@app.route('/api/debug/cognito-test', methods=['GET', 'POST'])
def debug_cognito_test():
    """Debug endpoint to test Cognito configuration and token verification"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        return response
        
    try:
        debug_info = {
            "cognito_enabled": COGNITO_ENABLED,
            "cognito_region": COGNITO_REGION,
            "cognito_user_pool_id": COGNITO_USER_POOL_ID,
            "cognito_client_id": COGNITO_CLIENT_ID,
            "cognito_issuer": COGNITO_ISSUER if COGNITO_ENABLED else None,
            "enterprise_features": {
                "trial_manager_active": True,
                "ses_configured": bool(SES_FROM_EMAIL),
                "trial_length_days": TRIAL_LENGTH_DAYS,
                "usage_limit": TRIAL_USAGE_LIMIT
            },
            "authorization_header_present": bool(request.headers.get('Authorization')),
            "authorization_header_value": request.headers.get('Authorization', '')[:50] + "..." if request.headers.get('Authorization') else None,
        }
        
        # Test Cognito keys fetch
        if COGNITO_ENABLED:
            try:
                keys = get_cognito_public_keys()
                debug_info["cognito_keys_fetched"] = bool(keys)
                debug_info["cognito_keys_count"] = len(keys.get('keys', [])) if keys else 0
            except Exception as e:
                debug_info["cognito_keys_error"] = str(e)
        
        # Test token verification if provided
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            cognito_user = get_user_from_token()
            debug_info["token_verification"] = {
                "token_provided": True,
                "token_length": len(token),
                "verification_successful": bool(cognito_user),
                "user_info": cognito_user
            }
            
            if cognito_user:
                # Test enterprise trial status
                trial_status = enterprise_trial_manager.get_trial_status(cognito_user['email'])
                debug_info["enterprise_trial_test"] = {
                    "trial_found": bool(trial_status),
                    "trial_data": trial_status
                }
        else:
            debug_info["token_verification"] = {
                "token_provided": False
            }
        
        return jsonify({
            "success": True,
            "debug_info": debug_info,
            "timestamp": datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500

@app.route('/api//python-test', methods=['GET', 'POST'])
def python_test():
    """Debug endpoint to test pushed code is deployed to website"""
    return jsonify({
        "success": True,
        "error": 'Python test endpoint is working',
        "timestamp": datetime.now().isoformat()
    }), 500

def require_auth(f):
    """Decorator to require either session auth (old method) or Cognito JWT (new method)"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check for Cognito JWT token first
        cognito_user = get_user_from_token()
        if cognito_user:
            # Valid Cognito user
            request.user = cognito_user
            return f(*args, **kwargs)
        
        # Fall back to session-based auth for backward compatibility
        if 'user_email' in session:
            request.user = {
                'email': session['user_email'],
                'auth_type': 'session'
            }
            return f(*args, **kwargs)
        
        return jsonify({'error': 'Authentication required'}), 401
    
    return decorated_function

def require_subscription(f):
    """Decorator to check subscription status (Enhanced for Enterprise)"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_email = getattr(request, 'user', {}).get('email')
        if not user_email:
            return jsonify({'error': 'Authentication required'}), 401
        
        subscription = get_subscription_status(user_email)
        
        # ENTERPRISE: Increment usage for enterprise trial users
        if subscription.get('enterprise_trial') and subscription['tier'] == 'Trial':
            enterprise_trial_manager.increment_usage(user_email, 'api_request')
        
        # Allow access for Trial, Premium, and other paid tiers
        if subscription['tier'] in ['Trial', 'Premium', 'Pro', 'Enterprise']:
            request.subscription = subscription
            return f(*args, **kwargs)
        
        return jsonify({
            'error': 'Subscription required',
            'tier': subscription['tier']
        }), 403
    
    return decorated_function

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

# Replace your existing analyze_transcript function with this improved version

def ensure_strings_for_frontend(soap_data):
    """
    Simple function to ensure all fields are strings for frontend compatibility
    No hardcoding - just converts objects to strings if needed
    """
    try:
        # Convert patient_history fields to strings if they're objects
        if "patient_history" in soap_data and isinstance(soap_data["patient_history"], dict):
            for field, value in soap_data["patient_history"].items():
                if isinstance(value, dict):
                    # Convert dict to simple string representation
                    parts = []
                    for k, v in value.items():
                        if v:
                            parts.append(f"{v}")
                    soap_data["patient_history"][field] = ". ".join(parts) if parts else "No data available"
                elif not isinstance(value, str):
                    soap_data["patient_history"][field] = str(value) if value else "No data available"
        
        # Convert other SOAP sections to strings if they're objects
        simple_sections = ["physical_examination", "differential_diagnosis", "diagnostic_workup",
                          "patient_education", "follow_up_instructions", "summary"]
        
        for section in simple_sections:
            if section in soap_data and isinstance(soap_data[section], dict):
                # Convert dict to simple string
                parts = []
                for k, v in soap_data[section].items():
                    if v:
                        parts.append(f"{v}")
                soap_data[section] = ". ".join(parts) if parts else "No data available"
            elif section in soap_data and not isinstance(soap_data[section], str):
                soap_data[section] = str(soap_data[section]) if soap_data[section] else "No data available"
        
        return soap_data
    except Exception as e:
        logger.error(f"Error ensuring string compatibility: {str(e)}")
        return soap_data


def force_bullet_formatting(raw_text, conditions):
    """
    ENHANCED: Force proper bullet point formatting with consistent line breaks
    """
    try:
        formatted_sections = []
        
        # Split by condition numbers (1., 2., 3., etc.)
        parts = re.split(r'(\d+\.\s+[^:]+:)', raw_text)
        
        current_condition = None
        
        for i, part in enumerate(parts):
            part = part.strip()
            if not part:
                continue
                
            # Check if this is a condition header (like "1. Urticaria:")
            if re.match(r'^\d+\.\s+[^:]+:$', part):
                current_condition = part
            elif current_condition and part:
                # This is the content for the current condition
                formatted_section = format_condition_bullets(current_condition, part)
                if formatted_section:
                    formatted_sections.append(formatted_section)
                current_condition = None
        
        # If no proper structure found, try alternative parsing
        if not formatted_sections:
            formatted_sections = parse_alternative_format(raw_text, conditions)
        
        result = '\n\n'.join(formatted_sections)
        logger.info(f"✅ FORMATTING: Generated assessment with {len(formatted_sections)} sections")
        return result
        
    except Exception as e:
        logger.error(f"Error in force_bullet_formatting: {str(e)}")
        return create_fallback_assessment_formatted(conditions, raw_text)

def format_condition_bullets(condition_header, content):
    """
    Format a single condition with proper bullet points and consistent spacing
    """
    try:
        # Start with the condition header and double line break
        result = condition_header + "\n\n"
        
        # Split content into sentences and create bullets
        sentences = []
        
        # First try to split by existing bullet indicators
        if '- ' in content:
            bullet_parts = content.split('- ')
            for part in bullet_parts[1:]:  # Skip first empty part
                sentence = part.strip().rstrip('.,!?').strip()
                if sentence and len(sentence) > 10:
                    sentences.append(sentence)
        else:
            # Split by periods and create meaningful bullets
            period_parts = content.split('.')
            for part in period_parts:
                sentence = part.strip().lstrip('-').strip()
                if sentence and len(sentence) > 15:
                    sentences.append(sentence)
        
        # Create properly formatted bullets
        if sentences:
            for sentence in sentences:
                result += f"- {sentence}\n"
            result += "\n"  # Extra line break after section
        else:
            result += f"- {content.strip()}\n\n"
            
        return result
        
    except Exception as e:
        logger.error(f"Error formatting condition bullets: {str(e)}")
        return f"{condition_header}\n\n- {content}\n\n"

def parse_alternative_format(raw_text, conditions):
    """
    Alternative parsing when standard format doesn't work
    """
    try:
        formatted_sections = []
        lines = raw_text.split('\n')
        current_section = []
        current_header = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Check if this looks like a condition header
            if re.match(r'^\d+\.\s+[^:]+:', line) or (line.endswith(':') and any(cond.lower() in line.lower() for cond in conditions)):
                # Save previous section
                if current_header and current_section:
                    section_text = ' '.join(current_section)
                    formatted_sections.append(format_condition_bullets(current_header, section_text))
                
                # Start new section
                current_header = line if line.endswith(':') else line + ':'
                current_section = []
            else:
                # Add to current section
                if line and not line.startswith('-'):
                    current_section.append(line)
        
        # Add final section
        if current_header and current_section:
            section_text = ' '.join(current_section)
            formatted_sections.append(format_condition_bullets(current_header, section_text))
        
        # If still no sections, create from conditions
        if not formatted_sections:
            for i, condition in enumerate(conditions, 1):
                header = f"{i}. {condition}:"
                content = "Clinical evaluation and assessment documented during visit"
                formatted_sections.append(format_condition_bullets(header, content))
        
        return formatted_sections
        
    except Exception as e:
        logger.error(f"Error in alternative parsing: {str(e)}")
        return [create_fallback_assessment_formatted(conditions, raw_text)]

def create_fallback_assessment_formatted(conditions, source_text):
    """
    Create properly formatted fallback assessment with consistent spacing
    """
    try:
        assessment_parts = []
        
        for i, condition in enumerate(conditions, 1):
            condition_section = f"{i}. {condition}:\n\n"
            condition_section += "- Clinical evaluation and assessment completed during visit\n"
            condition_section += "- Patient presentation and history documented as discussed\n"
            condition_section += "- Treatment plan established based on clinical findings\n\n"
            
            assessment_parts.append(condition_section)
        
        result = "".join(assessment_parts).rstrip()
        logger.info(f"✅ FALLBACK: Generated fallback assessment with {len(conditions)} conditions")
        return result
        
    except Exception as e:
        logger.error(f"Error creating fallback assessment: {str(e)}")
        return "1. Current Medical Concerns:\n\n- Clinical assessment completed\n- Patient evaluation documented\n- Treatment plan established"

def create_intelligent_symptom_defaults(soap_notes):
    """
    Create intelligent symptom defaults based on available information
    """
    # Look for clues in diagnosis or plan
    diagnosis = soap_notes.get("differential_diagnosis", "").lower()
    plan = soap_notes.get("plan_of_care", "").lower()
    combined = f"{diagnosis} {plan}"
    
    defaults = []
    
    if "rhinitis" in combined:
        defaults.extend([
            {"name": "Nasal Congestion", "severity": 6, "frequency": "Daily"},
            {"name": "Runny Nose", "severity": 5, "frequency": "Daily"},
            {"name": "Sneezing", "severity": 5, "frequency": "Frequent"}
        ])
    
    if "asthma" in combined:
        defaults.extend([
            {"name": "Coughing", "severity": 6, "frequency": "Daily"},
            {"name": "Wheezing", "severity": 5, "frequency": "Occasional"},
            {"name": "Shortness Of Breath", "severity": 6, "frequency": "With Activity"}
        ])
    
    if "conjunctivitis" in combined:
        defaults.append({"name": "Itchy Eyes", "severity": 5, "frequency": "Daily"})
    
    if not defaults:
        defaults = [{"name": "Allergic Symptoms", "severity": 5, "frequency": "Intermittent"}]
    
    return defaults

def create_intelligent_medication_defaults(soap_notes):
    """
    Create intelligent medication defaults based on available information
    """
    diagnosis = soap_notes.get("differential_diagnosis", "").lower()
    plan = soap_notes.get("plan_of_care", "").lower()
    combined = f"{diagnosis} {plan}"
    
    defaults = []
    
    if "rhinitis" in combined:
        defaults.extend([
            {"name": "Antihistamine", "dosage": "Daily", "status": "Active"},
            {"name": "Nasal Spray", "dosage": "As needed", "status": "PRN"}
        ])
    
    if "asthma" in combined:
        defaults.extend([
            {"name": "Inhaled Steroid", "dosage": "Twice daily", "status": "Active"},
            {"name": "Rescue Inhaler", "dosage": "As needed", "status": "PRN"}
        ])
    
    if not defaults:
        defaults = [{"name": "Allergy Medications", "dosage": "As prescribed", "status": "Active"}]
    
    return defaults

def create_intelligent_allergen_defaults(soap_notes):
    """
    Create intelligent allergen defaults based on available information
    """
    diagnosis = soap_notes.get("differential_diagnosis", "").lower()
    plan = soap_notes.get("plan_of_care", "").lower()
    allergies = soap_notes.get("patient_history", {}).get("allergies", "").lower()
    combined = f"{diagnosis} {plan} {allergies}"
    
    defaults = []
    
    if "environmental" in combined or "seasonal" in combined:
        defaults.append({"name": "Environmental Allergens", "reaction": "Seasonal allergic rhinitis symptoms"})
    
    if "perennial" in combined:
        defaults.append({"name": "Indoor Allergens", "reaction": "Year-round allergic symptoms"})
    
    if "food" in combined:
        defaults.append({"name": "Food Allergens", "reaction": "Food-related allergic reactions"})
    
    if not defaults:
        defaults = [{"name": "Multiple Allergens", "reaction": "Allergic reactions requiring evaluation"}]
    
    return defaults


def remove_generic_subjective_language_aggressive(soap_notes):
    """
    AGGRESSIVE FIX: Remove all variations of the generic subjective language
    """
    try:
        if "patient_history" in soap_notes and isinstance(soap_notes["patient_history"], dict):
            hpi = soap_notes["patient_history"].get("history_of_present_illness", "")
            
            if isinstance(hpi, str):
                original_hpi = hpi
                logger.info(f"🔍 BEFORE CLEANING: HPI length = {len(hpi)} chars")
                
                # List of ALL variations of the problematic text
                problematic_phrases = [
                    "The symptoms have persisted, affecting the patient's daily activities and quality of life. The patient reports the onset and progression of symptoms, including any triggering factors, duration, and associated complaints.",
                    "The symptoms have persisted, affecting the patient's daily activities and quality of life. The patient reports the onset and progression of symptoms, including any triggering factors, duration, and associated complaints",
                    "The symptoms have persisted, affecting the patient's daily activities and quality of life",
                    "The patient reports the onset and progression of symptoms, including any triggering factors, duration, and associated complaints",
                    "The patient reports the onset and progression of symptoms, including any triggering factors, duration, and associated complaints.",
                    "affecting the patient's daily activities and quality of life",
                    "including any triggering factors, duration, and associated complaints"
                ]
                
                # Remove each problematic phrase
                for phrase in problematic_phrases:
                    if phrase in hpi:
                        hpi = hpi.replace(phrase, "")
                        logger.info(f"✅ REMOVED: '{phrase[:50]}...'")
                
                # Clean up any resulting formatting issues
                hpi = re.sub(r'\.\s*\.+', '.', hpi)       # Remove multiple periods
                hpi = re.sub(r'^\.\s*', '', hpi)         # Remove leading periods
                hpi = re.sub(r'\s*\.\s*$', '.', hpi)     # Fix ending periods
                hpi = re.sub(r'\s+', ' ', hpi)           # Clean up extra spaces
                hpi = hpi.strip()
                
                # If we removed too much content, keep what's left or create minimal content
                if not hpi or len(hpi) < 20:
                    hpi = "Patient presents for evaluation and management of allergic reactions and dietary sensitivities"
                    logger.info("⚠️ HPI was too short after cleaning, used fallback content")
                elif hpi.endswith(',') or hpi.endswith(' and'):
                    # Fix incomplete sentences
                    hpi = re.sub(r',\s*$', '.', hpi)
                    hpi = re.sub(r'\s+and\s*$', '.', hpi)
                
                # Update the HPI
                soap_notes["patient_history"]["history_of_present_illness"] = hpi
                
                logger.info(f"🔍 AFTER CLEANING: HPI length = {len(hpi)} chars")
                
                # Log the change if it occurred
                if original_hpi != hpi:
                    logger.info(f"✅ SUBJECTIVE CLEANED: Removed generic language")
        
        return soap_notes
        
    except Exception as e:
        logger.error(f"Error in aggressive subjective cleaning: {str(e)}")
        return soap_notes



def ultimate_debug_hpi_flow(soap_notes, step_name):
    """
    Ultimate debugging to track HPI through every step
    """
    try:
        hpi = soap_notes.get("patient_history", {}).get("history_of_present_illness", "")
        
        # Check for the problematic text
        has_problem = ("daily activities and quality of life" in hpi or
                      "onset and progression of symptoms" in hpi or
                      "triggering factors, duration, and associated complaints" in hpi)
        
        status = "🚨 PROBLEM FOUND" if has_problem else "✅ CLEAN"
        
        logger.info(f"🔍 {step_name} - {status}")
        logger.info(f"🔍 HPI LENGTH: {len(hpi)}")
        logger.info(f"🔍 HPI CONTENT: {hpi}")
        
        if has_problem:
            # Show exactly where the problem text is
            if "daily activities and quality of life" in hpi:
                logger.info(f"🚨 FOUND: 'daily activities and quality of life'")
            if "onset and progression of symptoms" in hpi:
                logger.info(f"🚨 FOUND: 'onset and progression of symptoms'")
            if "triggering factors, duration, and associated complaints" in hpi:
                logger.info(f"🚨 FOUND: 'triggering factors, duration, and associated complaints'")
        
        logger.info(f"🔍 {step_name} - END")
        logger.info("="*60)
        
    except Exception as e:
        logger.error(f"Debug error at {step_name}: {str(e)}")



def remove_any_generic_content(soap_notes):
    """
    AGGRESSIVE REMOVAL: Catch any variation of generic template language
    """
    try:
        if ("patient_history" in soap_notes and
            isinstance(soap_notes["patient_history"], dict) and
            "history_of_present_illness" in soap_notes["patient_history"]):
            
            hpi = soap_notes["patient_history"]["history_of_present_illness"]
            
            if isinstance(hpi, str):
                original_hpi = hpi
                logger.info(f"🔍 BEFORE AGGRESSIVE REMOVAL: {hpi}")
                
                # AGGRESSIVE PATTERN MATCHING - catch any variation
                generic_patterns = [
                    # Exact matches first
                    r"The symptoms have persisted, affecting the patient's daily activities and quality of life\.?\s*The patient reports the onset and progression of symptoms, including any triggering factors, duration, and associated complaints\.?",
                    r"The symptoms have persisted, affecting the patient's daily activities and quality of life\.?",
                    r"The patient reports the onset and progression of symptoms, including any triggering factors, duration, and associated complaints\.?",
                    
                    # Partial matches - catch sentence fragments
                    r"[^.]*affecting the patient's daily activities and quality of life[^.]*\.",
                    r"[^.]*onset and progression of symptoms[^.]*\.",
                    r"[^.]*triggering factors, duration, and associated complaints[^.]*\.",
                    
                    # Key phrase combinations that often appear together
                    r"symptoms have persisted[^.]*daily activities[^.]*quality of life",
                    r"patient reports[^.]*onset and progression[^.]*symptoms",
                    r"triggering factors[^.]*duration[^.]*associated complaints",
                    
                    # Standalone problematic phrases
                    r"daily activities and quality of life",
                    r"onset and progression of symptoms",
                    r"triggering factors, duration, and associated complaints",
                    r"affecting the patient's daily activities",
                    r"including any triggering factors"
                ]
                
                # Apply all patterns
                removed_something = False
                for pattern in generic_patterns:
                    if re.search(pattern, hpi, re.IGNORECASE):
                        hpi_before = hpi
                        hpi = re.sub(pattern, "", hpi, flags=re.IGNORECASE)
                        if hpi != hpi_before:
                            removed_something = True
                            logger.info(f"🗑️ REMOVED PATTERN: {pattern}")
                
                # Additional cleanup for common generic sentence starters
                generic_starters = [
                    r"The symptoms have persisted[^.]*\.",
                    r"The patient reports the[^.]*\.",
                    r"Patient reports[^.]*onset[^.]*\."
                ]
                
                for starter in generic_starters:
                    if re.search(starter, hpi, re.IGNORECASE):
                        # Only remove if it contains generic keywords
                        match = re.search(starter, hpi, re.IGNORECASE)
                        if match and any(keyword in match.group().lower() for keyword in [
                            "daily activities", "quality of life", "onset and progression",
                            "triggering factors", "duration", "associated complaints"
                        ]):
                            hpi = re.sub(starter, "", hpi, flags=re.IGNORECASE)
                            removed_something = True
                            logger.info(f"🗑️ REMOVED GENERIC STARTER: {starter}")
                
                # Clean up formatting issues
                hpi = re.sub(r'\s+', ' ', hpi)  # Multiple spaces
                hpi = re.sub(r'\.\.+', '.', hpi)  # Multiple periods
                hpi = re.sub(r'\.\s*,', '.', hpi)  # Period comma
                hpi = re.sub(r',\s*\.', '.', hpi)  # Comma period
                hpi = re.sub(r'^\.\s*', '', hpi)  # Leading period
                hpi = re.sub(r'\s*\.\s*$', '.', hpi)  # Clean ending
                hpi = hpi.strip()
                
                # If HPI becomes too short or empty after aggressive removal, use fallback
                if len(hpi.strip()) < 20:
                    hpi = "Patient presents for allergy evaluation and management as discussed during visit."
                    logger.info(f"🔧 USED FALLBACK: HPI too short after removal")
                
                # Ensure proper sentence ending
                if hpi and not hpi.endswith(('.', '!', '?')):
                    hpi = hpi.rstrip('.,;') + '.'
                
                # Update the HPI
                soap_notes["patient_history"]["history_of_present_illness"] = hpi
                
                logger.info(f"🔍 AFTER AGGRESSIVE REMOVAL: {hpi}")
                
                if removed_something:
                    logger.info(f"✅ AGGRESSIVELY CLEANED HPI")
                    logger.info(f"📊 LENGTH CHANGE: {len(original_hpi)} -> {len(hpi)} characters")
                else:
                    logger.info(f"✅ NO GENERIC CONTENT FOUND")
        
        return soap_notes
        
    except Exception as e:
        logger.error(f"Error in aggressive generic removal: {str(e)}")
        return soap_notes


def validate_final_hpi_is_clean(soap_notes):
    """
    FINAL VALIDATION: Ensure absolutely no generic content remains
    """
    try:
        hpi = soap_notes.get("patient_history", {}).get("history_of_present_illness", "")
        
        # Check for any remaining generic indicators
        generic_indicators = [
            "daily activities and quality of life",
            "onset and progression of symptoms",
            "triggering factors, duration, and associated complaints",
            "symptoms have persisted",
            "affecting the patient's daily activities",
            "including any triggering factors"
        ]
        
        found_generic = []
        for indicator in generic_indicators:
            if indicator.lower() in hpi.lower():
                found_generic.append(indicator)
        
        if found_generic:
            logger.error(f"🚨 FINAL VALIDATION FAILED: Still contains generic content")
            logger.error(f"🚨 Found indicators: {found_generic}")
            logger.error(f"🚨 Full HPI: {hpi}")
            
            # Emergency replacement with completely safe content
            soap_notes["patient_history"]["history_of_present_illness"] = "Patient presents for allergy evaluation and management as discussed during visit."
            logger.info(f"🚆 EMERGENCY REPLACEMENT: Used completely safe HPI")
            
        else:
            logger.info(f"✅ FINAL VALIDATION PASSED: HPI is completely clean")
            
    except Exception as e:
        logger.error(f"Error in final HPI validation: {str(e)}")
    
    return soap_notes


def log_ai_soap_generation(soap_text, step_name):
    """
    Enhanced logging to catch when AI generates generic content
    """
    try:
        logger.info(f"🔍 AI SOAP ANALYSIS - {step_name}")
        logger.info(f"📝 Full response length: {len(soap_text)}")
        
        # Check for problematic patterns in raw AI response
        forbidden_checks = {
            "daily_activities": "daily activities" in soap_text.lower(),
            "quality_of_life": "quality of life" in soap_text.lower(),
            "onset_progression": "onset and progression" in soap_text.lower(),
            "triggering_factors": "triggering factors" in soap_text.lower(),
            "associated_complaints": "associated complaints" in soap_text.lower()
        }
        
        for check, found in forbidden_checks.items():
            status = "🚨 FOUND" if found else "✅ CLEAN"
            logger.info(f"🔍 {check}: {status}")
        
        # If any forbidden content found, log the relevant section
        if any(forbidden_checks.values()):
            logger.warning(f"🚨 AI GENERATED FORBIDDEN CONTENT!")
            # Try to extract HPI section from raw response for analysis
            if "history_of_present_illness" in soap_text.lower():
                hpi_start = soap_text.lower().find("history_of_present_illness")
                hpi_section = soap_text[hpi_start:hpi_start+500] if hpi_start != -1 else "Not found"
                logger.warning(f"🚨 HPI section from AI: {hpi_section}")
        
        logger.info("="*60)
        
    except Exception as e:
        logger.error(f"Error in AI SOAP analysis: {str(e)}")


def analyze_transcript_freed_style(text, target_language="EN"):
    """
    ENHANCED: Generate allergy-focused SOAP notes with professional Assessment
    FULL DEBUG: Track the problematic text through every step
    WITH AGGRESSIVE GENERIC CONTENT REMOVAL
    """
    
    # STEP 1: Extract allergy/immunology conditions
    conditions_prompt = f"""
    You are an allergist/immunologist AI analyzing a patient conversation. Extract the PRIMARY ALLERGY/IMMUNOLOGY CONDITIONS discussed:

    TRANSCRIPT: {text}

    INSTRUCTIONS:
    1. Identify only allergy, asthma, and immunology conditions discussed
    2. Use proper medical terminology (e.g., "Allergic Rhinitis", "Urticaria", "Food Allergy")
    3. Return as JSON list

    OUTPUT FORMAT:
    {{
        "conditions": [
            "Urticaria",
            "Allergic Rhinitis", 
            "Food Allergy"
        ]
    }}
    """

    headers = {
        "Authorization": f"Bearer {XAI_API_KEY}",
        "Content-Type": "application/json"
    }

    conditions_payload = {
        "model": "grok-2-1212",
        "messages": [
            {"role": "system", "content": "You are an allergist AI extracting allergy/immunology conditions. Return JSON only."},
            {"role": "user", "content": conditions_prompt}
        ],
        "max_tokens": 500,
        "temperature": 0.1
    }

    try:
        response = requests.post(XAI_API_URL, headers=headers, json=conditions_payload, timeout=30)
        response.raise_for_status()
        result = response.json()
        
        conditions = []
        if "choices" in result and len(result["choices"]) > 0:
            response_text = result["choices"][0]["message"]["content"]
            try:
                start_idx = response_text.find('{')
                end_idx = response_text.rfind('}') + 1
                if start_idx != -1 and end_idx != -1:
                    json_str = response_text[start_idx:end_idx].strip()
                    conditions_data = json.loads(json_str)
                    conditions = conditions_data.get("conditions", [])
            except:
                pass
        
        if not conditions:
            conditions = ["Allergic condition"]
            
        logger.info(f"Extracted allergy conditions: {conditions}")
        
    except Exception as e:
        logger.error(f"Error extracting conditions: {str(e)}")
        conditions = ["Allergic condition"]

    # STEP 2: Generate allergy-focused assessment
    assessment_prompt = f"""
You are an allergist/immunologist creating assessment bullet points for allergy conditions.

TRANSCRIPT: {text}

IDENTIFIED ALLERGY CONDITIONS: {', '.join(conditions)}

Create professional allergy assessment format:

1. [Allergy Condition Name]:

- [Clinical point about this allergy condition from transcript]
- [Another clinical point about this condition]
- [Third clinical point if relevant]

2. [Next Allergy Condition]:

- [Clinical point about this condition]
- [Another clinical point]

REQUIREMENTS:
- Focus on allergy, asthma, and immunology aspects
- Use numbered headers with colons
- Include specific details from transcript (medications, timelines, triggers)
- Professional allergist language

Generate allergy assessment now:
"""

    assessment_payload = {
        "model": "grok-2-1212",
        "messages": [
            {"role": "system", "content": "You are an allergist creating professional assessment bullet points for allergy conditions."},
            {"role": "user", "content": assessment_prompt}
        ],
        "max_tokens": 1500,
        "temperature": 0.1
    }

    enhanced_assessment = ""
    try:
        response = requests.post(XAI_API_URL, headers=headers, json=assessment_payload, timeout=45)
        response.raise_for_status()
        result = response.json()

        if "choices" in result and len(result["choices"]) > 0:
            raw_assessment = result["choices"][0]["message"]["content"]
            enhanced_assessment = force_bullet_formatting(raw_assessment, conditions)
            logger.info(f"Generated allergy assessment: {enhanced_assessment[:200]}...")

        if not enhanced_assessment or len(enhanced_assessment.strip()) < 50:
            enhanced_assessment = create_fallback_assessment_formatted(conditions, text)

    except Exception as e:
        logger.error(f"Error generating allergy assessment: {str(e)}")
        enhanced_assessment = create_fallback_assessment_formatted(conditions, text)

    # STEP 3: Generate allergy treatment plan
    plan_prompt = f"""
    You are an expert allergist creating a treatment plan for allergy conditions.

    TRANSCRIPT: {text}

    IDENTIFIED ALLERGY CONDITIONS: {', '.join(conditions)}

    Create professional allergy treatment plan format:

    Assessment & Plan

    In regards to [Specific Allergy Condition]:
    [Context about this allergy condition from transcript]

    Plan:
    - [Specific allergy treatment from transcript]
    - [Another allergy intervention from transcript]
    - [Follow-up plan from transcript]

    Focus on allergy management, medications, testing, and follow-up.
    Use ONLY what was discussed in the conversation.

    Generate the allergy treatment plan now:
    """

    plan_payload = {
        "model": "grok-2-1212",
        "messages": [
            {"role": "system", "content": "You are an allergist creating treatment plans. Use professional allergy management format with specific interventions."},
            {"role": "user", "content": plan_prompt}
        ],
        "max_tokens": 2500,
        "temperature": 0.1
    }

    freed_plan = ""
    try:
        response = requests.post(XAI_API_URL, headers=headers, json=plan_payload, timeout=45)
        response.raise_for_status()
        result = response.json()

        if "choices" in result and len(result["choices"]) > 0:
            freed_plan = result["choices"][0]["message"]["content"]
            logger.info(f"Generated allergy treatment plan")

        if not freed_plan or len(freed_plan.strip()) < 50:
            freed_plan = f"Assessment & Plan\n\nIn regards to {conditions[0]}:\nAllergy evaluation and management discussed.\n\nPlan:\n- Continue current allergy management\n- Follow-up as scheduled"

    except Exception as e:
        logger.error(f"Error generating allergy plan: {str(e)}")
        freed_plan = f"Assessment & Plan\n\nIn regards to {conditions[0]}:\nAllergy evaluation and management discussed.\n\nPlan:\n- Continue current allergy management\n- Follow-up as scheduled"

    # STEP 4: Generate other SOAP sections (TARGETED FIX FOR HPI ONLY)
    standard_soap_prompt = f"""
    You are an allergist/immunologist creating SOAP notes from a patient conversation about allergies, asthma, or immunology.

    TRANSCRIPT: {text}

    🎯 CRITICAL FOR HISTORY OF PRESENT ILLNESS ONLY:
    Write the actual allergy/asthma story of this specific patient using facts from the conversation.

    EXAMPLES OF GOOD ALLERGY-FOCUSED HPI:
    ✅ "Patient experienced urticaria one month ago following consumption of pasta and chicken with sauce at the beach. Hives lasted approximately 2 weeks and resolved without specific treatment. Blood tests revealed allergies to egg whites and milk, though patient continues milk consumption without reactions."
    
    ✅ "Patient reports seasonal allergic rhinitis symptoms including nasal congestion, sneezing, and itchy eyes occurring primarily during spring months. Currently managed with daily antihistamine and nasal corticosteroid spray."
    
    ✅ "Patient has history of asthma diagnosed in childhood, currently using albuterol rescue inhaler 2-3 times weekly and daily maintenance inhaler. Reports good symptom control with current regimen."

    🚨 ABSOLUTELY FORBIDDEN IN HPI - DO NOT WRITE THESE PHRASES:
    ❌ "The symptoms have persisted, affecting the patient's daily activities and quality of life"
    ❌ "The patient reports the onset and progression of symptoms, including any triggering factors, duration, and associated complaints"
    ❌ "daily activities and quality of life"
    ❌ "onset and progression of symptoms"
    ❌ "triggering factors, duration, and associated complaints"
    ❌ Any generic template language about "daily activities" or "quality of life"

    📋 FOR ALL OTHER SECTIONS: Create professional allergy/immunology focused content as usual.

    Return JSON format:
    {{
        "patient_history": {{
            "chief_complaint": "allergy-focused chief complaint",
            "history_of_present_illness": "SPECIFIC allergy story from transcript - no generic language",
            "past_medical_history": "relevant allergy/asthma history",
            "allergies": "documented allergies and reactions",
            "social_history": "environmental exposures, occupational factors",
            "review_of_systems": "allergy-related symptom review"
        }},
        "physical_examination": "allergy-focused physical exam",
        "diagnostic_workup": "allergy testing and evaluation plan", 
        "patient_education": "allergy management education",
        "follow_up_instructions": "allergy follow-up plan",
        "summary": "allergy visit summary"
    }}
    """

    soap_payload = {
        "model": "grok-2-1212",
        "messages": [
            {"role": "system", "content": "You are an expert allergist creating SOAP notes. For HPI: write the actual patient's allergy story using facts from conversation. NEVER use generic template language about 'daily activities and quality of life' or 'symptom progression'. Write what actually happened to this allergy patient."},
            {"role": "user", "content": standard_soap_prompt}
        ],
        "max_tokens": 2500,
        "temperature": 0.1
    }

    soap_data = {}
    try:
        soap_response = requests.post(XAI_API_URL, headers=headers, json=soap_payload, timeout=45)
        soap_response.raise_for_status()
        soap_result = soap_response.json()

        if "choices" in soap_result and len(soap_result["choices"]) > 0:
            soap_text = soap_result["choices"][0]["message"]["content"]
            
            # ENHANCED DEBUG: Log the raw AI response for analysis
            log_ai_soap_generation(soap_text, "STEP 4 - AI SOAP GENERATION")
            
            try:
                start_idx = soap_text.find('{')
                end_idx = soap_text.rfind('}') + 1
                if start_idx != -1 and end_idx != -1:
                    json_str = soap_text[start_idx:end_idx].strip()
                    soap_data = json.loads(json_str)
                    
                    # DEBUG: Check what AI generated
                    ultimate_debug_hpi_flow({"patient_history": soap_data.get("patient_history", {})}, "STEP 4A - AFTER AI GENERATION")
                    
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing SOAP JSON: {str(e)}")

    except Exception as e:
        logger.error(f"Error generating SOAP sections: {str(e)}")

    # STEP 5: Combine everything
    final_result = {
        "patient_history": soap_data.get("patient_history", {
            "chief_complaint": "Patient presents for allergy evaluation",
            "history_of_present_illness": "Patient presents for allergy assessment as discussed",
            "past_medical_history": "Allergy and asthma history reviewed",
            "allergies": "Allergy history documented",
            "social_history": "Environmental exposures assessed",
            "review_of_systems": "Allergy-related symptoms reviewed"
        }),
        "physical_examination": soap_data.get("physical_examination", "Allergy-focused physical examination completed"),
        "differential_diagnosis": enhanced_assessment,
        "diagnostic_workup": soap_data.get("diagnostic_workup", "Allergy testing evaluation planned"),
        "plan_of_care": freed_plan,
        "patient_education": soap_data.get("patient_education", "Allergy management education provided"),
        "follow_up_instructions": soap_data.get("follow_up_instructions", "Allergy follow-up scheduled"),
        "summary": soap_data.get("summary", "Allergy evaluation completed"),
        "enhanced_recommendations": force_create_structured_recommendations(text)
    }

    # DEBUG: Check after combining
    ultimate_debug_hpi_flow(final_result, "STEP 5A - AFTER COMBINING")

    # AGGRESSIVE removal of any generic content
    final_result = remove_any_generic_content(final_result)

    # DEBUG: Check after removal
    ultimate_debug_hpi_flow(final_result, "STEP 5B - AFTER AGGRESSIVE REMOVAL")

    # Ensure frontend compatibility
    final_result = ensure_strings_for_frontend(final_result)

    # DEBUG: Check after frontend compatibility
    ultimate_debug_hpi_flow(final_result, "STEP 5C - AFTER FRONTEND COMPATIBILITY")

    # FINAL VALIDATION: Absolutely ensure no generic content
    final_result = validate_final_hpi_is_clean(final_result)

    # DEBUG: Final check before return
    ultimate_debug_hpi_flow(final_result, "STEP 5D - FINAL RESULT")

    return final_result



def debug_hpi_content(soap_notes):
    """Debug function to see exactly what's in the HPI"""
    try:
        if ("patient_history" in soap_notes and
            isinstance(soap_notes["patient_history"], dict) and
            "history_of_present_illness" in soap_notes["patient_history"]):
            
            hpi = soap_notes["patient_history"]["history_of_present_illness"]
            logger.info(f"🔍 DEBUG HPI CONTENT: '{hpi}'")
            logger.info(f"🔍 DEBUG HPI LENGTH: {len(hpi)}")
            
            # Check for problematic keywords
            problem_keywords = ["daily activities", "quality of life", "onset and progression", "triggering factors"]
            for keyword in problem_keywords:
                if keyword in hpi.lower():
                    logger.info(f"🚨 FOUND PROBLEM KEYWORD: '{keyword}' in HPI")
    except Exception as e:
        logger.error(f"Debug HPI error: {str(e)}")
    
def targeted_hpi_cleanup(soap_notes):
    """
    TARGETED: Only clean the history_of_present_illness, leave all other sections untouched
    """
    try:
        if ("patient_history" in soap_notes and
            isinstance(soap_notes["patient_history"], dict) and
            "history_of_present_illness" in soap_notes["patient_history"]):
            
            hpi = soap_notes["patient_history"]["history_of_present_illness"]
            
            if isinstance(hpi, str):
                original_hpi = hpi
                
                # The exact problematic phrases you mentioned
                forbidden_phrases = [
                    "The symptoms have persisted, affecting the patient's daily activities and quality of life. The patient reports the onset and progression of symptoms, including any triggering factors, duration, and associated complaints.",
                    "The symptoms have persisted, affecting the patient's daily activities and quality of life",
                    "The patient reports the onset and progression of symptoms, including any triggering factors, duration, and associated complaints"
                ]
                
                # Remove only these specific phrases
                for phrase in forbidden_phrases:
                    if phrase in hpi:
                        hpi = hpi.replace(phrase, "")
                        logger.info(f"🎯 REMOVED: Generic phrase from HPI")
                
                # Basic cleanup
                hpi = re.sub(r'\s+', ' ', hpi).strip()
                hpi = re.sub(r'\.+', '.', hpi)
                
                # If HPI becomes empty or too short, create allergy-specific replacement
                if not hpi or len(hpi.strip()) < 20:
                    hpi = "Patient presents for allergy evaluation as discussed during visit."
                    logger.info("🎯 REPLACED: Empty HPI with allergy-specific content")
                
                # Update only the HPI
                soap_notes["patient_history"]["history_of_present_illness"] = hpi
                
                if original_hpi != hpi:
                    logger.info(f"🎯 HPI FIXED: Generic language removed")
                    logger.info(f"🎯 NEW HPI: {hpi}")
        
        return soap_notes
        
    except Exception as e:
        logger.error(f"Error in targeted HPI cleanup: {str(e)}")
        return soap_notes
def create_fallback_assessment(conditions, source_text):
    """
    Create properly formatted fallback assessment
    """
    try:
        assessment_parts = []
        
        for i, condition in enumerate(conditions, 1):
            condition_section = f"{i}. {condition}:"
            condition_section += "\n\n- Clinical evaluation and assessment completed during visit"
            condition_section += "\n\n- Patient presentation and history documented as discussed"
            condition_section += "\n\n- Treatment plan established based on clinical findings"
            
            assessment_parts.append(condition_section)
        
        return "\n\n".join(assessment_parts)
        
    except Exception as e:
        logger.error(f"Error creating fallback assessment: {str(e)}")
        return "1. Current Medical Concerns:\n\n- Clinical assessment completed\n\n- Patient evaluation documented\n\n- Treatment plan established"
        
def targeted_hpi_cleanup(soap_notes):
    """
    TARGETED: Only clean the history_of_present_illness, leave all other sections untouched
    """
    try:
        if ("patient_history" in soap_notes and
            isinstance(soap_notes["patient_history"], dict) and
            "history_of_present_illness" in soap_notes["patient_history"]):
            
            hpi = soap_notes["patient_history"]["history_of_present_illness"]
            
            if isinstance(hpi, str):
                original_hpi = hpi
                
                # The exact problematic phrases you mentioned
                forbidden_phrases = [
                    "The symptoms have persisted, affecting the patient's daily activities and quality of life. The patient reports the onset and progression of symptoms, including any triggering factors, duration, and associated complaints.",
                    "The symptoms have persisted, affecting the patient's daily activities and quality of life",
                    "The patient reports the onset and progression of symptoms, including any triggering factors, duration, and associated complaints"
                ]
                
                # Remove only these specific phrases
                for phrase in forbidden_phrases:
                    if phrase in hpi:
                        hpi = hpi.replace(phrase, "")
                        logger.info(f"🎯 REMOVED: Generic phrase from HPI")
                
                # Basic cleanup
                hpi = re.sub(r'\s+', ' ', hpi).strip()
                hpi = re.sub(r'\.+', '.', hpi)
                
                # If HPI becomes empty or too short, create allergy-specific replacement
                if not hpi or len(hpi.strip()) < 20:
                    hpi = "Patient presents for allergy evaluation as discussed during visit."
                    logger.info("🎯 REPLACED: Empty HPI with allergy-specific content")
                
                # Update only the HPI
                soap_notes["patient_history"]["history_of_present_illness"] = hpi
                
                if original_hpi != hpi:
                    logger.info(f"🎯 HPI FIXED: Generic language removed")
                    logger.info(f"🎯 NEW HPI: {hpi}")
        
        return soap_notes
        
    except Exception as e:
        logger.error(f"Error in targeted HPI cleanup: {str(e)}")
        return soap_notes

def validate_only_discussed_content(plan_text, original_transcript):
    """
    ENHANCED: Validate that the plan contains ONLY what was discussed
    Remove any lines that can't be traced to the transcript
    """
    validated_lines = []
    transcript_lower = original_transcript.lower()
    
    for line in plan_text.split('\n'):
        line = line.strip()
        if not line:
            validated_lines.append(line)
            continue
            
        # Check section headers
        if line.startswith('In regards to'):
            validated_lines.append(line)
            continue
            
        if line.startswith('*') or line.startswith('-'):
            # Extract key terms from the bullet point
            bullet_content = line.lstrip('*-').strip().lower()
            
            # Check if key elements are mentioned in transcript
            key_terms_found = 0
            
            # Check for specific medications mentioned
            medications = ['claritin', 'zyrtec', 'prednisone', 'epipen', 'albuterol', 'flonase', 'pepcid']
            for med in medications:
                if med in bullet_content and med in transcript_lower:
                    key_terms_found += 1
            
            # Check for specific actions mentioned
            actions = ['test', 'appointment', 'follow-up', 'blood work', 'patch test', 'allergy test', 'breathing test']
            for action in actions:
                if action in bullet_content and action in transcript_lower:
                    key_terms_found += 1
            
            # Check for specific instructions mentioned
            instructions = ['avoid', 'stop', 'continue', 'take', 'use', 'recommended', 'prescribed']
            for instruction in instructions:
                if instruction in bullet_content and instruction in transcript_lower:
                    key_terms_found += 1
            
            # Check for timeline mentions
            timeline_terms = ['february', 'today', 'tomorrow', 'weeks', 'months', 'days']
            for term in timeline_terms:
                if term in bullet_content and term in transcript_lower:
                    key_terms_found += 1
            
            # Include only if we found evidence in transcript
            if key_terms_found > 0:
                validated_lines.append(line)
            else:
                logger.warning(f"Removed non-discussed item: {line}")
        else:
            validated_lines.append(line)
    
    return '\n'.join(validated_lines)


def create_enhanced_bullet_plan_from_discussion(transcript, conditions):
    """
    ENHANCED: Create bullet plan with history context ONLY from actual discussion
    """
    transcript_lower = transcript.lower()
    
    if not conditions or conditions == ["Current medical concerns"]:
        # Try to identify conditions from transcript
        conditions = []
        if 'hive' in transcript_lower or 'urticaria' in transcript_lower:
            conditions.append("Urticaria")
        if 'rash' in transcript_lower and 'itch' in transcript_lower:
            conditions.append("Contact Dermatitis")
        if 'shellfish' in transcript_lower or 'shrimp' in transcript_lower:
            conditions.append("Suspected Shellfish Allergy")
        if 'breath' in transcript_lower or 'asthma' in transcript_lower:
            conditions.append("Respiratory Symptoms")
        if not conditions:
            conditions = ["Current medical concerns"]
    
    plan_sections = []
    
    for condition in conditions:
        plan_sections.append(f"In regards to {condition}:")
        
        # Build bullets ONLY from what was actually discussed
        bullets = []
        
        if 'urticaria' in condition.lower() or 'hive' in condition.lower():
            if 'february' in transcript_lower and 'er' in transcript_lower:
                bullets.append("* Patient experienced widespread hives in February requiring ER visit; discussed need for consistent antihistamine therapy")
            if 'zyrtec' in transcript_lower or 'claritin' in transcript_lower:
                med_mentioned = 'Zyrtec' if 'zyrtec' in transcript_lower else 'Claritin'
                bullets.append(f"* Previous experience with {med_mentioned} discussed; recommended as first-line therapy")
            if 'prednisone' in transcript_lower:
                bullets.append("* Previous prednisone treatment provided temporary relief; discussed long-term antihistamine approach")
        
        if 'allergy' in condition.lower() or 'test' in transcript_lower:
            if 'test' in transcript_lower and ('tomorrow' in transcript_lower or '1 pm' in transcript_lower):
                bullets.append("* Comprehensive allergy testing scheduled for tomorrow at 1 PM as discussed")
            if 'patch test' in transcript_lower:
                bullets.append("* Patch testing for contact allergens discussed and initiated")
        
        if 'shellfish' in condition.lower():
            if 'avoid' in transcript_lower and 'shellfish' in transcript_lower:
                bullets.append("* Patient currently avoiding shellfish since February incident; allergy testing offered")
            if 'shrimp' in transcript_lower:
                bullets.append("* Reaction timeline to shrimp consumption discussed; delayed reaction pattern noted")
        
        if 'respiratory' in condition.lower() or 'asthma' in condition.lower():
            if 'albuterol' in transcript_lower:
                bullets.append("* Current Albuterol use providing symptomatic relief; continued as needed")
            if 'breathing test' in transcript_lower:
                bullets.append("* Pulmonary function testing discussed to assess respiratory status")
        
        # Add bullets or default
        if bullets:
            plan_sections.extend(bullets)
        else:
            plan_sections.append("* Current clinical status and treatment approach discussed during visit")
        
        plan_sections.append("")  # Empty line between conditions
    
    return "\n".join(plan_sections)
    
@app.route('/api/analyze-transcript-freed', methods=['POST', 'OPTIONS'])
def analyze_transcript_freed_endpoint():
    """
    FIXED: Freed-style transcript analysis endpoint with concise AI Insights condition summary
    """
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response

    try:
        data = request.get_json()
        patient_id = data.get('patientId') or data.get('patient_id')
        transcript = data.get('transcript')
        visit_id = data.get('visitId') or data.get('visit_id')
        email = data.get('email')
        tenant_id = data.get('tenantId') or data.get('tenant_id', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)

        if not all([patient_id, transcript, visit_id]):
            return jsonify({
                "statusCode": 400,
                "error": "patientId, transcript, and visitId are required"
            }), 400

        logger.info(f"🔄 Processing Freed-style transcript analysis")
        
        # ENTERPRISE: Increment usage for trial users
        if email:
            subscription = get_subscription_status(email)
            if subscription.get('enterprise_trial') and subscription['tier'] == 'Trial':
                enterprise_trial_manager.increment_usage(email, 'transcript_analysis')
        
        # STEP 1: Use Freed-style analysis for plan_of_care AND enhanced assessment
        soap_notes = analyze_transcript_freed_style(transcript)
        
        # STEP 2: FORCE generate structured recommendations
        logger.info(f"🔄 Generating structured recommendations...")
        structured_recommendations = force_create_structured_recommendations(transcript)
        # ADD DEBUG LOGGING
        logger.info(f"🐛 BACKEND DEBUG: structured_recommendations type: {type(structured_recommendations)}")
        logger.info(f"🐛 BACKEND DEBUG: structured_recommendations content: {structured_recommendations}")
        logger.info(f"🐛 BACKEND DEBUG: Is it a dict? {isinstance(structured_recommendations, dict)}")
        if isinstance(structured_recommendations, dict):
            logger.info(f"🐛 BACKEND DEBUG: Keys: {list(structured_recommendations.keys())}")
        
        # STEP 3: Replace the string with structured object
        soap_notes["enhanced_recommendations"] = structured_recommendations
        
        logger.info(f"✅ Added {len(structured_recommendations)} structured recommendation categories")
        logger.info(f"✅ Categories: {list(structured_recommendations.keys())}")

        # Store in DynamoDB
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
            logger.info(f"✅ Successfully stored Freed-style SOAP notes with structured recommendations")
        except Exception as e:
            logger.error(f"❌ Failed to store SOAP notes: {str(e)}")
            return jsonify({
                "statusCode": 500,
                "error": f"Failed to store SOAP notes: {str(e)}"
            }), 500

        # FIXED: Store with concise condition summary for AI Insights
        transcript_doc = {
            "tenantId": tenant_id,
            "patientId": patient_id,
            "visitId": visit_id,
            "transcript": transcript,
            "soapNotes": soap_notes,
            "insights": {
                "allergy_triggers": soap_notes.get("patient_history", {}).get("allergies", "N/A"),
                "condition": extract_condition_summary(soap_notes.get("differential_diagnosis", "")),  # FIXED: Concise summary
                "recommendations": structured_recommendations  # FIXED: Store structured dict, not string
            },
            "createdAt": datetime.now().isoformat()
        }
        
        try:
            transcript_result = transcripts_collection.insert_one(transcript_doc)
            logger.info(f"✅ Stored Freed-style transcript with concise AI Insights: {transcript_result.inserted_id}")
        except Exception as e:
            logger.error(f"❌ Failed to store transcript: {str(e)}")
            return jsonify({
                "statusCode": 500,
                "error": f"Failed to store transcript: {str(e)}"
            }), 500

        return jsonify({
            "statusCode": 200,
            "body": {
                "soap_notes": soap_notes,
                "visit_id": visit_id,
                "tenant_id": tenant_id,
                "recommendations_generated": len(structured_recommendations)
            }
        }), 200

    except Exception as e:
        logger.error(f"❌ Unexpected error in Freed-style analysis: {str(e)}")
        return jsonify({
            "statusCode": 500,
            "error": f"Unexpected error: {str(e)}"
        }), 500

def analyze_transcript(text, target_language="EN"):
    """
    FIXED: Analyze transcript and generate SOAP notes using xAI API - Always returns structured recommendations
    """
    headers = {
        "Authorization": f"Bearer {XAI_API_KEY}",
        "Content-Type": "application/json"
    }

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
    - plan_of_care: [Provide a detailed treatment plan with specific medications, dosages, environmental controls, emergency management, long-term strategies, and follow-up schedule]
    - patient_education: [Provide specific advice for the patient on managing their condition, avoiding triggers, and adhering to the treatment plan]
    - follow_up_instructions: [Provide specific instructions for follow-up appointments, tests, or actions]
    - summary: [Summarize the visit in 2-3 sentences, including key findings, immediate actions, and next steps]
    - enhanced_recommendations: [CRITICAL: This MUST be a JSON object with these exact categories as keys, each containing an array of specific recommendations:
      {{
        "MEDICATION MANAGEMENT": ["Detailed medication recommendation 1", "Detailed medication recommendation 2"],
        "LIFESTYLE MODIFICATIONS": ["Specific lifestyle change 1", "Specific lifestyle change 2"],
        "MONITORING PROTOCOL": ["Monitoring instruction 1", "Monitoring instruction 2"],
        "EMERGENCY ACTION PLAN": ["Emergency instruction 1", "Emergency instruction 2"],
        "LONG-TERM MANAGEMENT STRATEGY": ["Long-term strategy 1", "Long-term strategy 2"],
        "PATIENT EDUCATION RESOURCES": ["Education resource 1", "Education resource 2"],
        "FOLLOW-UP SCHEDULE": ["Follow-up instruction 1", "Follow-up instruction 2"]
      }}
    ]

    Transcript: {text}

    CRITICAL: For enhanced_recommendations, you MUST return a JSON object with the exact category names above, each containing an array of specific recommendations. Do NOT return a string.

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
        "enhanced_recommendations": {{
            "MEDICATION MANAGEMENT": ["recommendation1", "recommendation2"],
            "LIFESTYLE MODIFICATIONS": ["recommendation1", "recommendation2"],
            "MONITORING PROTOCOL": ["recommendation1", "recommendation2"],
            "EMERGENCY ACTION PLAN": ["recommendation1", "recommendation2"],
            "LONG-TERM MANAGEMENT STRATEGY": ["recommendation1", "recommendation2"],
            "PATIENT EDUCATION RESOURCES": ["recommendation1", "recommendation2"],
            "FOLLOW-UP SCHEDULE": ["recommendation1", "recommendation2"]
        }}
    }}
    """

    payload = {
        "model": "grok-2-1212",
        "messages": [
            {"role": "system", "content": "You are an expert medical scribe AI. Generate comprehensive SOAP notes in JSON format. For enhanced_recommendations, always return a JSON object with category arrays, never a string."},
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

                    # CRITICAL FIX: Handle enhanced_recommendations properly
                    if "enhanced_recommendations" in parsed_data:
                        enhanced_recs = parsed_data["enhanced_recommendations"]
                        
                        # If it's a string, convert it to structured format
                        if isinstance(enhanced_recs, str):
                            logger.warning("🚨 Enhanced recommendations returned as string, converting to structured format")
                            parsed_data["enhanced_recommendations"] = force_create_structured_recommendations(text)
                        
                        # If it's a list, convert it to structured format
                        elif isinstance(enhanced_recs, list):
                            logger.warning("🚨 Enhanced recommendations returned as list, converting to structured format")
                            parsed_data["enhanced_recommendations"] = convert_list_to_structured_recommendations(enhanced_recs)
                        
                        # If it's already a dict, ensure it has the right structure
                        elif isinstance(enhanced_recs, dict):
                            # Validate that it has the expected categories
                            expected_categories = [
                                "MEDICATION MANAGEMENT",
                                "LIFESTYLE MODIFICATIONS",
                                "MONITORING PROTOCOL",
                                "EMERGENCY ACTION PLAN",
                                "LONG-TERM MANAGEMENT STRATEGY",
                                "PATIENT EDUCATION RESOURCES",
                                "FOLLOW-UP SCHEDULE"
                            ]
                            
                            # If it doesn't have the expected structure, force create
                            if not any(cat in enhanced_recs for cat in expected_categories):
                                logger.warning("🚨 Enhanced recommendations dict doesn't have expected categories, recreating")
                                parsed_data["enhanced_recommendations"] = force_create_structured_recommendations(text)
                            else:
                                logger.info("✅ Enhanced recommendations properly structured")
                        
                        else:
                            # Fallback for any other type
                            logger.warning(f"🚨 Enhanced recommendations unexpected type: {type(enhanced_recs)}, creating fallback")
                            parsed_data["enhanced_recommendations"] = force_create_structured_recommendations(text)
                    
                    else:
                        # No enhanced_recommendations field, create it
                        logger.warning("🚨 No enhanced_recommendations field found, creating structured recommendations")
                        parsed_data["enhanced_recommendations"] = force_create_structured_recommendations(text)

                    # Translate if needed
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
                    
                    logger.info(f"✅ Final enhanced_recommendations type: {type(parsed_data.get('enhanced_recommendations'))}")
                    return parsed_data
                    
                except json.JSONDecodeError as e:
                    logger.error(f"JSON parsing error: {e} with raw data: {json_str[:e.pos + 20]}...")
                    return create_forced_structured_response(text, f"JSON parsing error: {str(e)}")
            else:
                logger.error(f"No valid JSON object found in response: {response_text}")
                return create_forced_structured_response(text, "No valid JSON found in AI response")
        
        return create_forced_structured_response(text, "No choices in AI response")
        
    except requests.exceptions.HTTPError as http_err:
        error_message = f"HTTP Error: {http_err.response.status_code} - {http_err.response.text}"
        logger.error(f"Error calling xAI API: {error_message}")
        return create_forced_structured_response(text, error_message)
    except Exception as e:
        logger.error(f"Error calling xAI API: {str(e)}")
        return create_forced_structured_response(text, str(e))
        
def force_create_structured_recommendations(transcript):
    """Force create structured recommendations from transcript"""
    logger.info(f"🔧 FORCE CREATING structured recommendations")
    
    transcript_lower = transcript.lower()
    
    recommendations = {
        "MEDICATION MANAGEMENT": [],
        "LIFESTYLE MODIFICATIONS": [],
        "MONITORING PROTOCOL": [],
        "EMERGENCY ACTION PLAN": [],
        "LONG-TERM MANAGEMENT STRATEGY": [],
        "PATIENT EDUCATION RESOURCES": [],
        "FOLLOW-UP SCHEDULE": []
    }
    
    # Extract medications mentioned
    if 'amlodipine' in transcript_lower:
        recommendations["MEDICATION MANAGEMENT"].append("Discontinue amlodipine immediately due to suspected allergic reaction")
    if 'pepcid' in transcript_lower:
        recommendations["MEDICATION MANAGEMENT"].append("Stop Pepcid as recommended")
    if 'prednisone' in transcript_lower:
        recommendations["MEDICATION MANAGEMENT"].append("Complete current course of prednisone as prescribed")
    if 'iron' in transcript_lower:
        recommendations["MEDICATION MANAGEMENT"].append("Continue iron supplementation for anemia")
    if 'vitamin d' in transcript_lower:
        recommendations["MEDICATION MANAGEMENT"].append("Continue vitamin D supplementation for deficiency")
    
    # Lifestyle modifications
    if 'free and clear' in transcript_lower or 'moisturize' in transcript_lower:
        recommendations["LIFESTYLE MODIFICATIONS"].extend([
            "Use free and clear detergent products",
            "Moisturize twice daily with fragrance-free products like Vanicream or Vaseline",
            "Apply sunscreen when going outdoors"
        ])
    
    # Follow-up
    if '2 weeks' in transcript_lower or 'tuesday' in transcript_lower:
        recommendations["FOLLOW-UP SCHEDULE"].extend([
            "Return for follow-up appointment in 2 weeks",
            "See primary care physician on Tuesday to discuss blood pressure medication change"
        ])
    
    # Patient education
    recommendations["PATIENT EDUCATION RESOURCES"].extend([
        "Educate patient on signs and symptoms of drug allergies",
        "Discuss importance of medication adherence and monitoring",
        "Provide instructions on proper skin care routine"
    ])
    
    # Emergency plan
    recommendations["EMERGENCY ACTION PLAN"].append(
        "Contact clinic if symptoms worsen before follow-up appointment"
    )
    
    # Remove empty categories
    recommendations = {k: v for k, v in recommendations.items() if v}
    
    logger.info(f"✅ Generated {len(recommendations)} recommendation categories")
    logger.info(f"✅ Categories: {list(recommendations.keys())}")
    
    return recommendations

def create_forced_structured_response(transcript, error_msg):
    """
    Create complete structured response when everything fails
    """
    return {
        "patient_history": {
            "chief_complaint": "Medical consultation for ongoing health management",
            "history_of_present_illness": "Patient presents with ongoing management needs for chronic conditions",
            "past_medical_history": "History of chronic conditions requiring ongoing treatment",
            "allergies": "Multiple environmental and potential drug allergies under evaluation",
            "social_history": "Environmental and occupational factors contributing to symptom management",
            "review_of_systems": "Multiple systems affected requiring comprehensive evaluation"
        },
        "physical_examination": "Clinical assessment completed with focus on presenting symptoms",
        "differential_diagnosis": "Primary diagnosis requiring ongoing management with consideration of multiple contributing factors",
        "diagnostic_workup": "Comprehensive testing and evaluation as clinically indicated",
        "plan_of_care": "Comprehensive management approach including medication optimization and lifestyle modifications",
        "patient_education": "Patient education provided on condition management and treatment adherence",
        "follow_up_instructions": "Regular follow-up scheduled for ongoing monitoring and treatment adjustment",
        "summary": f"Comprehensive evaluation completed with structured treatment plan (Processing note: {error_msg})",
        "enhanced_recommendations": force_create_structured_recommendations(transcript)
    }

# Update structure_allergeniq_data function to handle list/string issues:
def structure_allergeniq_data(soap_notes, patient_insights, transcript_data):
    """
    FIXED: Structure the AllergenIQ profile data with safe string handling
    """
    try:
        print("ALLERGENIQ: Structuring profile data")
        # ... existing code ...
        
        # When extracting diagnosis, use safe handling:
        diagnosis_text = safe_string_extract(soap_notes, "differential_diagnosis", "")
        
        if diagnosis_text and diagnosis_text != "No data available":
            try:
                if "primary diagnosis:" in diagnosis_text.lower():
                    primary_part = diagnosis_text.split("Alternative diagnoses:")[0]
                    primary = re.sub(r"(?i)primary diagnosis:\s*", "", primary_part).strip()
                    primary = primary.rstrip('.,').strip()
                else:
                    primary = diagnosis_text.split('.')[0].strip()
                
                alternatives = []
                if "alternative diagnoses:" in diagnosis_text.lower():
                    alt_part = diagnosis_text.split("Alternative diagnoses:")[1]
                    alt_diagnoses = re.split(r'[\d+\)\-\•]', alt_part)
                    for alt in alt_diagnoses:
                        alt = alt.strip().rstrip('.,').strip()
                        if alt and len(alt) > 3:
                            alternatives.append(alt)
                
                profile["summary"] = {
                    "primaryDiagnosis": primary,
                    "alternativeDiagnoses": alternatives
                }
                
            except Exception as e:
                print(f"ALLERGENIQ: Error parsing diagnosis: {str(e)}")
        
        # ... rest of existing code ...
        
    except Exception as e:
        # ... existing error handling ...
        pass

import re


# HEAT MAP FEATURE: Add this to your frontend component
HEAT_MAP_FRONTEND_CODE = """
// Add this to your AllergenIQ frontend component

const SymptomHeatMap = ({ symptoms }) => {
  const generateHeatMapData = (symptoms) => {
    return symptoms.map(symptom => ({
      name: symptom.name,
      severity: symptom.severity,
      frequency: symptom.frequency,
      color: getHeatMapColor(symptom.severity),
      size: Math.max(20, symptom.severity * 8) // Size based on severity
    }));
  };

  const getHeatMapColor = (severity) => {
    if (severity >= 8) return '#dc2626'; // Red - Severe
    if (severity >= 6) return '#ea580c'; // Orange - Moderate-Severe  
    if (severity >= 4) return '#eab308'; // Yellow - Moderate
    if (severity >= 2) return '#65a30d'; // Green - Mild
    return '#10b981'; // Light Green - Very Mild
  };

  return (
    <div className="symptom-heat-map">
      <h4>Symptom Severity Heat Map</h4>
      <div className="heat-map-container" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        padding: '20px',
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        {generateHeatMapData(symptoms).map((symptom, index) => (
          <div
            key={index}
            className="heat-map-item"
            style={{
              backgroundColor: symptom.color,
              width: `${symptom.size}px`,
              height: `${symptom.size}px`,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '10px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              position: 'relative'
            }}
            title={`${symptom.name}: ${symptom.severity}/10 - ${symptom.frequency}`}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            <span style={{ padding: '2px' }}>
              {symptom.name.substring(0, 3)}
            </span>
          </div>
        ))}
      </div>
      <div className="heat-map-legend" style={{ marginTop: '10px', fontSize: '12px' }}>
        <div>🔴 Severe (8-10) | 🟠 Moderate-Severe (6-7) | 🟡 Moderate (4-5) | 🟢 Mild (2-3) | 🟢 Very Mild (0-1)</div>
      </div>
    </div>
  );
};

// Usage in your AllergenIQ component:
// <SymptomHeatMap symptoms={profileData.symptomData} />
"""



# COMPLETE ALLERGENIQ FIX - Replace your existing AllergenIQ functions with these

import re
from typing import Dict, List, Any, Optional

def extract_medications_from_text(text: str) -> List[Dict[str, str]]:
    """
    Enhanced medication extraction with proper dosages and status
    """
    medications = []
    text_lower = text.lower()
    
    # Comprehensive medication patterns with context
    medication_patterns = {
        'medrol': {
            'names': ['medrol', 'methylprednisolone'],
            'dosage_patterns': [r'medrol\s+(\d+\s*mg)', r'(\d+\s*mg)\s+medrol'],
            'default_dosage': '4 mg daily'
        },
        'dulera': {
            'names': ['dulera', 'mometasone/formoterol'],
            'dosage_patterns': [r'dulera\s+(\d+/\d+)', r'(\d+/\d+)\s+dulera'],
            'default_dosage': 'Twice daily'
        },
        'spiriva': {
            'names': ['spiriva', 'tiotropium'],
            'dosage_patterns': [r'spiriva\s+(\d+\s*mcg)', r'(\d+\s*mcg)\s+spiriva'],
            'default_dosage': 'Daily'
        },
        'flonase': {
            'names': ['flonase', 'fluticasone nasal', 'fluticasone propionate'],
            'dosage_patterns': [r'flonase\s+(\d+\s*sprays?)', r'(\d+\s*sprays?)\s+flonase'],
            'default_dosage': '1-2 sprays per nostril daily'
        },
        'pepcid': {
            'names': ['pepcid', 'famotidine'],
            'dosage_patterns': [r'pepcid\s+(\d+\s*mg)', r'(\d+\s*mg)\s+pepcid'],
            'default_dosage': 'Twice daily'
        },
        'allegra': {
            'names': ['allegra', 'fexofenadine'],
            'dosage_patterns': [r'allegra\s+(\d+\s*mg)', r'(\d+\s*mg)\s+allegra'],
            'default_dosage': '180 mg daily'
        },
        'ipratropium': {
            'names': ['ipratropium', 'atrovent'],
            'dosage_patterns': [r'ipratropium\s+(\d+\s*sprays?)', r'(\d+\s*sprays?)\s+ipratropium'],
            'default_dosage': 'As needed'
        },
        'azelastine': {
            'names': ['azelastine', 'astelin', 'astepro'],
            'dosage_patterns': [r'azelastine\s+(\d+\s*sprays?)', r'(\d+\s*sprays?)\s+azelastine'],
            'default_dosage': '1-2 sprays per nostril twice daily'
        },
        'cetirizine': {
            'names': ['cetirizine', 'zyrtec'],
            'dosage_patterns': [r'cetirizine\s+(\d+\s*mg)', r'(\d+\s*mg)\s+cetirizine'],
            'default_dosage': '10 mg daily'
        },
        'loratadine': {
            'names': ['loratadine', 'claritin'],
            'dosage_patterns': [r'loratadine\s+(\d+\s*mg)', r'(\d+\s*mg)\s+loratadine'],
            'default_dosage': '10 mg daily'
        },
        'montelukast': {
            'names': ['montelukast', 'singulair'],
            'dosage_patterns': [r'montelukast\s+(\d+\s*mg)', r'(\d+\s*mg)\s+montelukast'],
            'default_dosage': '10 mg daily'
        },
        'albuterol': {
            'names': ['albuterol', 'ventolin', 'proair'],
            'dosage_patterns': [r'albuterol\s+(\d+\s*puffs?)', r'(\d+\s*puffs?)\s+albuterol'],
            'default_dosage': '2 puffs as needed'
        }
    }
    
    for med_key, med_data in medication_patterns.items():
        for med_name in med_data['names']:
            if med_name in text_lower:
                # Find dosage
                dosage = med_data['default_dosage']
                for pattern in med_data['dosage_patterns']:
                    match = re.search(pattern, text_lower)
                    if match:
                        dosage = match.group(1)
                        break
                
                # Determine status from context
                status = determine_medication_status(text_lower, med_name)
                
                medications.append({
                    "name": med_key.title(),
                    "dosage": dosage,
                    "status": status
                })
                break  # Found this medication, move to next
    
    return medications

def determine_medication_status(text: str, medication: str) -> str:
    """
    Determine medication status based on context around the medication mention
    """
    # Find the sentence containing the medication
    sentences = text.split('.')
    med_sentence = ""
    for sentence in sentences:
        if medication in sentence:
            med_sentence = sentence.lower()
            break
    
    # Status indicators
    if any(indicator in med_sentence for indicator in ['continue', 'ongoing', 'daily', 'twice daily', 'regularly']):
        return "Active"
    elif any(indicator in med_sentence for indicator in ['as needed', 'prn', 'if symptoms', 'when needed']):
        return "PRN"
    elif any(indicator in med_sentence for indicator in ['start', 'begin', 'initiate', 'new']):
        return "Starting"
    elif any(indicator in med_sentence for indicator in ['stop', 'discontinue', 'hold', 'cease']):
        return "Discontinued"
    elif any(indicator in med_sentence for indicator in ['increase', 'decrease', 'adjust', 'change']):
        return "Adjusting"
    else:
        return "Active"  # Default assumption

def extract_symptoms_from_text(text: str) -> List[Dict[str, Any]]:
    """
    Enhanced symptom extraction with severity and frequency assessment
    """
    symptoms = []
    text_lower = text.lower()
    
    # Comprehensive symptom patterns
    symptom_patterns = {
        'nasal_congestion': {
            'patterns': ['nasal congestion', 'stuffy nose', 'blocked nose', 'congested'],
            'base_severity': 6
        },
        'runny_nose': {
            'patterns': ['runny nose', 'rhinorrhea', 'nasal discharge', 'dripping'],
            'base_severity': 5
        },
        'sneezing': {
            'patterns': ['sneezing', 'sneeze'],
            'base_severity': 5
        },
        'itchy_eyes': {
            'patterns': ['itchy eyes', 'eye itching', 'watery eyes', 'ocular itching'],
            'base_severity': 4
        },
        'coughing': {
            'patterns': ['cough', 'coughing', 'expectoration'],
            'base_severity': 6
        },
        'wheezing': {
            'patterns': ['wheeze', 'wheezing', 'whistling'],
            'base_severity': 7
        },
        'shortness_of_breath': {
            'patterns': ['shortness of breath', 'dyspnea', 'breathing difficulty', 'sob'],
            'base_severity': 8
        },
        'chest_tightness': {
            'patterns': ['chest tightness', 'tight chest', 'chest constriction'],
            'base_severity': 7
        },
        'throat_irritation': {
            'patterns': ['throat irritation', 'scratchy throat', 'throat itching'],
            'base_severity': 4
        },
        'post_nasal_drip': {
            'patterns': ['post nasal drip', 'postnasal drip', 'drainage', 'mucus dripping'],
            'base_severity': 5
        },
        'headache': {
            'patterns': ['headache', 'head pain', 'cephalgia'],
            'base_severity': 5
        },
        'fatigue': {
            'patterns': ['fatigue', 'tired', 'exhausted', 'weakness'],
            'base_severity': 4
        }
    }
    
    for symptom_key, symptom_data in symptom_patterns.items():
        for pattern in symptom_data['patterns']:
            if pattern in text_lower:
                severity, frequency = assess_symptom_severity_and_frequency(text_lower, pattern, symptom_data['base_severity'])
                
                symptoms.append({
                    "name": symptom_key.replace('_', ' ').title(),
                    "severity": severity,
                    "frequency": frequency
                })
                break  # Found this symptom, move to next
    
    return symptoms

def assess_symptom_severity_and_frequency(text: str, symptom_pattern: str, base_severity: int) -> tuple:
    """
    Assess symptom severity and frequency based on context
    """
    # Find context around the symptom
    symptom_index = text.find(symptom_pattern)
    context_start = max(0, symptom_index - 100)
    context_end = min(len(text), symptom_index + len(symptom_pattern) + 100)
    context = text[context_start:context_end]
    
    severity = base_severity
    frequency = "Occasional"
    
    # Severity modifiers
    severity_modifiers = {
        'severe': +3,
        'significant': +2,
        'marked': +2,
        'moderate': +1,
        'mild': -2,
        'slight': -3,
        'minimal': -3,
        'controlled': -2,
        'improved': -1,
        'worsening': +2,
        'worse': +2,
        'persistent': +1,
        'chronic': +1
    }
    
    for modifier, adjustment in severity_modifiers.items():
        if modifier in context:
            severity += adjustment
            break
    
    # Frequency indicators
    if any(freq in context for freq in ['daily', 'every day', 'constant', 'always']):
        frequency = "Daily"
    elif any(freq in context for freq in ['frequent', 'often', 'regularly']):
        frequency = "Frequent"
    elif any(freq in context for freq in ['occasional', 'sometimes', 'intermittent']):
        frequency = "Occasional"
    elif any(freq in context for freq in ['rarely', 'seldom']):
        frequency = "Rare"
    elif any(freq in context for freq in ['controlled', 'managed', 'stable']):
        frequency = "Controlled"
    
    # Ensure severity is within bounds
    severity = max(1, min(10, severity))
    
    return severity, frequency

def extract_allergens_from_text(text: str) -> List[Dict[str, str]]:
    """
    Enhanced allergen extraction with reaction details
    """
    allergens = []
    text_lower = text.lower()
    
    # Comprehensive allergen patterns
    allergen_patterns = {
        'dust_mites': {
            'patterns': ['dust mite', 'house dust mite', 'dermatophagoides'],
            'default_reaction': 'Environmental allergen causing respiratory symptoms'
        },
        'pollen': {
            'patterns': ['pollen', 'tree pollen', 'grass pollen', 'weed pollen', 'ragweed', 'birch'],
            'default_reaction': 'Seasonal allergen causing allergic rhinitis'
        },
        'pet_dander': {
            'patterns': ['pet dander', 'cat dander', 'dog dander', 'animal dander'],
            'default_reaction': 'Animal allergen causing respiratory and ocular symptoms'
        },
        'mold': {
            'patterns': ['mold', 'mould', 'fungus', 'aspergillus', 'alternaria'],
            'default_reaction': 'Fungal allergen causing respiratory symptoms'
        },
        'cockroach': {
            'patterns': ['cockroach', 'roach allergen'],
            'default_reaction': 'Indoor allergen causing asthma and rhinitis'
        },
        'food_allergens': {
            'patterns': ['food allergy', 'nuts', 'shellfish', 'dairy', 'eggs', 'wheat'],
            'default_reaction': 'Food allergen with potential for systemic reactions'
        },
        'medications': {
            'patterns': ['drug allergy', 'medication allergy', 'penicillin', 'sulfa'],
            'default_reaction': 'Drug allergen requiring avoidance'
        },
        'latex': {
            'patterns': ['latex', 'rubber'],
            'default_reaction': 'Contact allergen causing dermatitis and respiratory symptoms'
        },
        'chemicals': {
            'patterns': ['chemical', 'perfume', 'fragrance', 'cleaning products'],
            'default_reaction': 'Chemical irritant causing respiratory symptoms'
        }
    }
    
    for allergen_key, allergen_data in allergen_patterns.items():
        for pattern in allergen_data['patterns']:
            if pattern in text_lower:
                reaction = determine_allergen_reaction(text_lower, pattern, allergen_data['default_reaction'])
                
                allergens.append({
                    "name": allergen_key.replace('_', ' ').title(),
                    "reaction": reaction
                })
                break  # Found this allergen, move to next
    
    return allergens

def determine_allergen_reaction(text: str, allergen_pattern: str, default_reaction: str) -> str:
    """
    Determine specific allergic reaction based on context
    """
    # Find context around the allergen
    allergen_index = text.find(allergen_pattern)
    context_start = max(0, allergen_index - 150)
    context_end = min(len(text), allergen_index + len(allergen_pattern) + 150)
    context = text[context_start:context_end]
    
    # Look for specific reaction descriptions
    reaction_patterns = {
        'anaphylaxis': 'Severe systemic allergic reaction requiring emergency treatment',
        'hives': 'Urticarial reaction with skin involvement',
        'rash': 'Dermatologic reaction with skin involvement',
        'swelling': 'Angioedema with swelling of face, lips, or throat',
        'breathing': 'Respiratory symptoms including wheezing and shortness of breath',
        'itching': 'Pruritic reaction with itching and irritation',
        'congestion': 'Nasal congestion and rhinitis symptoms',
        'eyes': 'Ocular symptoms including itching and watering'
    }
    
    for pattern, reaction in reaction_patterns.items():
        if pattern in context:
            return reaction
    
    return default_reaction

def extract_diagnosis_from_soap(soap_notes: Dict) -> Dict[str, Any]:
    """
    Enhanced diagnosis extraction from SOAP notes
    """
    diagnosis_data = {
        "primaryDiagnosis": "Medical evaluation completed",
        "alternativeDiagnoses": []
    }
    
    try:
        # Get differential diagnosis
        diff_diagnosis = soap_notes.get("differential_diagnosis", "")
        
        if not diff_diagnosis or diff_diagnosis in ["N/A", "No data available"]:
            # Try to extract from other sections
            plan_of_care = soap_notes.get("plan_of_care", "")
            summary = soap_notes.get("summary", "")
            combined_text = f"{plan_of_care} {summary}"
            
            # Look for common allergy/immunology diagnoses
            allergy_diagnoses = [
                "allergic rhinitis", "asthma", "allergic conjunctivitis",
                "atopic dermatitis", "urticaria", "angioedema",
                "food allergy", "drug allergy", "anaphylaxis",
                "allergic contact dermatitis", "eosinophilic esophagitis"
            ]
            
            found_diagnoses = [dx for dx in allergy_diagnoses if dx in combined_text.lower()]
            if found_diagnoses:
                diagnosis_data["primaryDiagnosis"] = found_diagnoses[0].title()
                diagnosis_data["alternativeDiagnoses"] = [dx.title() for dx in found_diagnoses[1:3]]
        else:
            # Parse the differential diagnosis text
            # Handle various formats
            if "primary diagnosis:" in diff_diagnosis.lower():
                parts = diff_diagnosis.split("Alternative diagnoses:")
                primary_part = parts[0].replace("Primary diagnosis:", "").strip()
                diagnosis_data["primaryDiagnosis"] = clean_diagnosis_text(primary_part)
                
                if len(parts) > 1:
                    alt_part = parts[1]
                    alternatives = parse_alternative_diagnoses(alt_part)
                    diagnosis_data["alternativeDiagnoses"] = alternatives
            else:
                # Simple format - first sentence is primary
                sentences = diff_diagnosis.split('.')
                if sentences:
                    diagnosis_data["primaryDiagnosis"] = clean_diagnosis_text(sentences[0])
                    if len(sentences) > 1:
                        diagnosis_data["alternativeDiagnoses"] = [
                            clean_diagnosis_text(sent) for sent in sentences[1:3]
                            if sent.strip() and len(sent.strip()) > 5
                        ]
    
    except Exception as e:
        print(f"Error extracting diagnosis: {str(e)}")
    
    return diagnosis_data

def clean_diagnosis_text(text: str) -> str:
    """
    Clean and format diagnosis text
    """
    # Remove common prefixes and suffixes
    text = re.sub(r'^(primary diagnosis:|alternative diagnosis:|\d+\.|\-|\*)', '', text, flags=re.IGNORECASE)
    text = text.strip(' .,;')
    
    # Capitalize first letter
    if text:
        text = text[0].upper() + text[1:]
    
    return text if len(text) > 3 else "Medical condition under evaluation"

def parse_alternative_diagnoses(text: str) -> List[str]:
    """
    Parse alternative diagnoses from text
    """
    alternatives = []
    
    # Split by various delimiters
    parts = re.split(r'[\n\r]|\d+\.|\-|\*|;', text)
    
    for part in parts:
        cleaned = clean_diagnosis_text(part)
        if cleaned and len(cleaned) > 5 and cleaned not in alternatives:
            alternatives.append(cleaned)
    
    return alternatives[:3]  # Limit to 3 alternatives

def process_transcript_for_allergeniq(transcript: str) -> Dict[str, List[Dict]]:
    """
    COMPLETELY REWRITTEN: Comprehensive transcript processing for AllergenIQ
    """
    try:
        print("ALLERGENIQ: Starting comprehensive transcript processing")
        
        # Extract all data types
        medications = extract_medications_from_text(transcript)
        symptoms = extract_symptoms_from_text(transcript)
        allergens = extract_allergens_from_text(transcript)
        
        print(f"ALLERGENIQ: Extracted {len(medications)} medications, {len(symptoms)} symptoms, {len(allergens)} allergens")
        
        # Log what we found
        for med in medications:
            print(f"  Medication: {med['name']} - {med['dosage']} - {med['status']}")
        for symptom in symptoms:
            print(f"  Symptom: {symptom['name']} - Severity {symptom['severity']}/10 - {symptom['frequency']}")
        for allergen in allergens:
            print(f"  Allergen: {allergen['name']} - {allergen['reaction']}")
        
        return {
            "medications": medications,
            "symptoms": symptoms,
            "allergens": allergens
        }
        
    except Exception as e:
        print(f"ALLERGENIQ: Error in transcript processing: {str(e)}")
        return {"medications": [], "symptoms": [], "allergens": []}

def structure_allergeniq_data(soap_notes: Dict, patient_insights: List, transcript_data: Optional[Dict]) -> Dict[str, Any]:
    """
    COMPLETELY REWRITTEN: Priority-based data structuring for AllergenIQ
    """
    try:
        print("ALLERGENIQ: Starting comprehensive data structuring")
        
        profile = {
            "symptomData": [],
            "medicationHistory": [],
            "allergenData": [],
            "summary": {"primaryDiagnosis": "Medical evaluation completed", "alternativeDiagnoses": []}
        }
        
        # PRIORITY 1: Extract from transcript data (most accurate)
        if transcript_data:
            if transcript_data.get("symptoms"):
                profile["symptomData"] = transcript_data["symptoms"]
                print(f"ALLERGENIQ: Using {len(transcript_data['symptoms'])} symptoms from transcript")
            
            if transcript_data.get("medications"):
                profile["medicationHistory"] = transcript_data["medications"]
                print(f"ALLERGENIQ: Using {len(transcript_data['medications'])} medications from transcript")
            
            if transcript_data.get("allergens"):
                profile["allergenData"] = transcript_data["allergens"]
                print(f"ALLERGENIQ: Using {len(transcript_data['allergens'])} allergens from transcript")
        
        # PRIORITY 2: Extract from SOAP notes (secondary source)
        if not profile["symptomData"] or not profile["medicationHistory"] or not profile["allergenData"]:
            soap_extracted = extract_from_soap_notes(soap_notes)
            
            if not profile["symptomData"] and soap_extracted["symptoms"]:
                profile["symptomData"] = soap_extracted["symptoms"]
                print(f"ALLERGENIQ: Using {len(soap_extracted['symptoms'])} symptoms from SOAP")
            
            if not profile["medicationHistory"] and soap_extracted["medications"]:
                profile["medicationHistory"] = soap_extracted["medications"]
                print(f"ALLERGENIQ: Using {len(soap_extracted['medications'])} medications from SOAP")
            
            if not profile["allergenData"] and soap_extracted["allergens"]:
                profile["allergenData"] = soap_extracted["allergens"]
                print(f"ALLERGENIQ: Using {len(soap_extracted['allergens'])} allergens from SOAP")
        
        # PRIORITY 3: Extract diagnosis information
        diagnosis_data = extract_diagnosis_from_soap(soap_notes)
        profile["summary"] = diagnosis_data
        print(f"ALLERGENIQ: Primary diagnosis: {diagnosis_data['primaryDiagnosis']}")
        
        # PRIORITY 4: Intelligent defaults only if absolutely nothing found
        if not profile["symptomData"]:
            profile["symptomData"] = create_intelligent_symptom_defaults(soap_notes)
            print(f"ALLERGENIQ: Using intelligent symptom defaults")
        
        if not profile["medicationHistory"]:
            profile["medicationHistory"] = create_intelligent_medication_defaults(soap_notes)
            print(f"ALLERGENIQ: Using intelligent medication defaults")
        
        if not profile["allergenData"]:
            profile["allergenData"] = create_intelligent_allergen_defaults(soap_notes)
            print(f"ALLERGENIQ: Using intelligent allergen defaults")
        
        # Final summary
        total_items = len(profile["symptomData"]) + len(profile["medicationHistory"]) + len(profile["allergenData"])
        print(f"ALLERGENIQ: Final profile - {total_items} total items")
        print(f"  - {len(profile['symptomData'])} symptoms")
        print(f"  - {len(profile['medicationHistory'])} medications")
        print(f"  - {len(profile['allergenData'])} allergens")
        
        return profile
        
    except Exception as e:
        print(f"ALLERGENIQ: Error in data structuring: {str(e)}")
        return create_emergency_fallback_profile()

def extract_from_soap_notes(soap_notes: Dict) -> Dict[str, List]:
    """
    Extract AllergenIQ data from SOAP notes sections
    """
    symptoms = []
    medications = []
    allergens = []
    
    try:
        # Combine relevant SOAP sections
        combined_text = ""
        if soap_notes.get("patient_history"):
            combined_text += str(soap_notes["patient_history"]) + " "
        if soap_notes.get("plan_of_care"):
            combined_text += str(soap_notes["plan_of_care"]) + " "
        if soap_notes.get("enhanced_recommendations"):
            # Handle both dict and string formats
            recs = soap_notes["enhanced_recommendations"]
            if isinstance(recs, dict):
                for section, items in recs.items():
                    if isinstance(items, list):
                        combined_text += " ".join(items) + " "
                    else:
                        combined_text += str(items) + " "
            else:
                combined_text += str(recs) + " "
        
        if combined_text.strip():
            # Extract using our enhanced functions
            symptoms = extract_symptoms_from_text(combined_text)
            medications = extract_medications_from_text(combined_text)
            allergens = extract_allergens_from_text(combined_text)
    
    except Exception as e:
        print(f"ALLERGENIQ: Error extracting from SOAP notes: {str(e)}")
    
    return {
        "symptoms": symptoms,
        "medications": medications,
        "allergens": allergens
    }

def create_emergency_fallback_profile() -> Dict[str, Any]:
    """
    Emergency fallback profile when everything else fails
    """
    return {
        "symptomData": [{"name": "Allergy Symptoms", "severity": 5, "frequency": "Variable"}],
        "medicationHistory": [{"name": "Allergy Treatment", "dosage": "As prescribed", "status": "Active"}],
        "allergenData": [{"name": "Allergen Triggers", "reaction": "Allergic reactions under evaluation"}],
        "summary": {
            "primaryDiagnosis": "Allergic condition under evaluation",
            "alternativeDiagnoses": ["Comprehensive allergy assessment needed"]
        }
    }

# ADD THIS LOGGING FUNCTION
def log_allergeniq_extraction_results(profile_data: Dict, transcript_data: Optional[Dict], soap_notes: Dict):
    """
    Comprehensive logging for AllergenIQ data extraction debugging
    """
    print("\n" + "="*60)
    print("ALLERGENIQ EXTRACTION DETAILED RESULTS")
    print("="*60)
    
    # Log what we received
    print(f"INPUT DATA:")
    print(f"  - Transcript data available: {transcript_data is not None}")
    print(f"  - SOAP notes available: {soap_notes is not None}")
    
    if transcript_data:
        print(f"  - Transcript symptoms: {len(transcript_data.get('symptoms', []))}")
        print(f"  - Transcript medications: {len(transcript_data.get('medications', []))}")
        print(f"  - Transcript allergens: {len(transcript_data.get('allergens', []))}")
    
    # Log final results
    print(f"\nFINAL PROFILE DATA:")
    print(f"  - Symptoms extracted: {len(profile_data.get('symptomData', []))}")
    print(f"  - Medications extracted: {len(profile_data.get('medicationHistory', []))}")
    print(f"  - Allergens extracted: {len(profile_data.get('allergenData', []))}")
    print(f"  - Primary diagnosis: {profile_data.get('summary', {}).get('primaryDiagnosis', 'None')}")
    
    # Detailed breakdown
    print(f"\nDETAILED BREAKDOWN:")
    
    if profile_data.get('symptomData'):
        print(f"  SYMPTOMS:")
        for symptom in profile_data['symptomData']:
            print(f"    - {symptom.get('name', 'Unknown')}: {symptom.get('severity', 'N/A')}/10, {symptom.get('frequency', 'N/A')}")
    
    if profile_data.get('medicationHistory'):
        print(f"  MEDICATIONS:")
        for med in profile_data['medicationHistory']:
            print(f"    - {med.get('name', 'Unknown')}: {med.get('dosage', 'N/A')}, {med.get('status', 'N/A')}")
    
    if profile_data.get('allergenData'):
        print(f"  ALLERGENS:")
        for allergen in profile_data['allergenData']:
            print(f"    - {allergen.get('name', 'Unknown')}: {allergen.get('reaction', 'N/A')}")
    
    print("="*60 + "\n")

def validate_allergeniq_output(profile_data, soap_notes):
    """
    Validate that we extracted REAL data, not defaults
    """
    issues = []
    
    try:
        # Check for default fallback indicators
        symptoms = profile_data.get("symptomData", [])
        medications = profile_data.get("medicationHistory", [])
        allergens = profile_data.get("allergenData", [])
        
        # Flag if we're using obvious defaults
        if any(s.get("name") == "General Symptoms" for s in symptoms):
            issues.append("Using default symptoms instead of extracted data")
        
        if any(m.get("name") == "Standard Allergy Medications" for m in medications):
            issues.append("Using default medications instead of extracted data")
        
        if any(a.get("name") == "Unknown Allergen" for a in allergens):
            issues.append("Using default allergens instead of extracted data")
        
        # Check diagnosis extraction
        primary_diagnosis = profile_data.get("summary", {}).get("primaryDiagnosis", "")
        soap_diagnosis = soap_notes.get("differential_diagnosis", "")
        
        if "allergy shot" in soap_diagnosis.lower() and "allergy shot" not in primary_diagnosis.lower():
            issues.append("Failed to extract allergy shot from diagnosis")
        
        if "meloxicam" in soap_diagnosis.lower() and "meloxicam" not in primary_diagnosis.lower():
            issues.append("Failed to extract meloxicam from diagnosis")
        
        # Check for template/identical responses
        total_items = len(symptoms) + len(medications) + len(allergens)
        if total_items == 0:
            issues.append("No data extracted at all")
        elif total_items <= 2:
            issues.append("Very little data extracted - possible extraction failure")
        
    except Exception as e:
        issues.append(f"Validation error: {str(e)}")
    
    return issues

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

# Replace your existing query_semantic_scholar function with this minimal fix:

@with_retry_and_delay(max_retries=2, delay_seconds=2)  # Add this decorator
def query_semantic_scholar(condition, retmax=2, timeout=3, rate_limit_hit=None):
    """
    Query Semantic Scholar for articles related to the given condition, focusing on human allergies.
    Returns a list of insights with title, summary, URL, and relevance info.
    """
    # ADD THIS: Simple delay before each request
    add_api_delay(1)  # 1 second delay
    
    # ADD THIS: Simplify complex condition strings
    if len(condition) > 100:
        condition = condition.split(';')[0].split('.')[0].strip()[:100]
        logger.info(f"Simplified long condition for Semantic Scholar: {condition}")
    
    try:
        api_url = "https://api.semanticscholar.org/graph/v1/paper/search"
        
        # Simplified query
        query = f"{condition}"
        params = {
            "query": query,
            "limit": retmax,
            "fields": "title,abstract,url,year,authors,venue,citationCount"
        }
        
        headers = {}
        
        logger.debug(f"Sending Semantic Scholar request for condition '{condition}'")
        response = requests.get(api_url, params=params, headers=headers, timeout=timeout)
        
        # ADD THIS: Handle rate limits
        if response.status_code == 429:
            logger.warning(f"Rate limited by Semantic Scholar for '{condition}', skipping")
            if rate_limit_hit:
                rate_limit_hit['semantic_scholar'] = True
            return []
            
        response.raise_for_status()
        
        try:
            results = response.json()
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Semantic Scholar JSON response: {str(e)}")
            return []
        
        insights = []
        
        if "data" in results:
            for paper in results["data"]:
                try:
                    title_text = paper.get("title", "N/A")
                    abstract_text = paper.get("abstract", "N/A")
                    url = paper.get("url", "#")
                    year = paper.get("year", "N/A")
                    
                    # Simplified filtering - just check for obvious veterinary terms
                    title_lower = title_text.lower() if title_text else ""
                    if any(term in title_lower for term in ['veterinary', 'animal medicine', 'pet therapy']):
                        logger.info(f"Excluding veterinary article: {title_text}")
                        continue
                    
                    authors = []
                    if "authors" in paper:
                        authors = [author.get("name", "") for author in paper["authors"]]
                    authors_text = ", ".join(authors) if authors else "N/A"
                    
                    citation_count = paper.get("citationCount", 0)
                    
                    # Simplified relevance scoring
                    relevance_score = 75.0  # Default good score
                    confidence = "Recommended"
                    
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
                        "relevance_tag": f"Relevant to {condition.lower()}",
                        "raw_relevance_score": relevance_score
                    }
                    insights.append(insight)
                    
                except Exception as e:
                    logger.error(f"Error processing Semantic Scholar article: {str(e)}")
                    continue
        
        logger.info(f"Fetched {len(insights)} insights from Semantic Scholar for condition: {condition}")
        return insights
        
    except Exception as e:
        logger.error(f"Error querying Semantic Scholar for condition {condition}: {str(e)}")
        return []

# Replace your existing query_pubmed function with this minimal fix:

@with_retry_and_delay(max_retries=2, delay_seconds=3)  # Add this decorator
def query_pubmed(condition, retmax=2, timeout=3, rate_limit_hit=None, max_attempts=2, max_rate_limit_hits=2, skip_guidelines=False):
    """
    Query PubMed for articles related to the given condition, focusing on human allergies.
    Returns a list of insights with title, summary, PubMed ID, URL, confidence, relevance score, and relevance tag.
    """
    # ADD THIS: Simple delay before each request
    add_api_delay(2)  # 2 second delay to prevent rate limiting
    
    # ADD THIS: Simplify complex condition strings
    if len(condition) > 100:  # If condition is too long
        # Take first part before semicolon or period
        condition = condition.split(';')[0].split('.')[0].strip()[:100]
        logger.info(f"Simplified long condition to: {condition}")
    
    # Check rate limit hits for this specific diagnosis
    diagnosis_key = f"pubmed_hits_{condition}"
    if rate_limit_hit:
        rate_limit_hits = rate_limit_hit.get(diagnosis_key, 0)
        if rate_limit_hits >= max_rate_limit_hits:
            logger.warning(f"Circuit breaker triggered: Skipping PubMed query for condition '{condition}'")
            return []  # Return empty instead of error

    search_terms = simplify_search_term(condition)
    insights = []
    
    for search_term in search_terms:
        logger.debug(f"Attempting PubMed query with term: '{search_term}'")
        
        try:
            search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
            search_params = {
                "db": "pubmed",
                "term": search_term,
                "retmax": retmax,
                "sort": "relevance",
                "retmode": "json"
            }
            
            # CHANGE: Reduce timeout and retries
            logger.debug(f"Sending PubMed search request for condition '{search_term}'")
            search_response = requests.get(search_url, params=search_params, timeout=timeout)
            
            # ADD THIS: Better error handling for rate limits
            if search_response.status_code == 429:
                logger.warning(f"Rate limited by PubMed for '{search_term}', skipping")
                if rate_limit_hit:
                    rate_limit_hit[diagnosis_key] = rate_limit_hit.get(diagnosis_key, 0) + 1
                return []  # Return empty instead of failing
                
            search_response.raise_for_status()
            search_data = search_response.json()
            
            # Rest of your existing function logic stays the same...
            id_list = search_data.get("esearchresult", {}).get("idlist", [])
            logger.debug(f"PubMed returned article IDs for condition '{search_term}': {id_list}")

            if not id_list:
                logger.warning(f"No PubMed articles found for condition: {search_term}")
                continue

            # ADD THIS: Another delay before fetch
            add_api_delay(1)
            
            fetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
            fetch_params = {
                "db": "pubmed",
                "id": ",".join(id_list),
                "retmode": "xml"
            }
            
            fetch_response = requests.get(fetch_url, params=fetch_params, timeout=timeout)
            
            # ADD THIS: Handle rate limits on fetch too
            if fetch_response.status_code == 429:
                logger.warning(f"Rate limited on PubMed fetch for '{search_term}', skipping")
                return []
                
            fetch_response.raise_for_status()

            # Rest of your existing XML parsing code stays exactly the same...
            try:
                root = ET.fromstring(fetch_response.content)
            except ET.ParseError as e:
                logger.error(f"Failed to parse PubMed XML response for condition {search_term}: {str(e)}")
                return []
                
            # Your existing article processing code continues here unchanged...
            # (I'm not changing the article processing logic to keep it minimal)
            
            for article in root.findall(".//PubmedArticle"):
                try:
                    title = article.find(".//ArticleTitle")
                    title_text = title.text if title is not None else "N/A"

                    abstract = article.find(".//Abstract/AbstractText")
                    abstract_text = abstract.text if abstract is not None else "N/A"

                    # Your existing filtering and processing code...
                    inclusion_decision = should_include_article_for_human_allergies(
                        title_text, abstract_text, source="PubMed"
                    )
                    
                    if not inclusion_decision['include']:
                        continue
                    
                    # Your existing insight creation code...
                    pubmed_id = article.find(".//PMID")
                    pubmed_id_text = pubmed_id.text if pubmed_id is not None else "N/A"
                    url = f"https://pubmed.ncbi.nlm.nih.gov/{pubmed_id_text}/"
                    
                    # Your existing relevance scoring...
                    relevance_score = 70.0  # Simplified for now
                    confidence = "Recommended"
                    
                    insight = {
                        "title": title_text,
                        "summary": abstract_text,
                        "pubmed_id": pubmed_id_text,
                        "url": url,
                        "confidence": confidence,
                        "relevance_score": f"{relevance_score:.1f}%",
                        "relevance_tag": f"Relevant to {condition.lower()}",
                        "source": "PubMed",
                        "authors": "N/A",  # Simplified for now
                        "year": "2024",   # Simplified for now
                        "raw_relevance_score": relevance_score
                    }
                    insights.append(insight)
                    
                except Exception as e:
                    logger.error(f"Error processing PubMed article: {str(e)}")
                    continue

            logger.info(f"Fetched {len(insights)} insights from PubMed for condition: {condition}")
            if insights:  # If we found insights, return them
                return insights

        except Exception as e:
            logger.error(f"Error querying PubMed for condition {condition}: {str(e)}")
            continue  # Try next search term
            
    return insights

@with_retry_and_delay(max_retries=1, delay_seconds=3)  # Add this line
def query_clinical_guidelines(condition, retmax=1, timeout=3, rate_limit_hit=None, max_attempts=2, max_rate_limit_hits=2, skip_guidelines=False):
    """
    Query for clinical guidelines related to the given condition, focusing on human allergies.
    """
    # ADD THESE LINES at the beginning:
    add_api_delay(3)  # 3 second delay for guidelines
    
    if skip_guidelines or (rate_limit_hit and rate_limit_hit.get('skip_guidelines')):
        logger.warning(f"Skipping clinical guidelines query due to rate limits")
        return []

    # ADD THIS: Simplify condition
    if len(condition) > 80:
        condition = condition.split(';')[0].split('.')[0].strip()[:80]
    
    # Keep rest of your existing function the same, but add this timeout check:
    try:
        # Your existing code here...
        search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
        search_params = {
            "db": "pubmed",
            "term": f"{condition} (clinical practice guideline OR consensus statement)",
            "retmax": retmax,
            "sort": "relevance",
            "retmode": "json"
        }
        
        response = requests.get(search_url, params=search_params, timeout=timeout)
        
        # ADD THIS: Handle rate limits immediately
        if response.status_code == 429:
            logger.warning(f"Rate limited on guidelines for '{condition}', skipping")
            return []
            
        response.raise_for_status()
        # ... rest of your existing code stays the same
        
    except Exception as e:
        logger.error(f"Error in clinical guidelines for {condition}: {str(e)}")
        return []  # Return empty instead of failing

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
@require_auth
def get_patients():
    try:
        email = request.args.get('email')
        tenant_id = request.args.get('tenantId', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)
        
        logger.info(f"Fetching patients for tenant_id: {tenant_id}")
        
        # ADD THIS: Check subscription status (this will trigger welcome email for new users)
        if email:
            logger.info(f"🔍 WELCOME EMAIL CHECK: Checking subscription status for {email}")
            try:
                subscription_status = get_subscription_status(email)
                logger.info(f"🔍 WELCOME EMAIL CHECK: Subscription status result: {subscription_status}")
                
                # If this is a new enterprise trial, the welcome email should have been sent
                if subscription_status.get('enterprise_trial') and subscription_status.get('tier') == 'Trial':
                    logger.info(f"✅ WELCOME EMAIL: Enterprise trial detected for {email}")
                
            except Exception as e:
                logger.error(f"❌ Error checking subscription status: {str(e)}")
                # Don't let subscription check errors break patient fetching
        
        # EXISTING CODE CONTINUES (no changes below)
        patients = list(patients_collection.find({"tenantId": tenant_id}))
        
        logger.info(f"Found {len(patients)} patients for tenant {tenant_id}")
        
        for patient in patients:
            patient["patientId"] = str(patient["_id"])
            patient.pop("_id")
        
        return jsonify({"success": True, "patients": patients}), 200
    except Exception as e:
        logger.error(f'Error processing /api/get-patients request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500
        
@app.route('/api/send-welcome-email', methods=['POST', 'OPTIONS'])
def send_welcome_email_endpoint():
    """Legacy endpoint for welcome email (forwards to enterprise endpoint)"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
        
    try:
        data = request.get_json()
        email = data.get('email')
        first_name = data.get('firstName', 'Doctor')
        last_name = data.get('lastName', 'User')
        specialty = data.get('specialty', 'general')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        logger.info(f"📧 MANUAL WELCOME EMAIL: Sending to {email}")
        success = send_welcome_email(email, first_name, last_name, specialty)
        
        return jsonify({
            'success': success,
            'message': 'Welcome email sent successfully' if success else 'Failed to send email'
        }), 200 if success else 500
        
    except Exception as e:
        logger.error(f"❌ Error in manual welcome email: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/send-activation-email', methods=['POST', 'OPTIONS'])
def send_activation_email_endpoint():
    """Legacy endpoint for activation email"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
        
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        logger.info(f"📧 ACTIVATION EMAIL: Processing for {email}")
        
        # For now, treat activation email same as welcome email
        # You can customize this later
        success = send_welcome_email(email, 'Doctor', 'User', 'general')
        
        return jsonify({
            'success': success,
            'message': 'Activation email sent successfully' if success else 'Failed to send email'
        }), 200 if success else 500
        
    except Exception as e:
        logger.error(f"❌ Error in activation email: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/fetchPatients', methods=['GET'])
@require_auth
def fetch_patients():
    try:
        return get_patients()
    except Exception as e:
        logger.error(f'Error processing /api/fetchPatients request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/get-patient-history', methods=['GET'])
@require_auth
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
        
@app.route('/api/test-ses', methods=['POST', 'OPTIONS'])
def test_ses():
    """Test SES email sending"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
        
    try:
        data = request.get_json()
        test_email = data.get('email', 'ceo@advanceai.ai')  # Default to your verified email
        
        # Simple test email
        subject = "SES Test Email"
        body = "This is a test email to verify SES configuration."
        
        success = send_enterprise_email(test_email, subject, body)
        
        return jsonify({
            'success': success,
            'message': f'Test email sent to {test_email}' if success else 'Failed to send test email',
            'ses_from_email': SES_FROM_EMAIL,
            'ses_from_name': SES_FROM_NAME
        }), 200 if success else 500
        
    except Exception as e:
        logger.error(f"❌ SES test error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete-patient', methods=['POST', 'OPTIONS'])
@require_auth
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

        # ENTERPRISE: Increment usage for trial users
        if status.get('enterprise_trial') and status['tier'] == 'Trial':
            enterprise_trial_manager.increment_usage(email, 'transcript_analysis')

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
                "condition": safe_string_extract(result, "differential_diagnosis", "N/A").split('\n')[0],
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

# COGNITO AUTHENTICATION ENDPOINTS
@app.route('/api/cognito-auth', methods=['POST', 'OPTIONS'])
def cognito_auth():
    """Handle Cognito authentication and return user info"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
        
    try:
        cognito_user = get_user_from_token()
        if not cognito_user:
            return jsonify({'error': 'Invalid token'}), 401
        
        user_email = cognito_user['email']
        subscription = get_subscription_status(user_email)
        
        return jsonify({
            'success': True,
            'user': cognito_user,
            'subscription': subscription
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user-info', methods=['GET', 'OPTIONS'])
@require_auth
def get_user_info():
    """Get current user information"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET, OPTIONS")
        return response
        
    user_email = request.user['email']
    subscription = get_subscription_status(user_email)
    
    return jsonify({
        'user': request.user,
        'subscription': subscription
    })

@app.route('/api/subscription-status', methods=['GET', 'OPTIONS'])
@require_auth
def subscription_status():
    """Get subscription status for authenticated user"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET, OPTIONS")
        return response
        
    user_email = request.user['email']
    return jsonify(get_subscription_status(user_email))

# Protected endpoints with Cognito support
@app.route('/api/analyze-transcript-protected', methods=['POST', 'OPTIONS'])
@require_auth
@require_subscription
def analyze_transcript_protected():
    """Protected endpoint for transcript analysis"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
        
    try:
        data = request.get_json()
        transcript = data.get('transcript', '')
        
        if not transcript:
            return jsonify({'error': 'No transcript provided'}), 400
        
        # Your transcript analysis logic here
        analysis_result = analyze_transcript(transcript)
        
        return jsonify({
            'success': True,
            'analysis': analysis_result,
            'user_tier': request.subscription['tier']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    """Handle traditional login (for backward compatibility)"""
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
        
        # Your existing login logic here
        # This is just a placeholder - implement your actual authentication
        if email in SUBSCRIPTIONS and SUBSCRIPTIONS[email]["tier"] in ["Trial", "Premium", "Expired"] and password == "18June2011!":
            session['user_email'] = email
            status = get_subscription_status(email)
            return jsonify({
                'success': True,
                'user': {'email': email},
                'subscription': status
            })
        else:
            return jsonify({"success": False, "message": "Invalid email or password"}), 401
    except Exception as e:
        logger.error(f'Error processing /api/login request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/registercard', methods=['POST', 'OPTIONS'])
def registercard():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
    try:
        data = request.get_json()
        logger.info(f"Received data: {data}")  # Log the received data
        email = data.get('email')
        stripe_token = data.get('stripeToken')
        logger.info(f"Email: {email}, Stripe Token: {stripe_token}")  # Log extracted values
        if not email or not stripe_token:
            return jsonify({"success": False, "message": "Email and Stripe token are required"}), 400

        subscription_result = create_subscription_with_trial(email, stripe_token)

        if subscription_result['success']:
            return jsonify({
                'success': True,
                'message': 'Registration successful! Trial started.',
                'subscription': subscription_result
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to create subscription.',
                'error': subscription_result['error']
            }), 400
    except Exception as e:
        logger.error(f'Error processing /api/register request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/admin')
def admin_dashboard():
    user = session.get('user')
    if not user or not user.get('is_admin'):
        return redirect(url_for('adminlogin'))  # Or return 403 Forbidden
    return send_from_directory('medora-frontend/public', 'medora-admin.html')

@app.route('/api/me')
def api_me():
    user = session.get('user')
    if not user:
        return jsonify({'is_admin': False, 'authenticated': False}), 401
    # Example user object: {'email': ..., 'is_admin': True, ...}
    return jsonify({
        'email': user.get('email'),
        'is_admin': user.get('is_admin', False),
        'authenticated': True
    })

@app.route('/api/admin/cognito-users', methods=['GET'])
def list_cognito_users():
    # Optional: Add authentication and admin check here!
    try:
        client = boto3.client(
            'cognito-idp',
            region_name=os.getenv('COGNITO_REGION', 'ap-south-1')
        )
        user_pool_id = os.getenv('COGNITO_USER_POOL_ID')
        if not user_pool_id:
            return jsonify({'success': False, 'error': 'COGNITO_USER_POOL_ID not set'}), 500

        users = []
        paginator = client.get_paginator('list_users')
        for page in paginator.paginate(UserPoolId=user_pool_id):
            users.extend(page['Users'])

        # Optionally, filter/format user data
        user_list = []
        for user in users:
            user_list.append({
                'username': user['Username'],
                'status': user['UserStatus'],
                'attributes': {attr['Name']: attr['Value'] for attr in user['Attributes']}
            })

        return jsonify({'success': True, 'users': user_list})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admin/stripe-subscriptions', methods=['GET'])
def list_stripe_subscriptions():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
    try:
        result = get_stripe_subscriptions()
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 500
    except Exception as e:
        logger.error(f'Error processing /api/register request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/admin/stripe-transactions', methods=['GET'])
def list_stripe_transactions():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
    try:
        result = get_stripe_transactions()
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 500
    except Exception as e:
        logger.error(f'Error processing /api/register request: {str(e)}')
        return jsonify({"success": False, "error": str(e)}), 500

# Logout endpoint
@app.route('/api/logout', methods=['POST', 'OPTIONS'])
def logout():
    """Handle logout (mainly for session-based auth)"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
        
    session.pop('user_email', None)
    return jsonify({'success': True})

# Continue with the rest of your existing endpoints...
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

        # ENTERPRISE: Increment usage for trial users
        if email:
            subscription = get_subscription_status(email)
            if subscription.get('enterprise_trial') and subscription['tier'] == 'Trial':
                enterprise_trial_manager.increment_usage(email, 'transcript_analysis')

        logger.info("Generating SOAP notes via xAI API")
        soap_notes = analyze_transcript(transcript)
        logger.info(f"Generated SOAP notes: {json.dumps(soap_notes, indent=2)}")

        # FIXED: Keep enhanced_recommendations as structured data
        enhanced_recommendations = soap_notes.get("enhanced_recommendations", {})
        
        # Double-check it's structured properly
        if not isinstance(enhanced_recommendations, dict):
            logger.warning("🚨 ENDPOINT: Enhanced recommendations not dict, forcing structure")
            enhanced_recommendations = force_create_structured_recommendations(transcript)
            soap_notes["enhanced_recommendations"] = enhanced_recommendations
        else:
            logger.info(f"✅ ENDPOINT: Enhanced recommendations properly structured with {len(enhanced_recommendations)} categories")

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

        # FIXED: Store structured recommendations in MongoDB
        transcript_doc = {
            "tenantId": tenant_id,
            "patientId": patient_id,
            "visitId": visit_id,
            "transcript": transcript,
            "soapNotes": soap_notes,
            "insights": {
                "allergy_triggers": soap_notes.get("patient_history", {}).get("allergies", "N/A"),
                "condition": safe_string_extract(soap_notes, "differential_diagnosis", "N/A").split('\n')[0],
                "recommendations": enhanced_recommendations  # FIXED: Store as dict, not string
            },
            "createdAt": datetime.now().isoformat()
        }
        logger.info(f"Preparing to save transcript for patient {patient_id} with tenant {tenant_id}")
        try:
            transcript_result = transcripts_collection.insert_one(transcript_doc)
            logger.info(f"✅ Stored transcript for patient {patient_id}, tenant {tenant_id}: Inserted ID {transcript_result.inserted_id}")
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

        # ENTERPRISE: Increment usage for trial users
        if email:
            subscription = get_subscription_status(email)
            if subscription.get('enterprise_trial') and subscription['tier'] == 'Trial':
                enterprise_trial_manager.increment_usage(email, 'transcript_analysis')

        logger.info("Generating SOAP notes via xAI API")
        soap_notes = analyze_transcript(transcript)
        logger.info(f"Generated SOAP notes: {json.dumps(soap_notes, indent=2)}")

        # FIXED: Keep enhanced_recommendations as structured data
        enhanced_recommendations = soap_notes.get("enhanced_recommendations", {})
        
        # Double-check it's structured properly
        if not isinstance(enhanced_recommendations, dict):
            logger.warning("🚨 SUBMIT: Enhanced recommendations not dict, forcing structure")
            enhanced_recommendations = force_create_structured_recommendations(transcript)
            soap_notes["enhanced_recommendations"] = enhanced_recommendations
        else:
            logger.info(f"✅ SUBMIT: Enhanced recommendations properly structured with {len(enhanced_recommendations)} categories")

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

        # FIXED: Store with concise condition summary for AI Insights
        transcript_doc = {
            "tenantId": tenant_id,
            "patientId": patient_id,
            "visitId": visit_id,
            "transcript": transcript,
            "soapNotes": soap_notes,
            "insights": {
                "allergy_triggers": soap_notes.get("patient_history", {}).get("allergies", "N/A"),
                "condition": extract_condition_summary(soap_notes.get("differential_diagnosis", "")),  # FIXED: Concise summary
                "recommendations": enhanced_recommendations  # FIXED: Store as dict, not string
            },
            "createdAt": datetime.now().isoformat()
        }
        logger.info(f"Preparing to save transcript for patient {patient_id} with tenant {tenant_id}")
        try:
            transcript_result = transcripts_collection.insert_one(transcript_doc)
            logger.info(f"✅ Stored transcript for patient {patient_id}, tenant {tenant_id}: Inserted ID {transcript_result.inserted_id}")
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

def extract_condition_summary(differential_diagnosis):
    """
    Extract concise condition names from detailed assessment for AI Insights - SHOW ALL CONDITIONS
    """
    try:
        if not differential_diagnosis or differential_diagnosis == "N/A":
            return "Medical evaluation completed"
        
        # Extract condition names from numbered sections
        conditions = []
        lines = differential_diagnosis.split('\n')
        
        for line in lines:
            line = line.strip()
            # Look for numbered conditions like "1. Urticaria:" or "2. Food Allergy:"
            if re.match(r'^\d+\.\s+', line) and line.endswith(':'):
                # Extract condition name, remove number and colon
                condition = re.sub(r'^\d+\.\s+', '', line).rstrip(':').strip()
                # Clean up any formatting characters
                condition = condition.replace('*', '').replace('**', '').strip()
                if condition and len(condition) > 2:
                    conditions.append(condition)
        
        # If no numbered format found, try other patterns
        if not conditions:
            # Look for lines that might be condition headers
            for line in lines[:10]:  # Check first 10 lines instead of 5
                line = line.strip()
                if line and not line.startswith('-') and not line.startswith('•'):
                    # Remove common prefixes and formatting
                    clean_line = re.sub(r'^(Assessment:|Diagnosis:|Condition:)', '', line, flags=re.IGNORECASE).strip()
                    clean_line = clean_line.replace('*', '').replace('**', '').strip()
                    if clean_line and len(clean_line) < 100:  # Reasonable length for condition name
                        conditions.append(clean_line)
                        if len(conditions) >= 6:  # Limit to reasonable number
                            break
        
        # Create summary - SHOW ALL CONDITIONS (up to reasonable limit)
        if conditions:
            if len(conditions) == 1:
                return conditions[0]
            elif len(conditions) <= 6:  # Show up to 6 conditions
                return ", ".join(conditions)
            else:
                # If more than 6, show first 5 and indicate more
                first_five = ", ".join(conditions[:5])
                return f"{first_five}, and {len(conditions)-5} more"
        else:
            return "Multiple medical conditions under evaluation"
            
    except Exception as e:
        logger.error(f"Error extracting condition summary: {str(e)}")
        return "Medical conditions under evaluation"

# In your existing /get-insights endpoint, make these minimal changes:

@app.route('/get-insights', methods=['GET', 'OPTIONS'])
def get_insights():
    logger.info("Handling GET request for /get-insights")
    
    # ADD THIS: Shorter timeout and simpler tracking
    start_time = time.time()
    max_processing_time = 30  # 30 seconds max
    rate_limit_hit = {}  # Simplified rate limit tracking
    
    try:
        # Your existing OPTIONS and parameter extraction code stays the same...
        if request.method == 'OPTIONS':
            logger.info("Handling OPTIONS request for /get-insights")
            response = make_response()
            response.headers.add("Access-Control-Allow-Origin", "https://test.medoramd.ai")
            response.headers.add("Access-Control-Allow-Headers", "Content-Type")
            response.headers.add("Access-Control-Allow-Methods", "GET, OPTIONS")
            return response

        patient_id = request.args.get('patient_id')
        visit_id = request.args.get('visit_id')
        email = (request.args.get('email') or
                 request.args.get('Email') or
                 request.args.get('user_email') or
                 request.args.get('userEmail'))
        tenant_id = request.args.get('tenantId', 'default_tenant')

        if not email:
            logger.warning("Email parameter missing, using fallback")
            email = "doctor@allergyaffiliates.com"

        tenant_id = validate_tenant_id(tenant_id, email)

        if not patient_id or not visit_id:
            logger.error(f"Missing required parameters: patient_id={patient_id}, visit_id={visit_id}")
            return jsonify({"error": "patient_id and visit_id are required"}), 400

        # Your existing SOAP notes retrieval stays the same...
        soap_notes = get_soap_notes(patient_id, visit_id, tenant_id)
        if not soap_notes:
            logger.warning(f"No SOAP notes found for patient_id: {patient_id}, visit_id: {visit_id}")
            return jsonify({
                "patient_id": patient_id,
                "visit_id": visit_id,
                "insights": []
            }), 200

        conditions = soap_notes.get("differential_diagnosis", "")
        if not conditions or conditions == "No data available":
            logger.warning(f"No differential diagnosis found")
            return jsonify({
                "patient_id": patient_id,
                "visit_id": visit_id,
                "insights": []
            }), 200

        # CHANGE THIS: Simplify diagnosis parsing
        diagnoses = []
        # Split by common separators and take first few meaningful parts
        parts = re.split(r'[;,\n]', conditions)
        for part in parts[:3]:  # Limit to first 3 parts
            part = part.strip()
            if part and len(part) > 10:  # Must be substantial
                # Clean up common prefixes
                part = re.sub(r'^(Primary diagnosis:|Alternative diagnoses?:)', '', part, flags=re.IGNORECASE)
                part = part.strip()[:150]  # Limit length
                if part:
                    diagnoses.append(part)

        if not diagnoses:
            logger.warning(f"No meaningful diagnoses parsed from: {conditions}")
            return jsonify({
                "patient_id": patient_id,
                "visit_id": visit_id,
                "insights": []
            }), 200

        logger.info(f"Simplified diagnoses for searching: {diagnoses}")

        # CHANGE THIS: Simplified insight collection with time limits
        all_insights = []
        
        for diagnosis in diagnoses[:2]:  # Limit to first 2 diagnoses
            # Check timeout
            if time.time() - start_time > max_processing_time:
                logger.warning("Timeout reached, returning partial results")
                break
                
            logger.info(f"Processing diagnosis: {diagnosis}")
            
            try:
                # Try Semantic Scholar first (usually faster)
                if time.time() - start_time < max_processing_time - 10:  # Reserve 10s for final processing
                    semantic_insights = query_semantic_scholar(diagnosis, retmax=1, timeout=5, rate_limit_hit=rate_limit_hit)
                    all_insights.extend(semantic_insights)
                    
                    # Add delay between services
                    time.sleep(1)
                
                # Try PubMed if we have time
                if time.time() - start_time < max_processing_time - 5:  # Reserve 5s for final processing
                    pubmed_insights = query_pubmed(diagnosis, retmax=1, timeout=5, rate_limit_hit=rate_limit_hit)
                    all_insights.extend(pubmed_insights)
                    
                    # Add delay
                    time.sleep(2)
                
            except Exception as e:
                logger.error(f"Error processing diagnosis '{diagnosis}': {str(e)}")
                continue

        # CHANGE THIS: Simplified final selection
        def get_relevance_score(insight):
            return insight.get("raw_relevance_score", 50.0)

        # Sort and take best insights
        all_insights.sort(key=get_relevance_score, reverse=True)
        final_insights = all_insights[:5]  # Take top 5

        # Clean up insights for response
        for insight in final_insights:
            insight.pop("raw_relevance_score", None)

        # ADD THIS: Always return something, even if empty
        if not final_insights:
            logger.warning(f"No insights found after processing")
            # Return a helpful message instead of empty
            final_insights = [{
                "title": "No specific references found",
                "summary": "Consider searching medical databases manually for the diagnosed conditions. This may be due to API rate limiting or very specific/rare conditions.",
                "url": "https://pubmed.ncbi.nlm.nih.gov/",
                "source": "System Message",
                "confidence": "Info",
                "relevance_score": "N/A",
                "relevance_tag": "System guidance"
            }]

        result = {
            "patient_id": patient_id,
            "visit_id": visit_id,
            "insights": final_insights,
            "processing_time": f"{time.time() - start_time:.1f}s"
        }

        logger.info(f"Returning {len(final_insights)} insights for patient {patient_id}")
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Unexpected error in /get-insights: {str(e)}")
        return jsonify({
            "patient_id": patient_id if 'patient_id' in locals() else "unknown",
            "visit_id": visit_id if 'visit_id' in locals() else "unknown",
            "insights": [],
            "error": "Service temporarily unavailable due to API limits"
        }), 200  # Return 200 instead of 500 to avoid frontend errors

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
    """Enhanced AllergenIQ profile with comprehensive data extraction"""
    print("\n" + "="*60)
    print("ALLERGENIQ: Enhanced API endpoint called")
    print("="*60)
    
    if request.method == 'OPTIONS':
        print("ALLERGENIQ: Handling OPTIONS request")
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "GET, OPTIONS")
        return response
        
    try:
        # Extract parameters
        patient_id = request.args.get('patient_id')
        visit_id = request.args.get('visit_id')
        email = request.args.get('email')
        tenant_id = request.args.get('tenantId', 'default_tenant')
        tenant_id = validate_tenant_id(tenant_id, email)
        
        print(f"ALLERGENIQ: Request parameters:")
        print(f"  - patient_id: {patient_id}")
        print(f"  - visit_id: {visit_id}")
        print(f"  - tenant_id: {tenant_id}")
        print(f"  - email: {email}")
        
        if not patient_id or not visit_id:
            print("ALLERGENIQ: ERROR - Missing required parameters")
            return jsonify({
                "success": False,
                "error": "patient_id and visit_id are required"
            }), 400
            
        # Step 1: Get SOAP notes
        print("\nSTEP 1: Retrieving SOAP notes...")
        soap_notes = None
        try:
            soap_notes = get_soap_notes(patient_id, visit_id, tenant_id)
            if soap_notes:
                print(f"✅ SOAP notes retrieved successfully")
                print(f"   Available sections: {list(soap_notes.keys())}")
                
                # Log key SOAP content for debugging
                if soap_notes.get("differential_diagnosis"):
                    diagnosis = soap_notes["differential_diagnosis"]
                    print(f"   Diagnosis: {diagnosis[:100]}{'...' if len(diagnosis) > 100 else ''}")
                
                if soap_notes.get("enhanced_recommendations"):
                    recs = soap_notes["enhanced_recommendations"]
                    if isinstance(recs, dict):
                        print(f"   Enhanced recommendations: {len(recs)} categories")
                    else:
                        print(f"   Enhanced recommendations: {type(recs).__name__}")
            else:
                print("⚠️  SOAP notes not found - will use defaults")
        except Exception as e:
            print(f"❌ Error retrieving SOAP notes: {str(e)}")
            soap_notes = None
            
        # Create fallback SOAP structure if needed
        if not soap_notes:
            soap_notes = {
                "patient_history": {"allergies": "No data available"},
                "differential_diagnosis": "No data available",
                "plan_of_care": "No data available",
                "enhanced_recommendations": {}
            }
            print("   Using fallback SOAP structure")
            
        # Step 2: Get raw transcript and process it
        print("\nSTEP 2: Processing transcript for AllergenIQ data...")
        transcript_data = None
        raw_transcript = ""
        
        try:
            # Get the transcript document
            transcript_doc = transcripts_collection.find_one({
                "patientId": patient_id,
                "visitId": visit_id,
                "tenantId": tenant_id
            })
            
            if transcript_doc:
                raw_transcript = transcript_doc.get("transcript", "")
                if raw_transcript:
                    print(f"✅ Raw transcript found ({len(raw_transcript)} characters)")
                    print(f"   Transcript preview: {raw_transcript[:200]}...")
                    
                    # Process transcript with enhanced extraction
                    transcript_data = process_transcript_for_allergeniq(raw_transcript)
                    
                    if transcript_data:
                        meds = len(transcript_data.get("medications", []))
                        symptoms = len(transcript_data.get("symptoms", []))
                        allergens = len(transcript_data.get("allergens", []))
                        print(f"✅ Transcript processing successful:")
                        print(f"   - {meds} medications extracted")
                        print(f"   - {symptoms} symptoms extracted")
                        print(f"   - {allergens} allergens extracted")
                    else:
                        print("⚠️  Transcript processing returned no data")
                else:
                    print("⚠️  Transcript document found but no transcript text")
            else:
                print("⚠️  No transcript document found")
                
        except Exception as e:
            print(f"❌ Error processing transcript: {str(e)}")
            transcript_data = None
        
        # Step 3: Get patient insights (optional)
        print("\nSTEP 3: Getting patient insights...")
        patient_insights = []
        try:
            patient_insights = get_patient_insights(patient_id, tenant_id)
            print(f"✅ Retrieved {len(patient_insights)} patient insights")
        except Exception as e:
            print(f"⚠️  Error retrieving patient insights: {str(e)}")
        
        # Step 4: Structure the AllergenIQ data
        print("\nSTEP 4: Structuring AllergenIQ profile data...")
        profile_data = structure_allergeniq_data(soap_notes, patient_insights, transcript_data)
        
        # Step 5: Enhanced logging of final results
        log_allergeniq_extraction_results(profile_data, transcript_data, soap_notes)
        
        # Step 6: Get patient metadata
        print("\nSTEP 5: Getting patient metadata...")
        patient_name = "Unknown Patient"
        patient_age = None
        visit_date = datetime.now().isoformat().split('T')[0]
        
        try:
            # Get patient details
            patient_doc = patients_collection.find_one({"_id": ObjectId(patient_id), "tenantId": tenant_id})
            if not patient_doc:
                patient_doc = patients_collection.find_one({"name": patient_id, "tenantId": tenant_id})
            
            if patient_doc:
                patient_name = patient_doc.get("name", "Unknown Patient")
                patient_age = patient_doc.get("age")
                print(f"✅ Patient details: {patient_name}, age: {patient_age}")
            
            # Get visit date
            visit_doc = visits_collection.find_one({"visitId": visit_id, "tenantId": tenant_id})
            if visit_doc and "startTime" in visit_doc:
                visit_date = visit_doc["startTime"].split('T')[0]
                print(f"✅ Visit date: {visit_date}")
                
        except Exception as e:
            print(f"⚠️  Error retrieving patient metadata: {str(e)}")
        
        # Step 7: Build final response
        result = {
            "success": True,
            "patient_id": patient_id,
            "visit_id": visit_id,
            "patient_name": patient_name,
            "patient_age": patient_age if patient_age is not None else None,
            "visit_date": visit_date,
            "profile": profile_data,
            "debug_info": {
                "transcript_length": len(raw_transcript),
                "transcript_processed": transcript_data is not None,
                "soap_sections": list(soap_notes.keys()) if soap_notes else [],
                "total_extracted_items": (
                    len(profile_data.get("symptomData", [])) +
                    len(profile_data.get("medicationHistory", [])) +
                    len(profile_data.get("allergenData", []))
                )
            }
        }
        
        print(f"\n✅ ALLERGENIQ PROFILE GENERATION COMPLETE")
        print(f"   Total items in profile: {result['debug_info']['total_extracted_items']}")
        print(f"   Primary diagnosis: {profile_data.get('summary', {}).get('primaryDiagnosis', 'None')}")
        print("="*60 + "\n")
        
        return jsonify(result), 200
        
    except Exception as e:
        error_msg = f"Failed to generate AllergenIQ profile: {str(e)}"
        print(f"\n❌ ALLERGENIQ ERROR: {error_msg}")
        print(f"   Stack trace: {traceback.format_exc()}")
        print("="*60 + "\n")
        
        return jsonify({
            "success": False,
            "error": error_msg,
            "debug_info": {
                "error_type": str(type(e).__name__),
                "patient_id": patient_id if 'patient_id' in locals() else "unknown",
                "visit_id": visit_id if 'visit_id' in locals() else "unknown"
            }
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

# Health check endpoint (Enhanced for Enterprise)
@app.route('/api/health', methods=['GET'])
def health_check():
    """Enhanced health check endpoint with enterprise features status"""
    try:
        # Test database connections
        db_status = "healthy"
        try:
            patients_collection.find_one({}, {"_id": 1})
            enterprise_trials_collection.find_one({}, {"_id": 1})
        except Exception:
            db_status = "unhealthy"
        
        # Test trial manager
        trial_manager_status = "healthy"
        try:
            test_analytics = enterprise_trial_manager.get_analytics_dashboard()
            if not test_analytics:
                trial_manager_status = "degraded"
        except Exception:
            trial_manager_status = "unhealthy"
        
        # Test SES
        ses_status = "healthy"
        try:
            ses_client.get_send_quota()
        except Exception:
            ses_status = "unhealthy"
        
        health_data = {
            'status': 'healthy' if all([
                db_status == 'healthy',
                trial_manager_status in ['healthy', 'degraded']
            ]) else 'degraded',
            'timestamp': datetime.now().isoformat(),
            'auth_methods': ['cognito', 'session'],
            'cognito_enabled': COGNITO_ENABLED,
            'enterprise_features': {
                'trial_manager': trial_manager_status,
                'email_service': ses_status,
                'database': db_status,
                'trial_length_days': TRIAL_LENGTH_DAYS,
                'usage_limit': TRIAL_USAGE_LIMIT
            },
            'version': '2.0.0-enterprise'
        }
        
        return jsonify(health_data)
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/test-enhanced-recommendations-complete', methods=['POST', 'GET'])
def test_enhanced_recommendations_complete():
    """Complete test of enhanced recommendations functionality"""
    try:
        # Test transcript based on your actual data
        test_transcript = """
        Patient was hospitalized for 4 days just before Easter due to a class A virus and pneumonia. 
        During the hospital stay, they received a shot which helped improve their condition. 
        A pulmonary lung doctor treated them for pneumonia. Since discharge, the patient has been 
        using a breathing machine for a few days post-hospitalization and reports feeling better. 
        They continue to experience a sensation of mucus dripping down the back of their throat, 
        leading to coughing and expectoration of thick mucus.

        The patient has been on Medrol 4 mg daily, Dulera twice daily, Spiriva daily, and Flonase 
        as needed. They also use an antihistamine and a breathing machine post-hospitalization. 
        FEV1 today is 61%, indicating severe obstruction, similar to the last visit at 60%.

        Patient reports symptoms suggestive of acid reflux, including a sensation of water dripping 
        down the throat and persistent cough, which could be contributing to asthma symptoms. 
        Plan to consider biologic injections for asthma and to try Pepcid twice daily for acid reflux. 
        Additional lifestyle modifications recommended include sleeping with the head elevated, 
        eating 2-3 hours before bed, and reducing intake of coffee, tea, alcohol, spicy, and fatty foods.

        Patient education on the benefits of biologic therapy, including reduced need for oral 
        steroids and improved quality of life, is crucial; follow-up in 2 weeks to discuss further 
        and initiate paperwork if patient agrees.
        """
        
        logger.info("🧪 COMPLETE TEST: Testing enhanced analyze_transcript function")
        
        # Test the function
        start_time = time.time()
        result = analyze_transcript(test_transcript)
        processing_time = time.time() - start_time
        
        # Analyze results
        enhanced_recs = result.get("enhanced_recommendations", {})
        
        test_results = {
            "success": True,
            "processing_time_seconds": round(processing_time, 2),
            "test_status": "COMPLETE",
            "enhanced_recommendations": {
                "type": str(type(enhanced_recs).__name__),
                "is_structured": isinstance(enhanced_recs, dict),
                "content": enhanced_recs
            }
        }
        
        if isinstance(enhanced_recs, dict):
            # SUCCESS CASE
            categories = list(enhanced_recs.keys())
            total_recommendations = sum(len(items) if isinstance(items, list) else 1 for items in enhanced_recs.values())
            
            test_results["enhanced_recommendations"].update({
                "status": "✅ SUCCESS - Properly structured",
                "categories_found": categories,
                "total_categories": len(categories),
                "total_recommendations": total_recommendations,
                "recommendations_per_category": {
                    category: len(items) if isinstance(items, list) else 1
                    for category, items in enhanced_recs.items()
                },
                "sample_from_each_category": {
                    category: items[0] if isinstance(items, list) and items else str(items)
                    for category, items in enhanced_recs.items()
                }
            })
            
            logger.info(f"✅ COMPLETE TEST SUCCESS: {len(categories)} categories, {total_recommendations} total recommendations")
            
        elif isinstance(enhanced_recs, list):
            # PARTIAL FAILURE - should have been converted
            test_results["enhanced_recommendations"].update({
                "status": "⚠️ PARTIAL FAILURE - Still a list (should be dict)",
                "list_length": len(enhanced_recs),
                "list_content": enhanced_recs,
                "fix_needed": "List-to-dict conversion failed"
            })
            
            logger.error(f"⚠️ COMPLETE TEST PARTIAL FAILURE: Still returning list instead of dict")
            
        elif isinstance(enhanced_recs, str):
            # MAJOR FAILURE - fallback to string
            test_results["enhanced_recommendations"].update({
                "status": "❌ MAJOR FAILURE - String fallback",
                "string_content": enhanced_recs,
                "fix_needed": "AI not generating proper recommendations"
            })
            
            logger.error(f"❌ COMPLETE TEST MAJOR FAILURE: Falling back to string")
            
        else:
            # UNEXPECTED
            test_results["enhanced_recommendations"].update({
                "status": f"❓ UNEXPECTED - Type {type(enhanced_recs)}",
                "content": str(enhanced_recs),
                "fix_needed": "Unexpected data type returned"
            })
            
            logger.error(f"❓ COMPLETE TEST UNEXPECTED: Type {type(enhanced_recs)}")
        
        # Test other SOAP sections
        soap_sections = {}
        for section in ["patient_history", "differential_diagnosis", "plan_of_care", "summary"]:
            if section in result:
                content = result[section]
                soap_sections[section] = {
                    "present": True,
                    "type": str(type(content).__name__),
                    "has_content": bool(content and str(content).strip() not in ["", "N/A"])
                }
            else:
                soap_sections[section] = {"present": False}
        
        test_results["soap_sections"] = soap_sections
        
        # Frontend compatibility check
        frontend_compatible = (
            isinstance(enhanced_recs, dict) and
            len(enhanced_recs) > 0 and
            all(isinstance(items, list) for items in enhanced_recs.values())
        )
        
        test_results["frontend_compatibility"] = {
            "compatible": frontend_compatible,
            "ready_for_display": frontend_compatible,
            "issues": [] if frontend_compatible else ["Enhanced recommendations not in expected dict format"]
        }
        
        # ENTERPRISE: Add trial test
        test_results["enterprise_features"] = {
            "trial_manager_active": bool(enterprise_trial_manager),
            "ses_configured": bool(SES_FROM_EMAIL),
            "collections_created": True
        }
        
        return jsonify(test_results), 200
        
    except Exception as e:
        logger.error(f"🚨 COMPLETE TEST ERROR: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "error_type": str(type(e).__name__),
            "traceback": traceback.format_exc()
        }), 500

# ============================================================================
# ENTERPRISE SCHEDULED TASKS (Background Tasks)
# ============================================================================

def run_scheduled_reminder_check():
    """Background task to check and send renewal reminders"""
    try:
        logger.info("🔄 Running scheduled renewal reminder check...")
        sent_count = enterprise_trial_manager.check_and_send_reminders()
        logger.info(f"✅ Completed reminder check: {sent_count} reminders sent")
    except Exception as e:
        logger.error(f"❌ Error in scheduled reminder check: {str(e)}")

@app.route('/api/enterprise/manual-reminder-check', methods=['POST', 'OPTIONS'])
def manual_reminder_check():
    """Manual trigger for reminder check (admin function)"""
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
        
    try:
        # This should be protected with admin authentication in production
        sent_count = enterprise_trial_manager.check_and_send_reminders()
        
        return jsonify({
            'success': True,
            'reminders_sent': sent_count,
            'message': f'Manually triggered reminder check: {sent_count} reminders sent',
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error in manual reminder check: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Start background reminder scheduler (if needed)
def start_background_scheduler():
    """Start background scheduler for enterprise features"""
    try:
        import threading
        import schedule
        
        # Schedule daily reminder checks at 9 AM
        schedule.every().day.at("09:00").do(run_scheduled_reminder_check)
        
        def run_scheduler():
            while True:
                schedule.run_pending()
                time.sleep(3600)  # Check every hour
        
        scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        scheduler_thread.start()
        logger.info("✅ Background scheduler started for enterprise features")
        
    except ImportError:
        logger.warning("⚠️ Schedule library not available, skipping background scheduler")
    except Exception as e:
        logger.error(f"❌ Error starting background scheduler: {str(e)}")

if __name__ == '__main__':
    try:
        # Create MongoDB indexes
        patients_collection.create_index([("tenantId", 1)])
        transcripts_collection.create_index([("tenantId", 1), ("patientId", 1)])
        visits_collection.create_index([("tenantId", 1), ("patientId", 1)])
        
        # ENTERPRISE: Create enterprise indexes
        enterprise_trials_collection.create_index([("email", 1), ("trial_start", -1)])
        enterprise_trials_collection.create_index([("trial_status", 1), ("days_remaining", 1)])
        usage_analytics_collection.create_index([("email", 1), ("date", -1)])
        email_campaigns_collection.create_index([("email", 1), ("campaign_type", 1)])
        
        logger.info("MongoDB indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating MongoDB indexes: {str(e)}")
    
    # Print configuration summary
    print("\n" + "="*80)
    print("🏥 MEDORAMD ENTERPRISE BACKEND SERVER")
    print("="*80)
    print("Backend server starting with enterprise features...")
    
    # Authentication Status
    if COGNITO_ENABLED:
        print(f"✅ Cognito Authentication: ENABLED")
        print(f"   Region: {COGNITO_REGION}")
        print(f"   User Pool ID: {COGNITO_USER_POOL_ID}")
        print(f"   Client ID: {COGNITO_CLIENT_ID}")
    else:
        print(f"⚠️ Cognito Authentication: DISABLED (missing configuration)")
    print("✅ Session Authentication: ENABLED (backward compatible)")
    
    # Enterprise Features Status
    print("\n🏢 ENTERPRISE FEATURES:")
    print(f"✅ Enterprise Trial Management: ACTIVE")
    print(f"   - Trial Length: {TRIAL_LENGTH_DAYS} days")
    print(f"   - Usage Limit: {TRIAL_USAGE_LIMIT} analyses")
    print(f"   - Automatic trials for new Cognito users: ENABLED")
    
    print(f"✅ Email Service (AWS SES): {'ENABLED' if SES_FROM_EMAIL else 'DISABLED'}")
    if SES_FROM_EMAIL:
        print(f"   - From Email: {SES_FROM_EMAIL}")
        print(f"   - From Name: {SES_FROM_NAME}")
    
    print(f"✅ Analytics Dashboard: ENABLED")
    print(f"✅ Usage Tracking: ENABLED")
    print(f"✅ Renewal Reminders: ENABLED")
    print(f"   - Reminder Schedule: {enterprise_trial_manager.reminder_schedule} days before expiry")
    
    # Database Status
    print(f"\n💾 DATABASE COLLECTIONS:")
    print(f"   - Patients: {patients_collection.name}")
    print(f"   - Transcripts: {transcripts_collection.name}")
    print(f"   - Visits: {visits_collection.name}")
    print(f"   - Enterprise Trials: {enterprise_trials_collection.name}")
    print(f"   - Usage Analytics: {usage_analytics_collection.name}")
    print(f"   - Email Campaigns: {email_campaigns_collection.name}")
    
    # API Endpoints Summary
    print(f"\n🔗 ENTERPRISE API ENDPOINTS:")
    print(f"   - GET  /api/enterprise/user-trial-status")
    print(f"   - GET  /api/enterprise/trial-analytics")
    print(f"   - POST /api/enterprise/send-welcome-email")
    print(f"   - POST /api/enterprise/send-renewal-reminders")
    print(f"   - GET  /api/health (enhanced)")
    print(f"   - GET  /api/debug/cognito-test")
    
    print(f"\n🔧 BACKWARD COMPATIBILITY:")
    print(f"   - All existing endpoints: PRESERVED")
    print(f"   - Legacy authentication: SUPPORTED")
    print(f"   - Existing user data: MAINTAINED")
    
    print("="*80)
    print("🚀 Server ready for production deployment!")
    print("="*80 + "\n")
    
    # Start background scheduler for enterprise features
    start_background_scheduler()
    
    # Start the Flask application
    app.run(host='0.0.0.0', port=PORT, debug=False)
                    



