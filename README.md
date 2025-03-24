# Medora - AI-Powered Scribe

## Overview

Medora is an AI-powered scribe application developed by **AdvanceAI.AI**, based in Bradenton, Florida, designed to assist healthcare providers, especially allergists, in managing patient consultations efficiently. By leveraging advanced speech recognition and natural language processing, Medora streamlines documentation and delivers actionable health insights, reducing administrative workload and enhancing patient care.

## Key Features for Clinicians

- **Real-Time Transcription:** Transcribes consultations in multiple languages (English, Spanish, French, Mandarin, Punjabi, Hindi), allowing clinicians to focus on patients rather than note-taking.
- **Structured Clinical Insights:** Automatically generates detailed sections including Transcript, Summary, Differential Diagnosis, Patient History, Physical Examination, Diagnostic Workup, Plan of Care, Patient Education, and Follow-up Instructions.
- **Allergy & Asthma Insights Dashboard:** Offers a professional, text-based summary tailored for allergists, featuring:
  - Specific allergen detection (e.g., "Pollen," "Peanuts") with visual symbols (e.g., 🌳 for Environmental, 🍽️ for Food).
  - Detailed asthma status (e.g., "Daily Severe," "Pollen Trigger").
  - Immunology profile (e.g., "Low (Sinus Infections)," "Elevated (Redness)").
  - Actionable recommendations (e.g., "Consider epinephrine auto-injector").
- **Dynamic Pollen Widget:** Provides real-time pollen count based on location, aiding in environmental allergy management.
- **Allergy Insights:** Delivers periodic tips to support allergy care strategies.
- **Sign Language Interpreter:** Supports communication with patients using American Sign Language (ASL) through avatar animation and hand tracking (requires Premium subscription).

## Usage for Clinicians

- **Access:** Log in with credentials provided by AdvanceAI.AI to access the dashboard. Default credentials for local testing:
  - **Email:** `doctor@allergyaffiliates`
  - **Password:** `18June2011!`
- **Transcription:** Use "Start Listening" for real-time transcription or paste a transcript and submit to generate insights instantly.
- **Review Insights:** Utilize the "Allergy & Asthma Insights" section to quickly assess allergen exposure, asthma status, immunology data, and tailored recommendations during or after consultations.
- **Additional Tools:** Monitor pollen levels and review allergy tips to enhance patient education and treatment planning.

## Local Development Setup

Follow these steps to set up and run the Medora project locally on your Mac for development purposes. The project consists of a Node.js frontend (`medora-frontend`) and a Flask backend (`medora-web-backend`).

### Prerequisites

Before setting up the project, ensure you have the following installed on your Mac:

- **Python 3.9+**: [Download and install Python](https://www.python.org/downloads/) if not already installed.
- **pip**: Python package manager (usually comes with Python).
- **Node.js and npm**: [Download and install Node.js](https://nodejs.org/) (includes npm). Recommended version: 18.x or higher.
- **Git**: For cloning the repository. [Install Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git).
- **Text Editor/IDE**: Recommended: VS Code, PyCharm, or any editor of your choice.
- **Web Browser**: For testing the frontend (e.g., Chrome, Firefox).

### Project Structure
Medora/
├── medora-frontend/        # Node.js frontend
│   ├── public/            # Static frontend files
│   │   ├── css/           # CSS styles
│   │   │   └── style.css
│   │   ├── images/        # Images (e.g., Medora logo)
│   │   │   └── Medora.png
│   │   ├── js/            # JavaScript files
│   │   │   ├── login.js
│   │   │   └── script.js
│   │   ├── index.html     # Main dashboard page
│   │   └── login.html     # Login page
│   ├── server.js          # Node.js server
│   ├── package.json       # Node.js dependencies
│   ├── .env              # Environment variables for frontend
│   └── node_modules/     # Node.js dependencies (after npm install)
├── medora-web-backend/   # Flask backend
│   ├── .ebextensions/    # Elastic Beanstalk configuration (optional for local setup)
│   │   ├── https.config
│   │   ├── options.config
│   │   ├── stop_nginx.config
│   │   └── 02_pip_install.config
│   ├── grok_server.py    # Flask backend API
│   ├── requirements.txt  # Python dependencies
│   ├── .env             # Environment variables for backend
│   └── venv/            # Python virtual environment (after setup)
├── README.md            # This file
└── .gitignore          # Git ignore file


### Setup Instructions

#### 1. Clone the Repository
Clone the repository to your local machine:

git clone https://github.com/advanceai-medora/Medora-AI.git
cd Medora-AI


#### Setup Flas Backend
cd medora-web-backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

touch .env

# Flask settings
FLASK_ENV=development
PORT=5000
LOG_LEVEL=DEBUG

# xAI API settings
XAI_API_KEY=your-xai-api-key
XAI_API_URL=https://api.x.ai/v1/chat/completions

# DeepL API settings (optional, for translation)
DEEPL_API_KEY=your-deepl-api-key
DEEPL_API_URL=https://api-free.deepl.com/v2/translate# Flask settings
FLASK_ENV=development
PORT=5000
LOG_LEVEL=DEBUG

# xAI API settings
XAI_API_KEY=your-xai-api-key
XAI_API_URL=https://api.x.ai/v1/chat/completions

# DeepL API settings (optional, for translation)
DEEPL_API_KEY=your-deepl-api-key
DEEPL_API_URL=https://api-free.deepl.com/v2/translate

python3 grok_server.py

Test the health endpoint by running:
curl http://localhost:5000/

####Setup Node.js Frontend 
cd ../medora-frontend

npm install

touch .env

PORT=8080
MONGODB_URI=mongodb://localhost:27017/medora
FLASK_BACKEND_URL=http://localhost:5000


node server.js

Open a browser and navigate to http://localhost:8080 to access the login page

##Test the Application Locally
Login: Navigate to http://localhost:8080, which will redirect to http://localhost:8080/login.html. Log in with:
Email: doctor@allergyaffiliates
Password: 18June2011!

##Issues and Bugs
Report issues via the repository’s issue tracker with details like error messages, steps to reproduce, and browser/console logs.

##License
This project is licensed under the . See the LICENSE file for details.

##Acknowledgments
Developed by AdvanceAI.AI, based in Bradenton, Florida, with cutting-edge AI technology.
Gratitude to the open-source community for tools like Node.js, Flask, and MongoDB.

##Contact
For questions or support, contact the project maintainers at support@advanceai.ai.


