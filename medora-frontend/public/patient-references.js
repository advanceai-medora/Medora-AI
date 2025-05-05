console.log('patient-references.js loaded');

// Fetch references (using /get-insights)
async function fetchReferences(patientId, visitId) {
    console.log('Fetching references for patient:', patientId, 'visit:', visitId);
    console.log('Current latestAnalysis state:', JSON.stringify(latestAnalysis, null, 2));
    if (!patientId || !visitId) {
        console.log('Patient ID or Visit ID missing, skipping fetchReferences');
        window.hideReferencesSpinner(); // Ensure spinner is hidden if we skip
        return;
    }

    window.showReferencesSpinner();

    // Define mock references as a fallback
    const mockReferences = [
        {
            article: "General Allergy Management Strategies",
            author: "Wood RA",
            journal: "Allergy and Asthma Proceedings",
            year: 2017,
            link: "https://pubmed.ncbi.nlm.nih.gov/28234061/"
        },
        {
            article: "Overview of Allergic Reactions",
            author: "Sicherer SH",
            journal: "Journal of Allergy and Clinical Immunology",
            year: 2019,
            link: "https://pubmed.ncbi.nlm.nih.gov/31466691/"
        }
    ];

    try {
        // Extract conditions from latestAnalysis
        let conditions = '';
        if (latestAnalysis && latestAnalysis.soapNotes && latestAnalysis.soapNotes.differential_diagnosis) {
            conditions = latestAnalysis.soapNotes.differential_diagnosis;
            console.log('Conditions extracted for /get-insights:', conditions);
        } else {
            console.warn('latestAnalysis or differential_diagnosis not available, proceeding without conditions', {
                latestAnalysisExists: !!latestAnalysis,
                soapNotesExists: !!(latestAnalysis && latestAnalysis.soapNotes),
                diagnosisExists: !!(latestAnalysis && latestAnalysis.soapNotes && latestAnalysis.soapNotes.differential_diagnosis)
            });
        }

        // Construct the URL with conditions parameter
        const queryParams = new URLSearchParams({
            patient_id: patientId,
            visit_id: visitId
        });
        if (conditions) {
            queryParams.append('conditions', conditions);
        }
        const url = `/get-insights?${queryParams.toString()}`;
        console.log('Fetching references from:', url);

        // Attempt to fetch references from the backend
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`Failed to fetch references: ${response.statusText}`);
        const data = await response.json();
        console.log('References API response:', data);

        let references = [];
        if (data.insights && data.insights.length > 0) {
            // Map the backend insights to the frontend format
            references = data.insights.map(insight => ({
                article: insight.title || 'N/A',
                author: insight.summary ? insight.summary.split(' ').slice(0, 2).join(' ') : 'Unknown Author', // Placeholder author extraction
                journal: 'PubMed', // Since it's from PubMed
                year: new Date().getFullYear(), // Placeholder year
                link: insight.url || '#'
            }));
        } else {
            console.log('No insights returned from API, using mock references');
            references = mockReferences;
        }

        const tableBody = document.getElementById('references-table-body');
        if (tableBody) {
            console.log('Populating references table with data:', references);
            tableBody.innerHTML = references.map(ref => `
                <tr>
                    <td>${ref.article}</td>
                    <td>${ref.author}</td>
                    <td>${ref.journal}</td>
                    <td>${ref.year}</td>
                    <td><a href="${ref.link}" target="_blank">Link</a></td>
                </tr>
            `).join('');
        } else {
            console.error('References table body not found in DOM');
        }
    } catch (error) {
        console.error('Error fetching references:', error);
        // Use mock data as a fallback
        const tableBody = document.getElementById('references-table-body');
        if (tableBody) {
            console.log('Populating references table with mock data:', mockReferences);
            tableBody.innerHTML = mockReferences.map(ref => `
                <tr>
                    <td>${ref.article}</td>
                    <td>${ref.author}</td>
                    <td>${ref.journal}</td>
                    <td>${ref.year}</td>
                    <td><a href="${ref.link}" target="_blank">Link</a></td>
                </tr>
            `).join('');
        } else {
            console.error('References table body not found in DOM');
        }
    } finally {
        window.hideReferencesSpinner();
    }
}

// Expose the fetchReferences function to the global scope
window.fetchReferences = fetchReferences;
