import json
import base64
from datetime import datetime

def decode_jwt_token(token):
    """Decode and analyze a JWT token"""
    try:
        # Split token into parts
        parts = token.split('.')
        
        if len(parts) != 3:
            print(f"❌ Invalid JWT format. Expected 3 parts, got {len(parts)}")
            return None
            
        print(f"✅ JWT has correct structure: {len(parts)} parts")
        
        # Decode header
        header_data = decode_base64_url(parts[0])
        if header_data:
            header = json.loads(header_data)
            print("\n📋 TOKEN HEADER:")
            print(json.dumps(header, indent=2))
        
        # Decode payload
        payload_data = decode_base64_url(parts[1])
        if payload_data:
            payload = json.loads(payload_data)
            print("\n📋 TOKEN PAYLOAD:")
            print(json.dumps(payload, indent=2))
            
            # Analyze token details
            analyze_token_payload(payload)
            
            return payload
        
    except Exception as e:
        print(f"❌ Error decoding token: {str(e)}")
        return None

def decode_base64_url(data):
    """Decode base64 URL-safe string"""
    try:
        # Add padding if needed
        missing_padding = len(data) % 4
        if missing_padding:
            data += '=' * (4 - missing_padding)
        
        # Replace URL-safe characters
        data = data.replace('-', '+').replace('_', '/')
        
        # Decode
        decoded = base64.b64decode(data)
        return decoded.decode('utf-8')
    except Exception as e:
        print(f"❌ Base64 decode error: {str(e)}")
        return None

def analyze_token_payload(payload):
    """Analyze the token payload for important information"""
    print("\n🔍 TOKEN ANALYSIS:")
    
    # Check expiration
    if 'exp' in payload:
        exp_timestamp = payload['exp']
        exp_date = datetime.fromtimestamp(exp_timestamp)
        current_time = datetime.now()
        
        print(f"⏰ Expires at: {exp_date}")
        print(f"⏰ Current time: {current_time}")
        
        if current_time < exp_date:
            time_remaining = exp_date - current_time
            print(f"✅ Token is VALID (expires in {time_remaining})")
        else:
            print("❌ Token is EXPIRED")
    
    # Check issued at
    if 'iat' in payload:
        iat_timestamp = payload['iat']
        iat_date = datetime.fromtimestamp(iat_timestamp)
        print(f"📅 Issued at: {iat_date}")
    
    # Check scopes/permissions
    if 'scope' in payload:
        scopes = payload['scope'].split() if isinstance(payload['scope'], str) else payload['scope']
        print(f"🔐 Scopes: {', '.join(scopes)}")
    elif 'scp' in payload:
        print(f"🔐 Scopes: {', '.join(payload['scp'])}")
    else:
        print("⚠️  No explicit scopes found in token")
    
    # Check subject/client
    if 'sub' in payload:
        print(f"👤 Subject: {payload['sub']}")
    
    if 'client_id' in payload:
        print(f"🔑 Client ID: {payload['client_id']}")
    
    # Check audience
    if 'aud' in payload:
        print(f"🎯 Audience: {payload['aud']}")
    
    # Check issuer
    if 'iss' in payload:
        print(f"🏢 Issuer: {payload['iss']}")
    
    # Check resource access
    if 'resource_access' in payload:
        print(f"📂 Resource Access: {json.dumps(payload['resource_access'], indent=2)}")
    
    # Check realm access
    if 'realm_access' in payload:
        print(f"🏰 Realm Access: {json.dumps(payload['realm_access'], indent=2)}")
    
    # Show all other claims
    standard_claims = {'exp', 'iat', 'scope', 'scp', 'sub', 'client_id', 'aud', 'iss', 'resource_access', 'realm_access'}
    other_claims = {k: v for k, v in payload.items() if k not in standard_claims}
    
    if other_claims:
        print(f"\n📝 OTHER CLAIMS:")
        print(json.dumps(other_claims, indent=2))

def main():
    print("=== ACCESS TOKEN ANALYZER ===")
    print("This will decode your IMS access token and show what permissions you have.\n")
    
    # Get token from user
    token = input("Paste your access token here: ").strip()
    
    if not token:
        print("❌ No token provided")
        return
    
    print(f"\n🔍 Analyzing token (length: {len(token)} characters)...")
    
    # Decode and analyze
    payload = decode_jwt_token(token)
    
    if payload:
        print("\n✅ Token analysis complete!")
        print("\n💡 Key things to check:")
        print("  - Are the scopes sufficient for FHIR access?")
        print("  - Is the token expiration reasonable?")
        print("  - Does the audience match the FHIR endpoint?")
        
        # Save analysis to file
        with open("access_token_analysis.json", "w") as f:
            json.dump(payload, f, indent=2)
        print("\n💾 Full token payload saved to 'access_token_analysis.json'")
    else:
        print("❌ Failed to analyze token")

if __name__ == "__main__":
    main()
