const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Define a schema for transcripts
const transcriptSchema = new mongoose.Schema({
    tenantId: String,
    transcript: String,
    soapNotes: {
        subjective: Object,
        objective: Object,
        assessment: Object,
        plan: Object
    },
    createdAt: { type: Date, default: Date.now }
});

const Transcript = mongoose.model('Transcript', transcriptSchema);

// Use Helmet for security headers with custom CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "https://cdnjs.cloudflare.com",
                "https://cdn.jsdelivr.net",
                "'unsafe-eval'" // Required for MediaPipe WebAssembly
            ],
            styleSrc: [
                "'self'",
                "https://fonts.googleapis.com",
                "'unsafe-inline'" // Allow inline styles in index.html
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'", "http://localhost:5000"], // Allow connections to Flask backend
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    }
}));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON bodies
app.use(express.json());

// Route for the root URL to serve login.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route for /index.html to serve index.html
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to save and analyze transcripts (no JWT authentication)
app.post('/analyze', async (req, res) => {
    try {
        const tenantId = req.body.tenant_id || 'default_tenant'; // Use tenant_id from request body
        const response = await fetch(`${process.env.FLASK_BACKEND_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...req.body, tenant_id: tenantId })
        });
        const data = await response.json();

        // Save the transcript to MongoDB
        const transcript = new Transcript({
            tenantId,
            transcript: req.body.text,
            soapNotes: {
                subjective: {
                    chief_complaint: data.patient_history?.chief_complaint,
                    history_of_present_illness: data.patient_history?.history_of_present_illness,
                    past_medical_history: data.patient_history?.past_medical_history,
                    allergies: data.patient_history?.allergies
                },
                objective: {
                    physical_examination: data.physical_examination,
                    allergy_insights: {
                        allergen_exposure: req.body.allergensDetected || 'N/A',
                        asthma_status: {
                            frequency: req.body.asthmaFrequency || 'N/A',
                            severity: req.body.asthmaSeverity || 'N/A',
                            triggers: req.body.asthmaTriggers || 'N/A'
                        },
                        immunology_profile: {
                            infections: req.body.infectionFrequency || 'N/A',
                            inflammatory_response: req.body.inflammationLevel || 'N/A'
                        }
                    }
                },
                assessment: {
                    clinical_summary: data.summary,
                    differential_diagnosis: data.differential_diagnosis
                },
                plan: {
                    plan_of_care: data.plan_of_care,
                    diagnostic_workup: data.diagnostic_workup,
                    patient_education: data.patient_education,
                    follow_up_instructions: data.follow_up_instructions,
                    recommendations: req.body.recommendations || 'N/A'
                }
            }
        });
        await transcript.save();

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Medora frontend server running at http://localhost:${port}`);
});
