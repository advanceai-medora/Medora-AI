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

## Usage for Clinicians

- **Access:** Log in with credentials provided by AdvanceAI.AI to access the dashboard.
- **Transcription:** Use "Start Listening" for real-time transcription or paste a transcript and submit to generate insights instantly.
- **Review Insights:** Utilize the "Allergy & Asthma Insights" sidebar to quickly assess allergen exposure, asthma status, immunology data, and tailored recommendations during or after consultations.
- **Additional Tools:** Monitor pollen levels and review allergy tips to enhance patient education and treatment planning.

## Local Development Setup

Follow these steps to set up and run the Medora project locally on your system for development purposes, based on the initial setup done on a Mac. This setup is pre-AWS and focuses on running the Flask backend and HTML frontend locally.

### Prerequisites

Before setting up the project, ensure you have the following installed on your local machine (tested on macOS, adaptable for Linux/Windows with adjustments):

- **Python 3.9+**: [Download and install Python](https://www.python.org/downloads/) if not already installed.
- **pip**: Python package manager (usually comes with Python).
- **Git**: For cloning the repository. [Install Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git).
- **Text Editor/IDE**: Recommended: VS Code, PyCharm, or any editor of your choice.
- **Web Browser**: For testing the frontend (e.g., Chrome, Firefox).

### Project Structure
Medora-AI/
├── grok_server.py         # Flask backend API
├── requirements.txt       # Python dependencies
├── Procfile              # Local development run configuration
├── index.html            # Dashboard frontend page
├── login.html            # Login frontend page
├── .ebextensions/        # Elastic Beanstalk configuration (optional for local setup)
│   ├── https.config
│   ├── options.config
│   ├── stop_nginx.config
│   └── 02_pip_install.config
└── README.md             # This file


### Setup Instructions

1. **Clone the Repository**
   Clone the repository to your local machine:
   ```bash
   git clone https://github.com/advanceai-medora/Medora-AI.git
   cd Medora-AI
2. pip install -r requirements.txt
3. python3 grok_server.py
   The server will run on http://0.0.0.0:5000 by default (note: port 80 is used for Elastic Beanstalk, but 5000 is suitable for local development).
   Test the health endpoint by running "curl http://localhost:5000/"
   Expected output: {"status": "healthy"}
5. Serve the Frontend Locally The frontend consists of index.html (dashboard) and login.html. Serve these files locally using a simple Python HTTP server
   _python3 -m http.server 8000__
6. Open a browser and navigate to:
http://localhost:8000/login.html to access the login page.
After logging in, it should redirect to http://localhost:8000/index.html (ensure the form action in login.html points to http://localhost:5000/login).
   

### Issues and Bugs
- Report issues via the repository’s issue tracker with details like error messages and steps to reproduce.

## License
This project is licensed under the [MIT License](LICENSE). See the `LICENSE` file for details.

## Acknowledgments
- Developed by **AdvanceAI.AI**, based in Bradenton, Florida, with cutting-edge AI technology.
- Gratitude to the open-source community for tools like http-server and Nominatim.

## Contact
For questions or support, contact the project maintainers at `support@advanceai.ai`.
