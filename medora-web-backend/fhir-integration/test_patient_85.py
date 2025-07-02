#!/usr/bin/env python3
"""
Test specific FHIR endpoint: GET /mps/fhir/R4/Patient/85
"""

import requests
import json
from datetime import datetime

# Configuration
IMS_BASE_URL = "https://meditabfhirsandbox.meditab.com"
PATIENT_ENDPOINT = "/mps/fhir/R4/Patient/85"

def log_message(message, level="INFO"):
    """Log messages with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")

def load_access_token():
    """Load access token from file or get from user"""
    try:
        with open("access_token.txt", "r") as f:
            token = f.read().strip()
            if token:
                log_message("✅ Access token loaded from file")
                return token
    except FileNotFoundError:
        pass
    
    # If no file, ask user to provide token
    print("No access token file found.")
    token = input("Please paste your access token here: ").strip()
    
    if token:
        # Save for future use
        with open("access_token.txt", "w") as f:
            f.write(token)
        log_message("✅ Access token saved to file")
        return token
    
    return None

def test_patient_85(access_token):
    """Test the specific Patient/85 endpoint"""
    log_message("🔍 Testing GET /mps/fhir/R4/Patient/85")
    
    # Construct full URL
    full_url = f"{IMS_BASE_URL}{PATIENT_ENDPOINT}"
    log_message(f"URL: {full_url}")
    
    # Set headers
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/fhir+json",
        "Content-Type": "application/fhir+json"
    }
    
    try:
        log_message("📡 Sending GET request...")
        
        # Make the request
        response = requests.get(full_url, headers=headers, timeout=30)
        
        log_message(f"📊 Response Status: {response.status_code}")
        log_message(f"📊 Response Headers: {dict(response.headers)}")
        
        # Check response
        if response.status_code == 200:
            log_message("✅ SUCCESS: Patient data retrieved!")
            
            try:
                patient_data = response.json()
                
                # Display patient info
                log_message("\n👤 PATIENT INFORMATION:")
                log_message(f"Resource Type: {patient_data.get('resourceType', 'Unknown')}")
                log_message(f"Patient ID: {patient_data.get('id', 'Unknown')}")
                
                # Extract patient name
                if 'name' in patient_data and len(patient_data['name']) > 0:
                    name = patient_data['name'][0]
                    given_names = ' '.join(name.get('given', []))
                    family_name = name.get('family', '')
                    full_name = f"{given_names} {family_name}".strip()
                    log_message(f"Patient Name: {full_name}")
                
                # Extract other basic info
                if 'gender' in patient_data:
                    log_message(f"Gender: {patient_data['gender']}")
                
                if 'birthDate' in patient_data:
                    log_message(f"Birth Date: {patient_data['birthDate']}")
                
                if 'identifier' in patient_data:
                    log_message(f"Identifiers: {len(patient_data['identifier'])} found")
                
                # Save full response
                with open("patient_85_response.json", "w") as f:
                    json.dump(patient_data, f, indent=2)
                
                log_message("💾 Full patient data saved to 'patient_85_response.json'")
                
                # Show sample of the JSON structure
                log_message("\n📋 JSON STRUCTURE PREVIEW:")
                preview = {k: type(v).__name__ for k, v in patient_data.items()}
                log_message(json.dumps(preview, indent=2))
                
                return True
                
            except json.JSONDecodeError:
                log_message("⚠️  Response is not valid JSON:")
                log_message(response.text[:500])
                return False
                
        elif response.status_code == 401:
            log_message("❌ UNAUTHORIZED: Access token may be expired or invalid", "ERROR")
            log_message("Try generating a new access token")
            return False
            
        elif response.status_code == 403:
            log_message("❌ FORBIDDEN: Insufficient permissions to access this patient", "ERROR")
            log_message("Check your token scopes")
            return False
            
        elif response.status_code == 404:
            log_message("❌ NOT FOUND: Patient ID 85 does not exist", "ERROR")
            return False
            
        elif response.status_code == 429:
            log_message("❌ RATE LIMITED: Too many requests", "ERROR")
            return False
            
        else:
            log_message(f"❌ UNEXPECTED STATUS: {response.status_code}", "ERROR")
            log_message(f"Response: {response.text}")
            return False
    
    except requests.exceptions.Timeout:
        log_message("❌ REQUEST TIMEOUT: Server took too long to respond", "ERROR")
        return False
        
    except requests.exceptions.ConnectionError:
        log_message("❌ CONNECTION ERROR: Could not connect to server", "ERROR")
        return False
        
    except Exception as e:
        log_message(f"❌ UNEXPECTED ERROR: {str(e)}", "ERROR")
        return False

def main():
    """Main function"""
    print("🏥 TESTING PATIENT/85 ENDPOINT")
    print("=" * 50)
    
    # Load access token
    access_token = load_access_token()
    if not access_token:
        log_message("❌ No access token available", "ERROR")
        return
    
    # Test the endpoint
    success = test_patient_85(access_token)
    
    print("\n" + "=" * 50)
    if success:
        log_message("🎉 Patient/85 test completed successfully!")
        log_message("📁 Check 'patient_85_response.json' for full data")
    else:
        log_message("❌ Patient/85 test failed")
        log_message("💡 Try running the complete integration script first to get a fresh token")

if __name__ == "__main__":
    main()
