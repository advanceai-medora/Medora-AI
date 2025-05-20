import jwt
import time
import uuid
import requests
import json
import os
from datetime import datetime

# Configuration
IMS_BASE_URL = "https://meditabfhirsandbox.meditab.com"
IMS_FHIR_ENDPOINT = "/mps/fhir/R4"
IMS_TOKEN_ENDPOINT = "https://keycloak-qa.medpharmservices.com:8443/realms/fhir-0051185/protocol/openid-connect/token"
IMS_CLIENT_ID = "4ddd3a59-414c-405e-acc5-226c097a7060"
PRIVATE_KEY_PATH = "/var/www/medora-frontend/public/medora_private_key.pem"  # Consider moving to secure location

# For logging
LOG_FILE = "medora_ims_integration_test.log"

def log_message(message):
    """Log messages with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] {message}"
    print(log_entry)
    
    with open(LOG_FILE, "a") as f:
        f.write(log_entry + "\n")

def load_private_key():
    """Load the private key from file"""
    try:
        with open(PRIVATE_KEY_PATH, 'r') as f:
            return f.read()
    except Exception as e:
        log_message(f"ERROR: Failed to load private key: {str(e)}")
        exit(1)

def generate_jwt_assertion(private_key):
    """Generate a JWT assertion for client credentials grant"""
    now = int(time.time())
    jti_value = str(uuid.uuid4())
    
    payload = {
        "sub": IMS_CLIENT_ID,
        "aud": IMS_TOKEN_ENDPOINT,
        "iss": IMS_CLIENT_ID,
        "exp": now + 300,  # 5 minutes expiration
        "iat": now,
        "jti": jti_value
    }
    
    try:
        assertion = jwt.encode(payload, private_key, algorithm="RS384")
        log_message(f"Generated JWT assertion with jti: {jti_value}")
        return assertion
    except Exception as e:
        log_message(f"ERROR: Failed to create JWT: {str(e)}")
        return None

def get_access_token(assertion):
    """Request an access token using the JWT assertion"""
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    payload = {
        "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "grant_type": "client_credentials",
        "client_id": IMS_CLIENT_ID,
        "client_assertion": assertion
    }
    
    try:
        log_message("Requesting access token...")
        response = requests.post(
            IMS_TOKEN_ENDPOINT, 
            headers=headers, 
            data=payload, 
            timeout=10
        )
        
        if response.status_code == 200:
            token_data = response.json()
            log_message(f"Successfully obtained token. Expires in: {token_data.get('expires_in')} seconds")
            return token_data.get('access_token')
        else:
            log_message(f"Token request failed with status {response.status_code}")
            log_message(f"Response: {response.text}")
            return None
            
    except Exception as e:
        log_message(f"ERROR during token request: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            log_message(f"Response status: {e.response.status_code}")
            log_message(f"Response text: {e.response.text}")
        return None

def test_fhir_endpoint(access_token, resource_type, params=None):
    """Test a FHIR endpoint with the access token"""
    if not params:
        params = {}
        
    fhir_url = f"{IMS_BASE_URL}{IMS_FHIR_ENDPOINT}/{resource_type}"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/fhir+json"
    }
    
    try:
        log_message(f"Testing FHIR endpoint: {resource_type}")
        response = requests.get(fhir_url, headers=headers, params=params, timeout=20)
        
        log_message(f"FHIR {resource_type} response status: {response.status_code}")
        
        if response.status_code == 200:
            content = response.json()
            resource_count = len(content.get('entry', [])) if 'entry' in content else 0
            log_message(f"Successfully retrieved {resource_count} {resource_type} resources")
            
            # Save a sample of the response for review
            with open(f"sample_{resource_type.lower()}_response.json", "w") as f:
                json.dump(content, f, indent=2)
                
            return True
        else:
            log_message(f"FHIR {resource_type} request failed: {response.text}")
            return False
            
    except Exception as e:
        log_message(f"ERROR during FHIR {resource_type} request: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            log_message(f"Response status: {e.response.status_code}")
            log_message(f"Response text: {e.response.text}")
        return False

def test_patient_search(access_token, name=None):
    """Test Patient search with optional name parameter"""
    params = {}
    if name:
        params['name'] = name
    
    return test_fhir_endpoint(access_token, "Patient", params)

def test_metadata(access_token):
    """Test the FHIR capability statement (metadata)"""
    fhir_url = f"{IMS_BASE_URL}{IMS_FHIR_ENDPOINT}/metadata"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/fhir+json"
    }
    
    try:
        log_message("Testing FHIR capability statement (metadata)")
        response = requests.get(fhir_url, headers=headers, timeout=20)
        
        log_message(f"FHIR metadata response status: {response.status_code}")
        
        if response.status_code == 200:
            content = response.json()
            
            # Save the capability statement for review
            with open("fhir_capability_statement.json", "w") as f:
                json.dump(content, f, indent=2)
                
            log_message("Successfully retrieved FHIR capability statement")
            
            # Extract supported resources and operations
            if 'rest' in content and len(content['rest']) > 0:
                resources = content['rest'][0].get('resource', [])
                supported_resources = [r.get('type') for r in resources]
                log_message(f"Supported resources: {', '.join(supported_resources)}")
                
            return True
        else:
            log_message(f"FHIR metadata request failed: {response.text}")
            return False
            
    except Exception as e:
        log_message(f"ERROR during FHIR metadata request: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            log_message(f"Response status: {e.response.status_code}")
            log_message(f"Response text: {e.response.text}")
        return False

def main():
    """Main test function"""
    log_message("=== STARTING MEDORA-IMS INTEGRATION TEST ===")
    
    # 1. Load private key
    private_key = load_private_key()
    if not private_key:
        return
    
    # 2. Generate JWT assertion
    assertion = generate_jwt_assertion(private_key)
    if not assertion:
        return
    
    # 3. Get access token
    access_token = get_access_token(assertion)
    if not access_token:
        log_message("Failed to obtain access token. Test aborted.")
        return
    
    # 4. Test FHIR endpoints
    test_results = []
    
    # 4.1 Test metadata/capability statement
    meta_result = test_metadata(access_token)
    test_results.append(("FHIR Capability Statement", meta_result))
    
    # 4.2 Test Patient endpoint
    patient_result = test_fhir_endpoint(access_token, "Patient")
    test_results.append(("Patient Resource", patient_result))
    
    # 4.3 Test Practitioner endpoint
    practitioner_result = test_fhir_endpoint(access_token, "Practitioner")
    test_results.append(("Practitioner Resource", practitioner_result))
    
    # 4.4 Test Organization endpoint
    org_result = test_fhir_endpoint(access_token, "Organization")
    test_results.append(("Organization Resource", org_result))
    
    # 4.5 Test a patient search with name parameter
    patient_search_result = test_patient_search(access_token, "Smith")
    test_results.append(("Patient Search by Name", patient_search_result))
    
    # 5. Summarize results
    log_message("\n=== TEST RESULTS SUMMARY ===")
    success_count = 0
    
    for test_name, result in test_results:
        status = "SUCCESS" if result else "FAILED"
        if result:
            success_count += 1
        log_message(f"{test_name}: {status}")
    
    overall_status = "SUCCESS" if success_count == len(test_results) else "PARTIAL SUCCESS" if success_count > 0 else "FAILED"
    log_message(f"\nOVERALL TEST STATUS: {overall_status} ({success_count}/{len(test_results)} tests passed)")
    log_message("=== TEST COMPLETED ===")

if __name__ == "__main__":
    main()
