#!/usr/bin/env python3
"""
Complete Medora-IMS Integration Script
=====================================
This script handles the complete authentication and testing flow:
1. Generates JWT assertion token
2. Requests access token from IMS
3. Tests FHIR endpoints
4. Analyzes tokens
5. Saves all results to files
"""

import jwt
import time
import uuid
import requests
import json
import base64
from datetime import datetime

# Configuration
IMS_BASE_URL = "https://meditabfhirsandbox.meditab.com"
IMS_FHIR_ENDPOINT = "/mps/fhir/R4"
IMS_TOKEN_ENDPOINT = "https://keycloak-qa.medpharmservices.com:8443/realms/fhir-0051185/protocol/openid-connect/token"
IMS_CLIENT_ID = "4ddd3a59-414c-405e-acc5-226c097a7060"
PRIVATE_KEY_PATH = "/var/www/medora-frontend/public/medora_private_key.pem"

class MedoraIMSIntegration:
    def __init__(self):
        self.jwt_assertion = None
        self.access_token = None
        self.token_data = None
        
    def log_message(self, message, level="INFO"):
        """Log messages with timestamp and level"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] [{level}] {message}"
        print(log_entry)
        
        # Also save to log file
        with open("medora_ims_complete.log", "a") as f:
            f.write(log_entry + "\n")
    
    def load_private_key(self):
        """Load the private key from file"""
        try:
            with open(PRIVATE_KEY_PATH, 'r') as f:
                return f.read()
        except Exception as e:
            self.log_message(f"Failed to load private key: {str(e)}", "ERROR")
            return None
    
    def generate_jwt_assertion(self):
        """Generate JWT assertion token"""
        self.log_message("=== STEP 1: GENERATING JWT ASSERTION ===")
        
        private_key = self.load_private_key()
        if not private_key:
            return False
            
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
            self.jwt_assertion = jwt.encode(payload, private_key, algorithm="RS384")
            
            self.log_message("✅ JWT assertion generated successfully")
            self.log_message(f"JTI: {jti_value}")
            self.log_message("JWT Payload:")
            self.log_message(json.dumps(payload, indent=2))
            self.log_message("JWT Assertion Token:")
            self.log_message(self.jwt_assertion)
            
            # Save JWT assertion
            with open("jwt_assertion.txt", "w") as f:
                f.write(self.jwt_assertion)
            
            self.log_message("💾 JWT assertion saved to 'jwt_assertion.txt'")
            return True
            
        except Exception as e:
            self.log_message(f"Failed to create JWT: {str(e)}", "ERROR")
            return False
    
    def get_access_token(self):
        """Request access token from IMS"""
        self.log_message("\n=== STEP 2: REQUESTING ACCESS TOKEN ===")
        
        if not self.jwt_assertion:
            self.log_message("No JWT assertion available", "ERROR")
            return False
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        payload = {
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "grant_type": "client_credentials",
            "client_id": IMS_CLIENT_ID,
            "client_assertion": self.jwt_assertion
        }
        
        try:
            self.log_message("Requesting access token from IMS...")
            response = requests.post(
                IMS_TOKEN_ENDPOINT, 
                headers=headers, 
                data=payload, 
                timeout=15
            )
            
            if response.status_code == 200:
                self.token_data = response.json()
                self.access_token = self.token_data.get('access_token')
                
                self.log_message("✅ ACCESS TOKEN RECEIVED!")
                self.log_message(f"Token type: {self.token_data.get('token_type', 'Bearer')}")
                self.log_message(f"Expires in: {self.token_data.get('expires_in')} seconds")
                self.log_message(f"Scope: {self.token_data.get('scope', 'Not specified')}")
                
                self.log_message("\n🔑 ACCESS TOKEN:")
                self.log_message(self.access_token)
                
                # Save access token
                with open("access_token.txt", "w") as f:
                    f.write(self.access_token)
                
                # Save complete token data
                token_info = {
                    "access_token": self.access_token,
                    "token_type": self.token_data.get('token_type', 'Bearer'),
                    "expires_in": self.token_data.get('expires_in'),
                    "scope": self.token_data.get('scope'),
                    "obtained_at": datetime.now().isoformat(),
                    "expires_at": datetime.fromtimestamp(time.time() + self.token_data.get('expires_in', 0)).isoformat()
                }
                
                with open("access_token_details.json", "w") as f:
                    json.dump(token_info, f, indent=2)
                
                self.log_message("💾 Access token saved to 'access_token.txt'")
                self.log_message("💾 Token details saved to 'access_token_details.json'")
                
                return True
            else:
                self.log_message(f"Token request failed: {response.status_code}", "ERROR")
                self.log_message(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log_message(f"Error during token request: {str(e)}", "ERROR")
            return False
    
    def analyze_access_token(self):
        """Analyze the access token structure and claims"""
        self.log_message("\n=== STEP 3: ANALYZING ACCESS TOKEN ===")
        
        if not self.access_token:
            self.log_message("No access token available", "ERROR")
            return False
        
        try:
            # Split token into parts
            parts = self.access_token.split('.')
            
            if len(parts) != 3:
                self.log_message(f"Invalid JWT format. Expected 3 parts, got {len(parts)}", "ERROR")
                return False
            
            # Decode header
            header = self._decode_base64_url(parts[0])
            self.log_message("📋 TOKEN HEADER:")
            self.log_message(json.dumps(json.loads(header), indent=2))
            
            # Decode payload
            payload = self._decode_base64_url(parts[1])
            token_claims = json.loads(payload)
            self.log_message("\n📋 TOKEN PAYLOAD:")
            self.log_message(json.dumps(token_claims, indent=2))
            
            # Analyze claims
            self._analyze_token_claims(token_claims)
            
            # Save analysis
            with open("access_token_analysis.json", "w") as f:
                json.dump(token_claims, f, indent=2)
            
            self.log_message("💾 Token analysis saved to 'access_token_analysis.json'")
            return True
            
        except Exception as e:
            self.log_message(f"Error analyzing token: {str(e)}", "ERROR")
            return False
    
    def _decode_base64_url(self, data):
        """Decode base64 URL-safe string"""
        # Add padding if needed
        missing_padding = len(data) % 4
        if missing_padding:
            data += '=' * (4 - missing_padding)
        
        # Replace URL-safe characters
        data = data.replace('-', '+').replace('_', '/')
        
        # Decode
        decoded = base64.b64decode(data)
        return decoded.decode('utf-8')
    
    def _analyze_token_claims(self, claims):
        """Analyze token claims for important information"""
        self.log_message("\n🔍 TOKEN ANALYSIS:")
        
        # Check expiration
        if 'exp' in claims:
            exp_date = datetime.fromtimestamp(claims['exp'])
            current_time = datetime.now()
            
            self.log_message(f"⏰ Expires at: {exp_date}")
            
            if current_time < exp_date:
                time_remaining = exp_date - current_time
                self.log_message(f"✅ Token is VALID (expires in {time_remaining})")
            else:
                self.log_message("❌ Token is EXPIRED")
        
        # Check scopes
        if 'scope' in claims:
            scopes = claims['scope'].split() if isinstance(claims['scope'], str) else claims['scope']
            self.log_message(f"🔐 Scopes: {', '.join(scopes)}")
        
        # Check other important claims
        important_claims = {
            'sub': '👤 Subject',
            'iss': '🏢 Issuer',
            'aud': '🎯 Audience',
            'client_id': '🔑 Client ID'
        }
        
        for claim, description in important_claims.items():
            if claim in claims:
                self.log_message(f"{description}: {claims[claim]}")
    
    def test_fhir_endpoints(self):
        """Test various FHIR endpoints"""
        self.log_message("\n=== STEP 4: TESTING FHIR ENDPOINTS ===")
        
        if not self.access_token:
            self.log_message("No access token available", "ERROR")
            return False
        
        # Test endpoints
        test_cases = [
            ("metadata", "Capability Statement"),
            ("Patient", "Patient Resources"),
            ("Practitioner", "Practitioner Resources"),
            ("Organization", "Organization Resources"),
            ("Observation", "Observation Resources")
        ]
        
        results = []
        
        for endpoint, description in test_cases:
            self.log_message(f"\n--- Testing {description} ---")
            success = self._test_single_endpoint(endpoint)
            results.append((description, success))
        
        # Summary
        self.log_message("\n📊 FHIR TEST RESULTS:")
        success_count = 0
        
        for test_name, success in results:
            status = "✅ SUCCESS" if success else "❌ FAILED"
            self.log_message(f"{test_name}: {status}")
            if success:
                success_count += 1
        
        self.log_message(f"\nOverall FHIR Tests: {success_count}/{len(results)} passed")
        
        return success_count > 0
    
    def _test_single_endpoint(self, endpoint):
        """Test a single FHIR endpoint"""
        if endpoint == "metadata":
            url = f"{IMS_BASE_URL}{IMS_FHIR_ENDPOINT}/metadata"
        else:
            url = f"{IMS_BASE_URL}{IMS_FHIR_ENDPOINT}/{endpoint}"
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/fhir+json"
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                content = response.json()
                
                if endpoint == "metadata":
                    # Save capability statement
                    with open("fhir_capability_statement.json", "w") as f:
                        json.dump(content, f, indent=2)
                    self.log_message("✅ Capability statement retrieved")
                    
                    # Show supported resources
                    if 'rest' in content and len(content['rest']) > 0:
                        resources = content['rest'][0].get('resource', [])
                        supported_resources = [r.get('type') for r in resources]
                        self.log_message(f"Supported resources: {', '.join(supported_resources[:10])}...")
                else:
                    # Save sample response
                    filename = f"sample_{endpoint.lower()}_response.json"
                    with open(filename, "w") as f:
                        json.dump(content, f, indent=2)
                    
                    resource_count = len(content.get('entry', [])) if 'entry' in content else 0
                    self.log_message(f"✅ Retrieved {resource_count} {endpoint} resources")
                
                return True
            else:
                self.log_message(f"❌ HTTP {response.status_code}: {response.text[:200]}...")
                return False
                
        except Exception as e:
            self.log_message(f"❌ Error: {str(e)}")
            return False
    
    def run_complete_integration_test(self):
        """Run the complete integration test"""
        self.log_message("🚀 STARTING COMPLETE MEDORA-IMS INTEGRATION TEST")
        self.log_message("=" * 60)
        
        # Step 1: Generate JWT assertion
        if not self.generate_jwt_assertion():
            self.log_message("❌ Failed at Step 1: JWT Assertion Generation", "ERROR")
            return False
        
        # Step 2: Get access token
        if not self.get_access_token():
            self.log_message("❌ Failed at Step 2: Access Token Request", "ERROR")
            return False
        
        # Step 3: Analyze access token
        if not self.analyze_access_token():
            self.log_message("⚠️  Step 3: Token Analysis failed, but continuing...", "WARN")
        
        # Step 4: Test FHIR endpoints
        if not self.test_fhir_endpoints():
            self.log_message("⚠️  Step 4: Some FHIR tests failed", "WARN")
        
        self.log_message("\n" + "=" * 60)
        self.log_message("🎉 INTEGRATION TEST COMPLETED!")
        self.log_message("\n📁 Files created:")
        self.log_message("  - jwt_assertion.txt")
        self.log_message("  - access_token.txt")
        self.log_message("  - access_token_details.json")
        self.log_message("  - access_token_analysis.json")
        self.log_message("  - fhir_capability_statement.json")
        self.log_message("  - sample_*_response.json (FHIR resource samples)")
        self.log_message("  - medora_ims_complete.log")
        
        return True

def main():
    """Main function with menu options"""
    integration = MedoraIMSIntegration()
    
    print("=" * 60)
    print("🏥 MEDORA-IMS INTEGRATION SUITE")
    print("=" * 60)
    print("Choose an option:")
    print("1. Run Complete Integration Test (Recommended)")
    print("2. Generate JWT Assertion Only")
    print("3. Get Access Token Only (requires existing JWT)")
    print("4. Test FHIR Endpoints Only (requires existing access token)")
    print("5. Analyze Access Token Only (requires existing access token)")
    print("0. Exit")
    
    choice = input("\nEnter your choice (0-5): ").strip()
    
    if choice == "1":
        integration.run_complete_integration_test()
    elif choice == "2":
        integration.generate_jwt_assertion()
    elif choice == "3":
        integration.generate_jwt_assertion()
        integration.get_access_token()
    elif choice == "4":
        # Load existing access token
        try:
            with open("access_token.txt", "r") as f:
                integration.access_token = f.read().strip()
            integration.test_fhir_endpoints()
        except FileNotFoundError:
            print("❌ No access token found. Run option 1 or 3 first.")
    elif choice == "5":
        # Load existing access token
        try:
            with open("access_token.txt", "r") as f:
                integration.access_token = f.read().strip()
            integration.analyze_access_token()
        except FileNotFoundError:
            print("❌ No access token found. Run option 1 or 3 first.")
    elif choice == "0":
        print("👋 Goodbye!")
    else:
        print("❌ Invalid choice. Please try again.")

if __name__ == "__main__":
    main()
