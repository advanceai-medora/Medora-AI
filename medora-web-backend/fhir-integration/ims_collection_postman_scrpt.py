#!/usr/bin/env python3
"""
Test IMS FHIR Collection Endpoints
Based on the Postman collection provided by IMS team
"""

import requests
import json
from datetime import datetime

# Configuration from IMS Collection
IMS_BASE_URL = "https://meditabfhirsandbox.meditab.com:2525"  # Using public URL first
# IMS_BASE_URL = "https://172.16.16.52:2525"  # Internal URL from collection
IMS_FHIR_ENDPOINT = "/mps/fhir/R4"

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
                log_message("Access token loaded from file")
                return token
    except FileNotFoundError:
        pass
    
    token = input("Please paste your access token here: ").strip()
    if token:
        with open("access_token.txt", "w") as f:
            f.write(token)
        log_message("Access token saved to file")
        return token
    
    return None

def make_fhir_request(access_token, endpoint_path, description=""):
    """Make a FHIR request and return the response"""
    full_url = f"{IMS_BASE_URL}{IMS_FHIR_ENDPOINT}{endpoint_path}"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/fhir+json",
        "Content-Type": "application/json"
    }
    
    try:
        log_message(f"Testing: {description}")
        log_message(f"URL: {full_url}")
        
        response = requests.get(full_url, headers=headers, timeout=30)
        
        log_message(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                
                # Count resources if it's a bundle
                if data.get('resourceType') == 'Bundle':
                    resource_count = len(data.get('entry', []))
                    log_message(f"SUCCESS: Retrieved {resource_count} resources")
                else:
                    log_message(f"SUCCESS: Retrieved single resource")
                
                return True, data
            except json.JSONDecodeError:
                log_message(f"Response is not valid JSON")
                return False, response.text
        else:
            log_message(f"FAILED: HTTP {response.status_code}")
            log_message(f"Response: {response.text[:200]}...")
            return False, None
            
    except requests.exceptions.Timeout:
        log_message(f"TIMEOUT: Request took too long")
        return False, None
    except Exception as e:
        log_message(f"ERROR: {str(e)}")
        return False, None

def test_ims_collection_endpoints(access_token):
    """Test the specific endpoints from IMS collection"""
    
    # Test cases from the Postman collection
    test_cases = [
        # Metadata (no auth required usually)
        ("/metadata", "FHIR Capability Statement"),
        
        # Patient endpoints from collection
        ("/Patient/Patient-23094", "Read Patient-23094 (from collection)"),
        ("/Patient?name=Jay", "Search patients by name Jay"),
        ("/Patient?_id=Patient-85", "Search for Patient-85"),
        ("/Patient?birthdate=2005-12-21", "Search by birthdate"),
        ("/Patient?name=Jay&gender=male", "Search by name and gender"),
        
        # Try some other working patient IDs from collection
        ("/Patient/Patient-195181", "Read Patient-195181"),
        ("/Patient?_id=Patient-195181", "Search for Patient-195181"),
        
        # Other resource types from collection
        ("/Practitioner/Practitioner-3410", "Read Practitioner-3410"),
        ("/Organization/Organization-27", "Read Organization-27"),
        ("/Location/Location-1", "Read Location-1"),
        
        # Search endpoints
        ("/Condition?patient=Patient-195181", "Conditions for Patient-195181"),
        ("/Observation?patient=Patient-195181", "Observations for Patient-195181"),
        ("/MedicationRequest?patient=Patient-195181", "Medications for Patient-195181"),
        ("/AllergyIntolerance?patient=Patient-195181", "Allergies for Patient-195181"),
        
        # Simple searches
        ("/Patient?_count=5", "First 5 patients"),
        ("/Practitioner?_count=3", "First 3 practitioners"),
        ("/Organization?_count=3", "First 3 organizations"),
    ]
    
    results = []
    successful_tests = []
    
    log_message("Starting IMS Collection Tests")
    log_message("=" * 60)
    
    for endpoint, description in test_cases:
        log_message(f"\n--- Test: {description} ---")
        
        success, data = make_fhir_request(access_token, endpoint, description)
        results.append((description, success))
        
        if success and data:
            successful_tests.append((description, endpoint, data))
            
            # Save successful responses
            safe_filename = description.replace(" ", "_").replace("/", "_").replace(":", "")
            filename = f"ims_test_{safe_filename}.json"
            
            try:
                with open(filename, "w") as f:
                    json.dump(data, f, indent=2)
                log_message(f"Saved response to: {filename}")
            except Exception as e:
                log_message(f"Could not save file: {str(e)}")
    
    # Summary
    log_message("\n" + "=" * 60)
    log_message("TEST RESULTS SUMMARY")
    log_message("=" * 60)
    
    success_count = 0
    for description, success in results:
        status = "SUCCESS" if success else "FAILED"
        if success:
            success_count += 1
        log_message(f"{description}: {status}")
    
    log_message(f"\nOverall Results: {success_count}/{len(results)} tests passed")
    
    if successful_tests:
        log_message(f"\n{len(successful_tests)} endpoints are working!")
        log_message("\nWorking Endpoints:")
        
        for description, endpoint, data in successful_tests:
            log_message(f"  - {description}")
            
            # Show some key info about the data
            if isinstance(data, dict):
                if data.get('resourceType') == 'Bundle':
                    entry_count = len(data.get('entry', []))
                    log_message(f"    Bundle with {entry_count} entries")
                elif 'resourceType' in data:
                    resource_type = data['resourceType']
                    resource_id = data.get('id', 'Unknown')
                    log_message(f"    {resource_type} with ID: {resource_id}")
        
        log_message(f"\n{len(successful_tests)} JSON response files saved")
        log_message("Check the ims_test_*.json files for detailed responses")
        
        return True
    else:
        log_message("\nNo endpoints are working")
        log_message("This might be a network connectivity issue")
        log_message("Try checking if the access token is still valid")
        return False

def test_basic_connectivity(access_token):
    """Test basic connectivity first"""
    log_message("Testing basic connectivity...")
    
    # Test metadata endpoint (usually doesn't require auth)
    try:
        metadata_url = f"{IMS_BASE_URL}{IMS_FHIR_ENDPOINT}/metadata"
        response = requests.get(metadata_url, timeout=10)
        
        if response.status_code in [200, 401]:  # 401 is fine, means server is up
            log_message("Server is reachable")
            return True
        else:
            log_message(f"Server returned status: {response.status_code}")
            return False
    except Exception as e:
        log_message(f"Connectivity test failed: {str(e)}")
        return False

def main():
    """Main test function"""
    print("IMS FHIR COLLECTION TESTER")
    print("=" * 50)
    print("Testing endpoints from IMS Postman collection")
    print("=" * 50)
    
    # Get access token
    access_token = load_access_token()
    if not access_token:
        log_message("No access token available", "ERROR")
        return
    
    # Test basic connectivity first
    if not test_basic_connectivity(access_token):
        log_message("Basic connectivity failed", "ERROR")
        log_message("Check your network connection or try the internal URL")
        return
    
    # Run the collection tests
    success = test_ims_collection_endpoints(access_token)
    
    print("\n" + "=" * 50)
    if success:
        log_message("IMS Collection tests completed successfully!")
        log_message("You now know exactly what FHIR data is available")
        log_message("Ready to build Medora CO PILOT features!")
    else:
        log_message("Collection tests failed")
        log_message("Try generating a fresh access token")
        log_message("Or check if you need to use the internal URL")
    
    log_message("\nNext steps:")
    log_message("  1. Review the ims_test_*.json files")
    log_message("  2. Identify what patient data is available")
    log_message("  3. Plan Medora CO PILOT features based on available data")

if __name__ == "__main__":
    main()
