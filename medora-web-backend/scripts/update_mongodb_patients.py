#!/usr/bin/env python3
"""
Simple script to update all MongoDB records with a specific tenant ID.
This is a one-time script to fix existing data.
"""
from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection settings
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/medora')
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'medora')

# Target tenant ID
TARGET_TENANT = "doctor@allergyaffiliates.com"
SOURCE_TENANT = "default_tenant"

# Connect to MongoDB
print(f"Connecting to MongoDB at {MONGO_URI}...")
client = MongoClient(
    MONGO_URI,
    tls=True,
    tlsCAFile='/var/www/medora-web-backend/global-bundle.pem'
)
db = client[MONGO_DB_NAME]

# Get collections
patients_collection = db['patients']
transcripts_collection = db['transcripts']
visits_collection = db['visits']

# Count records before update
patients_before = patients_collection.count_documents({"tenantId": SOURCE_TENANT})
transcripts_before = transcripts_collection.count_documents({"tenantId": SOURCE_TENANT})
visits_before = visits_collection.count_documents({"tenantId": SOURCE_TENANT})

print(f"Found records with tenant '{SOURCE_TENANT}':")
print(f"- Patients: {patients_before}")
print(f"- Transcripts: {transcripts_before}")
print(f"- Visits: {visits_before}")

# Confirm before proceeding
confirm = input(f"\nAre you sure you want to update all these records to tenant '{TARGET_TENANT}'? (yes/no): ")
if confirm.lower() != 'yes':
    print("Operation cancelled.")
    exit()

# Update patients
print(f"\nUpdating patients...")
patients_result = patients_collection.update_many(
    {"tenantId": SOURCE_TENANT},
    {"$set": {"tenantId": TARGET_TENANT}}
)
print(f"Updated {patients_result.modified_count} patients.")

# Update transcripts
print(f"Updating transcripts...")
transcripts_result = transcripts_collection.update_many(
    {"tenantId": SOURCE_TENANT},
    {"$set": {"tenantId": TARGET_TENANT}}
)
print(f"Updated {transcripts_result.modified_count} transcripts.")

# Update visits
print(f"Updating visits...")
visits_result = visits_collection.update_many(
    {"tenantId": SOURCE_TENANT},
    {"$set": {"tenantId": TARGET_TENANT}}
)
print(f"Updated {visits_result.modified_count} visits.")

# Verify updates
patients_after = patients_collection.count_documents({"tenantId": TARGET_TENANT})
transcripts_after = transcripts_collection.count_documents({"tenantId": TARGET_TENANT})
visits_after = visits_collection.count_documents({"tenantId": TARGET_TENANT})

print("\nUpdated record counts:")
print(f"- Patients with tenant '{TARGET_TENANT}': {patients_after}")
print(f"- Transcripts with tenant '{TARGET_TENANT}': {transcripts_after}")
print(f"- Visits with tenant '{TARGET_TENANT}': {visits_after}")

print("\nUpdate completed!")
