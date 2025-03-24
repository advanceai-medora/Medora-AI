const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = express();
const port = 8080;

// Connect to MongoDB
mongoose.connect('mongodb://localhost/medora', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
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

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON bodies
app.use(express.json());

// Simulated tenant database (replace with a real database in production)
const tenants = {
    clinic_123: { password: 'clinic123pass' },
    clinic_456: { password: 'clinic456pass' }
};

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, 'your-secret-key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.tenantId = user.tenantId;
        next();
    });
};

// Login route to generate JWT
app.post('/login', (req, res) => {
    const { tenantId, password } = req.body;
    const tenant = tenants[tenantId];
    if (!tenant || tenant.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ tenantId }, 'your-secret-key', { expiresIn: '1h' });
    res.json({ token });
});

// Route for the root URL to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to save and analyze transcripts
app.post('/analyze', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const response = await fetch('http://localhost:5000/analyze', {
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
