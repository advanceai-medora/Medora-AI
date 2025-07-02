#!/usr/bin/env python3
"""
Debug FHIR connectivity and test various endpoints
"""

import requests
import json
import time
from datetime import datetime

# Configuration
IMS_BASE_URL = "https://meditabfhirsandbox.meditab.com"
IMS_FHIR_BASE = "/mps/fhir/R4"

def log_message(message, level="INFO"):
    """Log messages with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")

def load_access_token():
    """Load access token"""
    try:
        with open("access_token.txt", "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        token = input("Please paste your access token: ").strip()
        if token:
            with open("access_token.txt", "w") as f:
                f.write(token)
        return token

def test_connectivity():
    """Test basic connectivity to the server"""
    log_message("🌐 Testing basic connectivity...")
    
    try:
        # Test base URL without authentication
        response = requests.get(IMS_BASE_URL, timeout=10)
        log_message(f"Base URL status: {response.status_code}")
        return True
    except requests.exceptions.Timeout:
        log_message("❌ Base URL timeout", "ERROR")
        return False
    except Exception as e:
        log_message(f"❌ Connectivity error: {str(e)}", "ERROR")
        return False

def test_endpoint_with_timeouts(access_token, endpoint, timeouts=[10, 30, 60]):
    """Test endpoint with increasing timeouts"""
    log_message(f"🔍 Testing {endpoint} with different timeouts...")
    
    full_url = f"{IMS_BASE_URL}{IMS_FHIR_BASE}/{endpoint}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/fhir+json"
    }
    
    for timeout in timeouts:
        try:
            log_message(f"  ⏱️  Trying {timeout}s timeout...")
            start_time = time.time()
            
            response = requests.get(full_url, headers=headers, timeout=timeout)
            
            elapsed = time.time() - start_time
            log_message(f"  ✅ Response in {elapsed:.2f}s - Status: {response.status_code}")
            
            if response.status_code == 200:
                return response, elapsed
            else:
                log_message(f"  ❌ HTTP {response.status_code}: {response.text[:200]}")
                
        except requests.exceptions.Timeout:
            log_message(f"  ❌ Timeout after {timeout}s")
        except Exception as e:
            log_message(f"  ❌ Error: {str(e)}")
    
    return None, None

def test_metadata_endpoint(access_token):
    """Test the metadata endpoint (usually fastest)"""
    log_message("📋 Testing metadata endpoint...")
    
    response, elapsed = test_endpoint_with_timeouts(access_token, "metadata")
    
    if response:
        try:
            content = response.json()
            log_message(f"✅ Metadata retrieved in {elapsed:.2f}s")
            
            # Save and show basic info
            with open("debug_metadata.json", "w") as f:
                json.dump(content, f, indent=2)
            
            if 'software' in content:
                log_message(f"FHIR Server: {content['software'].get('name', 'Unknown')}")
            
            if 'fhirVersion' in content:
                log_message(f"FHIR Version: {content['fhirVersion']}")
            
            return True
        except Exception as e:
            log_message(f"❌ Error parsing metadata: {str(e)}", "ERROR")
    
    return False

def test_patient_endpoints(access_token):
    """Test different patient endpoints"""
    log_message("👥 Testing Patient endpoints...")
    
    # Test patient search (might be faster than specific patient)
    log_message("  🔍 Testing Patient search...")
    response, elapsed = test_endpoint_with_timeouts(access_token, "Patient?_count=1")
    
    if response and response.status_code == 200:
        try:
            content = response.json()
            log_message(f"  ✅ Patient search successful in {elapsed:.2f}s")
            
            # Check if we got any patients
            if 'entry' in content and len(content['entry']) > 0:
                first_patient = content['entry'][0]['resource']
                patient_id = first_patient.get('id', 'Unknown')
                log_message(f"  📋 Found patient ID: {patient_id}")
                
                # Now try to get this specific patient
                log_message(f"  🔍 Testing Patient/{patient_id}...")
                specific_response, specific_elapsed = test_endpoint_with_timeouts(
                    access_token, f"Patient/{patient_id}"
                )
                
                if specific_response and specific_response.status_code == 200:
                    log_message(f"  ✅ Specific patient retrieved in {specific_elapsed:.2f}s")
                    
                    # Save the patient data
                    patient_data = specific_response.json()
                    with open(f"debug_patient_{patient_id}.json", "w") as f:
                        json.dump(patient_data, f, indent=2)
                    
                    return patient_id
            else:
                log_message("  ⚠️  No patients found in search results")
        except Exception as e:
            log_message(f"  ❌ Error parsing patient data: {str(e)}")
    
    # If search didn't work, try the original Patient/85
    log_message("  🔍 Testing original Patient/85...")
    response, elapsed = test_endpoint_with_timeouts(access_token, "Patient/85")
    
    if response and response.status_code == 200:
        log_message(f"  ✅ Patient/85 retrieved in {elapsed:.2f}s")
        
        try:
            patient_data = response.json()
            with open("debug_patient_85.json", "w") as f:
                json.dump(patient_data, f, indent=2)
            return "85"
        except Exception as e:
            log_message(f"  ❌ Error parsing Patient/85: {str(e)}")
    elif response:
        log_message(f"  ❌ Patient/85 returned HTTP {response.status_code}")
    
    return None

def check_server_status():
    """Check if there are any known server issues"""
    log_message("🏥 Checking server status...")
    
    # Test if the FHIR base endpoint responds
    try:
        response = requests.get(f"{IMS_BASE_URL}{IMS_FHIR_BASE}", timeout=30)
        log_message(f"FHIR base endpoint status: {response.status_code}")
        
        if response.status_code == 401:
            log_message("✅ Server is responding (authentication required)")
            return True
        elif response.status_code in [200, 403]:
            log_message("✅ Server is responding")
            return True
        else:
            log_message(f"⚠️  Unexpected status: {response.status_code}")
            return False
            
    except requests.exceptions.Timeout:
        log_message("❌ FHIR base endpoint timeout")
        return False
    except Exception as e:
        log_message(f"❌ Server check error: {str(e)}")
        return False

def main():
    """Main debugging function"""
    print("🔧 FHIR ENDPOINT DEBUGGING")
    print("=" * 50)
    
    # Step 1: Basic connectivity
    log_message("STEP 1: Basic connectivity test")
    if not test_connectivity():
        log_message("❌ Basic connectivity failed - check network connection", "ERROR")
        return
    
    # Step 2: Server status
    log_message("\nSTEP 2: Server status check")
    if not check_server_status():
        log_message("❌ Server appears to be down or slow", "ERROR")
        return
    
    # Step 3: Load access token
    log_message("\nSTEP 3: Loading access token")
    access_token = load_access_token()
    if not access_token:
        log_message("❌ No access token available", "ERROR")
        return
    
    # Step 4: Test metadata (fastest endpoint)
    log_message("\nSTEP 4: Testing metadata endpoint")
    if not test_metadata_endpoint(access_token):
        log_message("❌ Metadata endpoint failed", "ERROR")
        return
    
    # Step 5: Test patient endpoints
    log_message("\nSTEP 5: Testing patient endpoints")
    patient_id = test_patient_endpoints(access_token)
    
    print("\n" + "=" * 50)
    if patient_id:
        log_message(f"🎉 Successfully accessed patient data! Patient ID: {patient_id}")
        log_message("📁 Check debug_*.json files for full responses")
    else:
        log_message("❌ Patient endpoint access failed")
        log_message("💡 The server might be slow or the specific patient might not exist")
    
    log_message("\n📊 SUMMARY:")
    log_message("- If metadata worked but patients didn't: Permission issue")
    log_message("- If everything times out: Server performance issue")
    log_message("- Check the debug JSON files for detailed responses")

if __name__ == "__main__":
    main()
