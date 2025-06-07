#!/usr/bin/env python3
"""
SIMPLE TEST - Provider-Driven Approach
Test the simple NLP extraction that focuses on what provider says
Save this as: test_simple_provider.py
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

XAI_API_KEY = os.getenv('XAI_API_KEY')
XAI_API_URL = os.getenv('XAI_API_URL', 'https://api.x.ai/v1/chat/completions')

# Your test transcript
TEST_TRANSCRIPT = """Hello, how are you? All right, tell me, how's it going since your last visit here? My 1st visit was 2 months ago. I'm 5 days early because I dressed it up. That's okay. I'm not using the sprays right now because the allergy migraines seem to be keeping everything in check. So no Flonase or azelastine now? I take Flonase every day if I need it. And I never used it because this is more for runny nose. So you use that sometimes? Sometimes. That's what stopped it. And then I just use Flonase now. I carry this in case the Flonase doesn't take care of it. Okay. And you take an allergy pill every day? Yeah. Which one is that? Allegra. Okay. And that helps? Yeah. That seems to keep it in check. And you did the dust mite precautions at home? Yes, I did. Okay. And the grass, right? Yeah. And it was worse with eating. So you just use that ipratropium when you're eating? And it helps calm it down. And penicillin allergy, we cleared you and you did it and good, you're off the penicillin chart, huh? My primary care doctor was thrilled. Yeah, that's good. So now he can use it, right? Yeah. So did we talk about allergy shots for you or no? We did, but I can't remember with her and 3 to 5 years getting the shots, you know, I don't think it's worth it if it can be controlled with this. That's fine. If you don't want to. So you just take Allegra every day and it's fine? Yeah. I think Flonase is better if you take it every day. Instead of them? Okay. Because it's more local and it's more steroid. Allegra affects your whole body. You don't want that. Okay. So I'll switch to Flonase every day. Allegra as needed if you need it. And then the Ipratropium for runny nose if you need it. Okay. Maybe the Flonase will just do the trick. Okay. Just do that one spray twice a day or 2 sprays once a day every day. Okay. It'll keep all the inflammation down. You won't need anything else. Okay. Sounds good? Sounds great. So do that and then I'll see you in 4 months, okay? Okay."""

def test_simple_provider_extraction():
    """
    Test the simple provider statement extraction
    """
    print("🔍 Testing Simple Provider Statement Extraction...")
    
    prompt = f"""
    You are extracting what the PROVIDER/DOCTOR is saying in this conversation. Focus only on what the medical provider states, diagnoses, or plans.

    CONVERSATION: {TEST_TRANSCRIPT}

    EXTRACT PROVIDER STATEMENTS:

    1. DIAGNOSIS: What does the provider say about the patient's condition?
    2. SYMPTOMS DISCUSSED: What symptoms does the provider mention or address?
    3. CURRENT MEDICATIONS: What medications does the provider discuss with the patient?
    4. MEDICATION CHANGES: What medication changes does the provider recommend?
    5. TREATMENT PLANS: What treatments or interventions does the provider suggest?
    6. PROVIDER INSTRUCTIONS: What specific instructions does the provider give?
    7. FOLLOW-UP: What follow-up does the provider schedule or recommend?
    8. IMPORTANT UPDATES: Any test results, clearances, or status changes the provider mentions?

    RULES:
    - Only extract what the PROVIDER/DOCTOR actually says
    - Use the provider's exact words when possible
    - Don't infer or add medical knowledge
    - Focus on explicit provider statements
    - If provider doesn't mention something, mark as "Not discussed"

    OUTPUT JSON:
    {{
        "provider_diagnosis": "What provider says about diagnosis",
        "symptoms_addressed": ["List of symptoms provider discusses"],
        "current_medications": ["Medications provider mentions patient is taking"],
        "medication_changes": ["Specific changes provider recommends"],
        "treatment_recommendations": ["What provider suggests for treatment"],
        "provider_instructions": ["Specific instructions given by provider"],
        "follow_up_plan": "What provider says about next steps",
        "important_updates": ["Any significant updates provider mentions"],
        "provider_quotes": ["Key exact quotes from provider"]
    }}
    """

    headers = {
        "Authorization": f"Bearer {XAI_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "grok-2-1212",
        "messages": [
            {"role": "system", "content": "You are an expert at extracting provider statements from medical conversations. Focus only on what the provider/doctor explicitly says. Return valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 1500,
        "temperature": 0.1
    }

    try:
        response = requests.post(XAI_API_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()

        if "choices" in result and len(result["choices"]) > 0:
            response_text = result["choices"][0]["message"]["content"]
            
            # Extract JSON
            try:
                start_idx = response_text.find('{')
                end_idx = response_text.rfind('}') + 1
                if start_idx != -1 and end_idx != -1:
                    json_str = response_text[start_idx:end_idx].strip()
                    provider_data = json.loads(json_str)
                    print("✅ Provider statement extraction successful")
                    return provider_data
            except Exception as e:
                print(f"⚠️ JSON parsing error: {e}")
                return None
                
    except Exception as e:
        print(f"❌ API Error: {e}")
        return None

def test_simple_plan_creation(provider_data):
    """
    Test creating plan from provider statements
    """
    print("\n📋 Testing Simple Plan Creation...")
    
    diagnosis = provider_data.get('provider_diagnosis', 'Medical consultation')
    
    plan_prompt = f"""
    Create a clinical treatment plan based ONLY on what the provider actually said in this conversation.

    PROVIDER STATEMENTS EXTRACTED:
    - Diagnosis: {provider_data.get('provider_diagnosis', 'Not specified')}
    - Symptoms Discussed: {', '.join(provider_data.get('symptoms_addressed', ['None']))}
    - Current Medications: {', '.join(provider_data.get('current_medications', ['None']))}
    - Medication Changes: {', '.join(provider_data.get('medication_changes', ['None']))}
    - Treatment Recommendations: {', '.join(provider_data.get('treatment_recommendations', ['None']))}
    - Provider Instructions: {', '.join(provider_data.get('provider_instructions', ['None']))}
    - Follow-up: {provider_data.get('follow_up_plan', 'Not specified')}
    - Important Updates: {', '.join(provider_data.get('important_updates', ['None']))}

    CREATE SIMPLE TREATMENT PLAN:
    - Use the provider's diagnosis as the main condition
    - Include only what the provider actually discussed
    - Convert provider statements into clinical plan format
    - Don't add medical knowledge not mentioned by provider
    - Keep it straightforward and provider-driven

    Format as a clinical plan starting with: "In regards to [provider's diagnosis]:"
    """

    headers = {
        "Authorization": f"Bearer {XAI_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "grok-2-1212",
        "messages": [
            {"role": "system", "content": "Create a clinical plan based only on provider statements. Don't add medical knowledge beyond what the provider said."},
            {"role": "user", "content": plan_prompt}
        ],
        "max_tokens": 2000,
        "temperature": 0.1
    }

    try:
        response = requests.post(XAI_API_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()

        if "choices" in result and len(result["choices"]) > 0:
            plan_text = result["choices"][0]["message"]["content"]
            print("✅ Plan creation successful")
            return plan_text.strip()
        
    except Exception as e:
        print(f"❌ Plan creation error: {e}")
        return None

def run_simple_test():
    """
    Run the complete simple test
    """
    print("=" * 80)
    print("🧪 SIMPLE PROVIDER-DRIVEN APPROACH TEST")
    print("=" * 80)
    
    print(f"API Key: {'✅ Loaded' if XAI_API_KEY else '❌ Missing'}")
    
    if not XAI_API_KEY:
        print("❌ Please set XAI_API_KEY in your .env file")
        return
    
    # Test provider extraction
    provider_data = test_simple_provider_extraction()
    
    if provider_data:
        print("\n📊 EXTRACTED PROVIDER STATEMENTS:")
        print("-" * 50)
        print(f"🏥 Diagnosis: {provider_data.get('provider_diagnosis', 'None')}")
        print(f"🩺 Symptoms: {provider_data.get('symptoms_addressed', [])}")
        print(f"💊 Current Meds: {provider_data.get('current_medications', [])}")
        print(f"🔄 Med Changes: {provider_data.get('medication_changes', [])}")
        print(f"📝 Instructions: {provider_data.get('provider_instructions', [])}")
        print(f"📅 Follow-up: {provider_data.get('follow_up_plan', 'None')}")
        print(f"🎯 Important: {provider_data.get('important_updates', [])}")
        
        # Test plan creation
        plan = test_simple_plan_creation(provider_data)
        
        if plan:
            print("\n📋 GENERATED PLAN:")
            print("-" * 50)
            print(plan)
            
            print("\n✅ SIMPLE APPROACH ASSESSMENT:")
            print("-" * 50)
            
            # Check if key information was captured
            captured_items = []
            if 'penicillin' in plan.lower() and 'clear' in plan.lower():
                captured_items.append("✅ Penicillin clearance")
            if 'flonase' in plan.lower() and 'daily' in plan.lower():
                captured_items.append("✅ Flonase daily recommendation")
            if 'allegra' in plan.lower() and 'needed' in plan.lower():
                captured_items.append("✅ Allegra as needed")
            if '4 month' in plan.lower() or 'follow' in plan.lower():
                captured_items.append("✅ Follow-up planning")
            if 'ipratropium' in plan.lower():
                captured_items.append("✅ Ipratropium usage")
            
            if captured_items:
                print("🎯 CAPTURED PROVIDER STATEMENTS:")
                for item in captured_items:
                    print(f"  {item}")
            else:
                print("⚠️ May need prompt adjustment to capture more details")
            
            print(f"\n📈 SIMPLE APPROACH SCORE: {len(captured_items)}/5 key items captured")
            
            if len(captured_items) >= 3:
                print("🟢 RECOMMENDATION: Simple approach working well - good for implementation")
            elif len(captured_items) >= 1:
                print("🟡 RECOMMENDATION: Simple approach partially working - tune prompts")
            else:
                print("🔴 RECOMMENDATION: Simple approach needs adjustment")
        
        print("\n💾 FULL EXTRACTION DATA:")
        print("=" * 80)
        print(json.dumps(provider_data, indent=2))
    
    print("\n✅ Simple test completed!")

if __name__ == "__main__":
    run_simple_test()
