#!/bin/bash
source /var/www/medora-web-backend/venv/bin/activate
exec python3 /var/www/medora-web-backend/grok_server.py
