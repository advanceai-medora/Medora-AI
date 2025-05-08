const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Serve JWK Set with proper headers
app.get('/.well-known/jwks.json', (req, res) => {
  try {
    const jwkSet = JSON.parse(fs.readFileSync(path.join(__dirname, '.well-known/jwks.json'), 'utf8'));
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'max-age=86400');
    res.json(jwkSet);
  } catch (error) {
    console.error('Error serving JWK Set:', error);
    res.status(500).json({ error: 'Failed to serve JWK Set' });
  }
});

app.listen(PORT, () => {
  console.log(`JWK server running on port ${PORT}`);
});
