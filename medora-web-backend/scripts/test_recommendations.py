#!/usr/bin/env python3
"""
Test script for Medora backend enhanced recommendations
Run this to test the backend directly before frontend integration
"""

import requests
import json
import uuid
from datetime import datetime
import sys

# Configuration
BACKEND_URL = "https://medoramd.ai"  # Change if different
# BACKEND_URL = "http://localhost:5000"  # Uncomment for local testing

# Test data from your actual logs
TEST_TRANSCRIPT = """
Patient was hospitalized for 4 days just before Easter due to a class A virus and pneumonia. During the hospital stay, they received a shot which helped improve their condition. A pulmonary lung doctor treated them for pneumonia. Since discharge, the patient has been using a breathing machine for a few days post-hospitalization and reports feeling better. They continue to experience a sensation of mucus dripping down the back of their throat, leading to coughing and expectoration of thick mucus.

The patient has been on Medrol 4 mg daily, Dulera twice daily, Spiriva daily, and Flonase as needed. They also use an antihistamine and a breathing machine post-hospitalization. FEV1 today is 61%, indicating severe obstruction, similar to the last visit at 60%. 

Patient reports symptoms suggestive of acid reflux, including a sensation of water dripping down the throat and persistent cough, which could be contributing to asthma symptoms. Plan to consider biologic injections for asthma and to try Pepcid twice daily for acid reflux. Additional lifestyle modifications recommended include sleeping with the head elevated, eating 2-3 hours before bed, and reducing intake of coffee, tea, alcohol, spicy, and fatty foods.

Patient education on the benefits of biologic therapy, including reduced need for oral steroids and improved quality of life, is crucial; follow-up in 2 weeks to discuss further and initiate paperwork if patient agrees.
"""

