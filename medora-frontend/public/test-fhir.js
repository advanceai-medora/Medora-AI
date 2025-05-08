const { testConnection, queryFHIR } = require('./fhir-client');

async function runTests() {
  try {
    // Test 1: Connect to FHIR server
    console.log('======= Test 1: Testing Connection =======');
    await testConnection();
    
    // Test 2: Query patients
    console.log('\n======= Test 2: Querying Patients =======');
    const patients = await queryFHIR('Patient', { _count: 5 });
    console.log(`Retrieved ${patients.total || 'unknown'} patients`);
    
    if (patients.entry && patients.entry.length > 0) {
      console.log('First patient ID:', patients.entry[0].resource.id);
    }
    
  } catch (error) {
    console.error('Tests failed:', error);
  }
}

runTests();
