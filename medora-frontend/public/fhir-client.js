const fs = require('fs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const qs = require('querystring');

// Configuration - update with values from IMS Meditab
const config = {
  clientId: 'https://test.medoramd.ai',
  tokenEndpoint: 'https://fhir-auth.meditab.com/token', // Replace with actual endpoint from Meditab
  fhirServerUrl: 'https://fhir.meditab.com/fhir/R4',    // Replace with actual FHIR server URL
  keyId: 'medora-key-1'                                 // Same as in jwks.json
};

// Load private key
const privateKeyPath = '/var/www/medora-frontend/public/medora_private_key.pem';
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

// Generate client assertion JWT for authentication
function generateClientAssertion() {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: config.clientId,         // Issuer (your client ID)
    sub: config.clientId,         // Subject (your client ID)
    aud: config.tokenEndpoint,    // Audience (token endpoint)
    exp: now + 300,               // Expiration (5 minutes)
    jti: require('crypto').randomBytes(16).toString('hex') // Unique identifier
  };
  
  const options = {
    algorithm: 'RS384',
    keyid: config.keyId
  };
  
  return jwt.sign(payload, privateKey, options);
}

// Request access token
async function getAccessToken() {
  try {
    const clientAssertion = generateClientAssertion();
    
    const tokenRequest = {
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: clientAssertion,
      scope: 'system/*.read'      // Adjust scopes based on your needs
    };
    
    console.log('Requesting token from:', config.tokenEndpoint);
    
    const response = await axios.post(config.tokenEndpoint, qs.stringify(tokenRequest), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Token received successfully');
    return response.data.access_token;
  } catch (error) {
    console.error('Token request failed:', error.response?.data || error.message);
    throw error;
  }
}

// Make FHIR API request
async function queryFHIR(resourceType, query = {}) {
  try {
    const accessToken = await getAccessToken();
    
    // Build query string
    const queryString = Object.entries(query)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    const url = `${config.fhirServerUrl}/${resourceType}${queryString ? '?' + queryString : ''}`;
    
    console.log('Querying FHIR endpoint:', url);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/fhir+json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('FHIR request failed:', error.response?.data || error.message);
    throw error;
  }
}

// Example: Test the connection by fetching server metadata
async function testConnection() {
  try {
    const metadata = await queryFHIR('metadata');
    console.log('Connection successful!');
    console.log('Server FHIR version:', metadata.fhirVersion);
    return metadata;
  } catch (error) {
    console.error('Connection test failed');
  }
}

// Export functions for use in other files
module.exports = {
  getAccessToken,
  queryFHIR,
  testConnection
};

// If running this file directly, test the connection
if (require.main === module) {
  testConnection().catch(console.error);
}