def test_analyze_transcript_endpoint():
    """Test the main analyze transcript endpoint"""
    print("🧪 Testing /api/analyze-transcript endpoint...")
    
    # Generate test IDs
    patient_id = str(uuid.uuid4())
    visit_id = str(uuid.uuid4())
    
    test_data = {
        "patientId": patient_id,
        "visitId": visit_id,
        "transcript": TEST_TRANSCRIPT,
        "email": "doctor@allergyaffiliates.com",
        "tenantId": "doctor@allergyaffiliates.com"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/analyze-transcript",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=120  # Long timeout for AI processing
        )
        
        print(f"📡 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            analyze_response(result, "analyze-transcript")
            return result
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except requests.exceptions.Timeout:
        print("⏰ Request timed out - AI processing may be taking longer than expected")
        return None
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return None

def test_structured_recommendations_endpoint():
    """Test the structured recommendations test endpoint if it exists"""
    print("\n🧪 Testing /api/test-structured-recommendations endpoint...")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/test-structured-recommendations",
            json={"test": True},
            headers={"Content-Type": "application/json"},
            timeout=120
        )
        
        print(f"📡 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            analyze_test_response(result)
            return result
        elif response.status_code == 404:
            print("ℹ️  Test endpoint not found - this is optional")
            return None
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return None

def analyze_response(result, endpoint_name):
    """Analyze the response from the transcript analysis"""
    print(f"\n📊 Analyzing response from {endpoint_name}:")
    
    # Check overall structure
    if "body" in result and "soap_notes" in result["body"]:
        soap_notes = result["body"]["soap_notes"]
    elif "soap_notes" in result:
        soap_notes = result["soap_notes"]
    else:
        print("❌ No soap_notes found in response")
        return
    
    print(f"✅ SOAP notes found")
    print(f"📋 SOAP sections: {list(soap_notes.keys())}")
    
    # Check enhanced recommendations specifically
    enhanced_recs = soap_notes.get("enhanced_recommendations")
    
    print(f"\n🎯 Enhanced Recommendations Analysis:")
    print(f"Type: {type(enhanced_recs)}")
    
    if isinstance(enhanced_recs, str):
        print(f"❌ ERROR: Enhanced recommendations is a STRING (old behavior)")
        print(f"Content: {enhanced_recs}")
        print(f"🔧 This means the fix didn't work - AI returned string instead of structured object")
        
    elif isinstance(enhanced_recs, dict):
        print(f"✅ SUCCESS: Enhanced recommendations is properly STRUCTURED")
        print(f"📁 Categories found: {list(enhanced_recs.keys())}")
        
        total_recommendations = 0
        for category, items in enhanced_recs.items():
            if isinstance(items, list):
                print(f"  📂 {category}: {len(items)} recommendations")
                total_recommendations += len(items)
                # Show first recommendation as sample
                if items:
                    print(f"    📝 Sample: {items[0][:100]}...")
            else:
                print(f"  ⚠️  {category}: Not a list (type: {type(items)})")
        
        print(f"📊 Total recommendations: {total_recommendations}")
        
        # Check for expected categories
        expected_categories = [
            "MEDICATION MANAGEMENT",
            "LIFESTYLE MODIFICATIONS", 
            "MONITORING PROTOCOL",
            "EMERGENCY ACTION PLAN",
            "LONG-TERM MANAGEMENT STRATEGY"
        ]
        
        found_categories = [cat for cat in expected_categories if cat in enhanced_recs]
        print(f"🎯 Expected categories found: {len(found_categories)}/{len(expected_categories)}")
        print(f"Found: {found_categories}")
        
    else:
        print(f"❌ ERROR: Enhanced recommendations has unexpected type: {type(enhanced_recs)}")
        print(f"Content: {enhanced_recs}")
    
    # Check other SOAP sections
    print(f"\n📋 Other SOAP Sections:")
    for section in ["patient_history", "differential_diagnosis", "plan_of_care"]:
        if section in soap_notes:
            content = soap_notes[section]
            if isinstance(content, dict):
                print(f"✅ {section}: dict with keys {list(content.keys())}")
            elif isinstance(content, str):
                print(f"✅ {section}: string ({len(content)} chars)")
            else:
                print(f"⚠️  {section}: {type(content)}")
        else:
            print(f"❌ {section}: missing")

def analyze_test_response(result):
    """Analyze the test endpoint response"""
    print(f"\n📊 Test Endpoint Analysis:")
    
    if result.get("success"):
        print(f"✅ Test successful")
        print(f"🏗️  Is structured: {result.get('is_structured')}")
        print(f"📁 Categories: {result.get('categories_found')}")
        print(f"📊 Total recommendations: {result.get('total_recommendations')}")
        
        if result.get('sample_recommendations'):
            print(f"📝 Sample recommendations from {result.get('sample_category')}:")
            for i, rec in enumerate(result.get('sample_recommendations', [])[:3]):
                print(f"  {i+1}. {rec}")
    else:
        print(f"❌ Test failed: {result.get('error')}")

def main():
    print("🚀 Medora Backend Enhanced Recommendations Test")
    print("=" * 60)
    
    # Test main endpoint
    result1 = test_analyze_transcript_endpoint()
    
    # Test structured recommendations endpoint if available
    result2 = test_structured_recommendations_endpoint()
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 TEST SUMMARY:")
    
    if result1:
        soap_notes = result1.get("body", {}).get("soap_notes", result1.get("soap_notes", {}))
        enhanced_recs = soap_notes.get("enhanced_recommendations")
        
        if isinstance(enhanced_recs, dict) and len(enhanced_recs) > 0:
            print("✅ SUCCESS: Backend is generating structured recommendations!")
            print("🎯 Frontend integration should now work properly")
            
            # Save result for inspection
            with open("test_result.json", "w") as f:
                json.dump(result1, f, indent=2)
            print("💾 Full result saved to test_result.json")
            
        elif isinstance(enhanced_recs, str):
            print("❌ ISSUE: Backend still returning string recommendations")
            print("🔧 Check if the analyze_transcript function was updated correctly")
            print("🔍 Review backend logs for JSON parsing errors")
            
        else:
            print("⚠️  PARTIAL: Recommendations found but not in expected format")
    else:
        print("❌ FAILED: Could not connect to backend or endpoint error")
        print("🔍 Check backend URL and ensure server is running")
    
    if result2 and result2.get("success") and result2.get("is_structured"):
        print("✅ BONUS: Test endpoint also working correctly")

if __name__ == "__main__":
    main()
