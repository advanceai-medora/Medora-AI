import jwt
import time
import uuid
import requests
import json
from datetime import datetime

# Configuration
IMS_TOKEN_ENDPOINT = "https://keycloak-qa.medpharmservices.com:8443/realms/fhir-0051185/protocol/openid-connect/token"
IMS_CLIENT_ID = "4ddd3a59-414c-405e-acc5-226c097a7060"
PRIVATE_KEY_PATH = "/var/www/medora-frontend/public/medora_private_key.pem"

def log_message(message):
    """Log messages with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] {message}"
    print(log_entry)

def load_private_key():
    """Load the private key from file"""
    try:
        with open(PRIVATE_KEY_PATH, 'r') as f:
            return f.read()
    except Exception as e:
        log_message(f"ERROR: Failed to load private key: {str(e)}")
        return None

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
    """Request an access token and return the full response"""
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
            access_token = token_data.get('access_token')
            
            log_message(f"✅ SUCCESS: Obtained access token!")
            log_message(f"Token expires in: {token_data.get('expires_in')} seconds")
            log_message(f"Token type: {token_data.get('token_type', 'Bearer')}")
            
            # Display the actual access token
            log_message("\n🔑 ACCESS TOKEN:")
            log_message(access_token)
            
            # Save token details to file
            token_info = {
                "access_token": access_token,
                "token_type": token_data.get('token_type', 'Bearer'),
                "expires_in": token_data.get('expires_in'),
                "scope": token_data.get('scope'),
                "obtained_at": datetime.now().isoformat(),
                "expires_at": datetime.fromtimestamp(time.time() + token_data.get('expires_in', 0)).isoformat()
            }
            
            with open("access_token_details.json", "w") as f:
                json.dump(token_info, f, indent=2)
            
            log_message("💾 Token details saved to 'access_token_details.json'")
            
            # Save just the token for easy copying
            with open("access_token.txt", "w") as f:
                f.write(access_token)
            
            log_message("💾 Access token saved to 'access_token.txt' for easy copying")
            
            return access_token
        else:
            log_message(f"❌ Token request failed with status {response.status_code}")
            log_message(f"Response: {response.text}")
            return None
            
    except Exception as e:
        log_message(f"ERROR during token request: {str(e)}")
        return None

def main():
    """Get access token and display it"""
    log_message("=== MEDORA ACCESS TOKEN GENERATOR ===")
    
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
    if access_token:
        log_message("\n🎉 SUCCESS! You now have a valid access token.")
        log_message("📋 Next steps:")
        log_message("  1. Copy the access token from above")
        log_message("  2. Use it to make FHIR API calls")
        log_message("  3. Or analyze it with the token analyzer script")
        log_message("\n📁 Files created:")
        log_message("  - access_token.txt (just the token)")
        log_message("  - access_token_details.json (full token info)")
    else:
        log_message("❌ Failed to obtain access token")
    
    log_message("=== COMPLETED ===")

if __name__ == "__main__":
    main()
