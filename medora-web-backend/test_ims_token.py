import jwt
import time
import uuid
import requests
import urllib3

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# IMS configuration
IMS_TOKEN_ENDPOINT = "https://keycloak-qa.medpharmservices.com:8443/realms/fhir-0051185/protocol/openid-connect/token"
IMS_CLIENT_ID = "4ddd3a59-414c-405e-acc5-226c097a7060"
# You would need to get this from your Keycloak admin
CLIENT_SECRET = "your_client_secret_here"  

# Request access token
headers = {
    "Content-Type": "application/x-www-form-urlencoded"
}
payload = {
    "grant_type": "client_credentials",
    "client_id": IMS_CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "scope": "patient/*.write"
}
try:
    # Disable SSL verification for testing
    response = requests.post(IMS_TOKEN_ENDPOINT, headers=headers, data=payload, timeout=10, verify=False)
    response.raise_for_status()
    token_data = response.json()
    print(f"Token response: {token_data}")
except Exception as e:
    print(f"Error: {str(e)}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"Response status: {e.response.status_code}")
        print(f"Response text: {e.response.text}")
