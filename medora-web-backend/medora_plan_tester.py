#!/usr/bin/env python3
"""
Medora Enhanced Freed-Style Plan Testing Script
===============================================

This script tests the Medora system's ability to generate superior Freed-style plans
that are more thorough, personalized, and clinically sophisticated than traditional templates.

Usage: python medora_plan_tester.py
"""

import requests
import json
import time
from datetime import datetime
import sys

class MedoraPlanTester:
    def __init__(self, base_url="http://localhost:5000"):
        self.base_url = base_url
        self.test_results = []
        
    def test_enhanced_freed_plan(self, transcript, test_name, expected_conditions=None):
        """Test the enhanced Freed-style plan generation"""
        print(f"\n{'='*60}")
        print(f"TESTING: {test_name}")
        print(f"{'='*60}")
        
        # Test data
        test_data = {
            "patientId": f"test_patient_{int(time.time())}",
            "visitId": f"test_visit_{int(time.time())}",
            "transcript": transcript,
            "email": "doctor@allergyaffiliates.com",
            "tenantId": "test_tenant"
        }
        
        try:
            # Call the enhanced Freed-style endpoint
            response = requests.post(
                f"{self.base_url}/api/analyze-transcript-freed",
                json=test_data,
                headers={"Content-Type": "application/json"},
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                soap_notes = result.get("body", {}).get("soap_notes", {})
                plan = soap_notes.get("plan_of_care", "")
                
                print("✅ SUCCESS: Plan generated successfully")
                print(f"\n📋 GENERATED PLAN:")
                print("-" * 50)
                print(plan)
                print("-" * 50)
                
                # Analyze plan quality
                quality_score = self.analyze_plan_quality(plan, transcript, expected_conditions)
                
                self.test_results.append({
                    "test_name": test_name,
                    "status": "SUCCESS",
                    "quality_score": quality_score,
                    "plan_length": len(plan),
                    "conditions_identified": self.count_conditions_in_plan(plan),
                    "timestamp": datetime.now().isoformat()
                })
                
                return True, plan, quality_score
                
            else:
                print(f"❌ FAILED: HTTP {response.status_code}")
                print(f"Response: {response.text}")
                return False, None, 0
                
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            return False, None, 0
    
    def analyze_plan_quality(self, plan, transcript, expected_conditions):
        """Analyze the quality of the generated plan"""
        score = 0
        feedback = []
        
        # Check for Freed-style format
        if "In regards to" in plan:
            score += 20
            feedback.append("✅ Uses proper 'In regards to' format")
        else:
            feedback.append("❌ Missing 'In regards to' format")
        
        # Check for detailed narrative bullets
        bullet_count = plan.count("*")
        if bullet_count >= 3:
            score += 15
            feedback.append(f"✅ Good detail level ({bullet_count} bullet points)")
        else:
            feedback.append(f"⚠️ Low detail level ({bullet_count} bullet points)")
        
        # Check for personalization (no template language)
        template_phrases = [
            "standard treatment", "typical approach", "general recommendation",
            "standard protocol", "routine care", "typical medication"
        ]
        
        personalized = True
        for phrase in template_phrases:
            if phrase.lower() in plan.lower():
                personalized = False
                break
        
        if personalized:
            score += 20
            feedback.append("✅ Highly personalized, non-templated content")
        else:
            feedback.append("❌ Contains template language")
        
        # Check for specific details from transcript
        transcript_lower = transcript.lower()
        plan_lower = plan.lower()
        
        specific_details_found = 0
        
        # Look for specific medications mentioned
        medications = ["afrin", "flonase", "zyrtec", "claritin", "allegra", "nasacort"]
        for med in medications:
            if med in transcript_lower and med in plan_lower:
                specific_details_found += 1
        
        # Look for specific symptoms
        symptoms = ["nasal congestion", "itchy", "runny nose", "sneezing", "wheezing"]
        for symptom in symptoms:
            if symptom in transcript_lower and symptom in plan_lower:
                specific_details_found += 1
        
        # Look for specific history details
        history_details = ["years", "times a day", "smoking", "vaping", "cats", "pets"]
        for detail in history_details:
            if detail in transcript_lower and detail in plan_lower:
                specific_details_found += 1
        
        if specific_details_found >= 5:
            score += 25
            feedback.append(f"✅ Excellent specific detail extraction ({specific_details_found} details)")
        elif specific_details_found >= 3:
            score += 15
            feedback.append(f"✅ Good specific detail extraction ({specific_details_found} details)")
        else:
            feedback.append(f"⚠️ Low specific detail extraction ({specific_details_found} details)")
        
        # Check for clinical sophistication
        sophisticated_terms = [
            "rhinitis medicamentosa", "rebound congestion", "gradual tapering",
            "comprehensive testing", "environmental control", "allergen avoidance",
            "pulmonary function", "immunotherapy", "controller medication"
        ]
        
        sophisticated_count = sum(1 for term in sophisticated_terms if term.lower() in plan_lower)
        
        if sophisticated_count >= 3:
            score += 20
            feedback.append(f"✅ High clinical sophistication ({sophisticated_count} advanced terms)")
        elif sophisticated_count >= 1:
            score += 10
            feedback.append(f"✅ Moderate clinical sophistication ({sophisticated_count} advanced terms)")
        else:
            feedback.append("⚠️ Low clinical sophistication")
        
        print(f"\n📊 QUALITY ANALYSIS (Score: {score}/100):")
        for item in feedback:
            print(f"   {item}")
        
        return score
    
    def count_conditions_in_plan(self, plan):
        """Count the number of conditions addressed in the plan"""
        return plan.count("In regards to")
    
    def run_comprehensive_tests(self):
        """Run a comprehensive suite of tests"""
        print("🚀 Starting Medora Enhanced Freed-Style Plan Testing")
        print("=" * 60)
        
        # Test Case 1: Complex Allergy Case with Multiple Conditions
        complex_transcript = """
        Doctor: Tell me what's going on.
        Patient: I've been using Afrin nasal spray for about 6 years now, and I know it's not good. I use it 2-3 times a day, sometimes up to 4 times when it's really bad.
        Doctor: Any other medications?
        Patient: No Zyrtec, Claritin, or anything like that. Never tried Flonase.
        Doctor: Medical history?
        Patient: I smoke cigarettes, about a pack a day for 15 years, and I vape now too. I have chronic back pain so I use medical marijuana.
        Doctor: Pets?
        Patient: I have 4 cats at home, plus a bearded dragon and some fish.
        Patient: When my cats rub against my face, I get really itchy, especially around my eyes and nose. My ears itch too.
        Doctor: Any breathing problems?
        Patient: When I can't breathe through my nose and it gets really congested, my chest feels heavy and tight. Sometimes when I take deep breaths it hurts.
        Doctor: We'll do comprehensive allergy testing and check your lung function. You need to taper off the Afrin slowly to avoid rebound congestion.
        """
        
        self.test_enhanced_freed_plan(
            complex_transcript,
            "Complex Multi-Condition Allergy Case",
            expected_conditions=["Rhinitis Medicamentosa", "Allergic Rhinitis", "Possible Asthma"]
        )
        
        # Test Case 2: Pediatric Food Allergy Case
        pediatric_transcript = """
        Doctor: What brings you in today?
        Parent: My 8-year-old son has been having reactions to foods. Last week he ate peanut butter and his lips swelled up and he got hives all over.
        Doctor: How quickly did this happen?
        Parent: Within about 10 minutes of eating it. We gave him Benadryl and it helped.
        Doctor: Any other foods?
        Parent: He's always had problems with milk - gets stomach aches and diarrhea. And eggs make him throw up.
        Doctor: Environmental allergies?
        Parent: He sneezes a lot in spring and his eyes get watery. We have a dog at home and he seems fine with that.
        Doctor: Any asthma?
        Parent: He uses an inhaler sometimes when he's running around or when he's sick.
        Doctor: We need to do comprehensive food allergy testing and get him an EpiPen. I'll also test for environmental allergens.
        """
        
        self.test_enhanced_freed_plan(
            pediatric_transcript,
            "Pediatric Multi-Food Allergy Case",
            expected_conditions=["Food Allergies", "Allergic Rhinitis", "Asthma"]
        )
        
        # Test Case 3: Adult Onset Asthma with Occupational Triggers
        occupational_transcript = """
        Doctor: What's been going on with your breathing?
        Patient: I started a new job at a cleaning company about 6 months ago, and since then I've been having trouble breathing, especially at work.
        Doctor: What kind of symptoms?
        Patient: Wheezing, coughing, chest tightness. It's worse when I'm using the industrial cleaners and bleach.
        Doctor: Better on weekends?
        Patient: Yes, much better when I'm not at work. But even at home now I'm using my rescue inhaler 3-4 times a day.
        Doctor: Any allergies before this job?
        Patient: Never had any problems before. No food allergies, no environmental issues.
        Doctor: Family history?
        Patient: My mom has asthma and my sister has eczema.
        Doctor: We need to do occupational asthma testing, spirometry, and check for chemical sensitivities. You may need to consider job modification or change.
        """
        
        self.test_enhanced_freed_plan(
            occupational_transcript,
            "Occupational Asthma Case",
            expected_conditions=["Occupational Asthma", "Chemical Sensitization"]
        )
        
        # Test Case 4: Eczema and Food Allergy in Infant
        infant_transcript = """
        Doctor: What's concerning you about your baby?
        Parent: She's 8 months old and has terrible eczema all over her body. It's red, inflamed, and she scratches constantly.
        Doctor: When did it start?
        Parent: Around 3 months when we started introducing foods. It got much worse when we tried eggs and dairy.
        Doctor: What about her formula?
        Parent: We switched from regular formula to soy, and that helped a little, but not completely.
        Doctor: Sleep patterns?
        Parent: She wakes up multiple times at night scratching. We're all exhausted.
        Doctor: Family history?
        Parent: I have seasonal allergies and my husband has asthma.
        Doctor: Any breathing issues with baby?
        Parent: Sometimes she sounds wheezy, especially when the eczema is bad.
        Doctor: We'll test for food allergies and start a comprehensive eczema management plan with gentle skincare and possibly elimination diet.
        """
        
        self.test_enhanced_freed_plan(
            infant_transcript,
            "Infant Eczema and Food Allergy Case",
            expected_conditions=["Atopic Dermatitis", "Food Allergies", "Possible Asthma"]
        )
        
        # Print summary
        self.print_test_summary()
    
    def print_test_summary(self):
        """Print a summary of all test results"""
        print("\n" + "=" * 80)
        print("📈 TEST SUMMARY REPORT")
        print("=" * 80)
        
        if not self.test_results:
            print("❌ No tests completed successfully")
            return
        
        total_tests = len(self.test_results)
        successful_tests = len([r for r in self.test_results if r["status"] == "SUCCESS"])
        average_quality = sum(r["quality_score"] for r in self.test_results) / total_tests
        
        print(f"📊 Tests Run: {total_tests}")
        print(f"✅ Successful: {successful_tests}")
        print(f"📈 Average Quality Score: {average_quality:.1f}/100")
        
        print(f"\n📋 Individual Test Results:")
        for result in self.test_results:
            status_emoji = "✅" if result["status"] == "SUCCESS" else "❌"
            print(f"  {status_emoji} {result['test_name']}: {result['quality_score']}/100 "
                  f"({result['conditions_identified']} conditions)")
        
        # Quality assessment
        if average_quality >= 80:
            print(f"\n🎉 EXCELLENT: Plans are superior to traditional Freed-style")
        elif average_quality >= 60:
            print(f"\n✅ GOOD: Plans meet enhanced Freed-style standards")
        else:
            print(f"\n⚠️ NEEDS IMPROVEMENT: Plans require refinement")
        
        print("\n💡 RECOMMENDATIONS:")
        if average_quality < 80:
            print("  • Enhance NLP processing for better detail extraction")
            print("  • Improve personalization algorithms")
            print("  • Add more sophisticated clinical terminology")
        else:
            print("  • System is performing excellently")
            print("  • Consider adding more complex test cases")
        
        print(f"\n🕒 Testing completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

def main():
    """Main function to run the testing suite"""
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    else:
        base_url = "http://localhost:5000"
    
    print(f"🔗 Testing Medora system at: {base_url}")
    
    tester = MedoraPlanTester(base_url)
    
    try:
        tester.run_comprehensive_tests()
    except KeyboardInterrupt:
        print("\n⏹️ Testing interrupted by user")
    except Exception as e:
        print(f"\n❌ Testing failed with error: {str(e)}")

if __name__ == "__main__":
    main()
