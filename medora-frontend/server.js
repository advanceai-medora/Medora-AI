const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

// Temporarily disable MongoDB connection
/*
const mongoose = require('mongoose');
const mongoUri = 'mongodb://docdb-2025-03-26-11-39-45-5e5c1cy642.ap-south-1.docdb.amazonaws.com:27017';
mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ssl: true,
    sslCA: '/path/to/rds-combined-ca-bundle.pem',
    auth: {
        username: 'your-username',
        password: 'your-password'
    }
}).then(() => {
    console.log('Connected to DocumentDB');
}).catch(err => {
    console.error('Failed to connect to DocumentDB:', err);
});
*/

const port = 8080;
app.listen(port, () => {
    console.log(`Medora frontend server running at http://localhost:${port}`);
});
