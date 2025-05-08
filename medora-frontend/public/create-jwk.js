const fs = require('fs');
const crypto = require('crypto');

// Read your public key
const publicKeyPem = fs.readFileSync('/var/www/medora-frontend/public/medora_public_key.pem', 'utf8');

// Function to convert public key to JWK
function pemToJwk(pem) {
  // Remove headers and line breaks
  const pemContents = pem.replace(/-----BEGIN PUBLIC KEY-----/, '')
                        .replace(/-----END PUBLIC KEY-----/, '')
                        .replace(/\n/g, '');
  
  // Import key
  const key = crypto.createPublicKey({
    key: pem,
    format: 'pem'
  });
  
  // Export as JWK
  const jwk = key.export({ format: 'jwk' });
  
  // Add required properties for SMART on FHIR
  jwk.kid = "medora-key-1";  // Key ID
  jwk.use = "sig";           // Key use - signature
  jwk.alg = "RS384";         // Algorithm - RS384
  
  return jwk;
}

// Create JWK Set
const jwk = pemToJwk(publicKeyPem);
const jwkSet = {
  keys: [jwk]
};

// Save JWK Set to file
fs.writeFileSync('/var/www/medora-frontend/public/.well-known/jwks.json', JSON.stringify(jwkSet, null, 2));
console.log('JWK Set created at: /var/www/medora-frontend/public/.well-known/jwks.json');
console.log('Key ID (kid):', jwk.kid);
