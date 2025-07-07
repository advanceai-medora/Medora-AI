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

        // Fetch references from the backend
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`Failed to fetch references: ${response.statusText}`);
        const data = await response.json();
        console.log('References API response:', JSON.stringify(data, null, 2));

        const tableBody = document.getElementById('references-table-body');
        if (tableBody) {
            tableBody.innerHTML = ''; // Clear previous references
            if (data.insights && data.insights.length > 0) {
                // Render all insights with their full details
                data.insights.forEach((insight, index) => {
                    // Log the insight to debug field mapping
                    console.log(`Rendering insight #${index + 1}:`, JSON.stringify(insight, null, 2));
                    // Truncate summary to 100 characters for better display
                    const truncatedSummary = insight.summary && insight.summary.length > 100 
                        ? insight.summary.substring(0, 100) + '...' 
                        : insight.summary || 'N/A';
                    // Format authors (truncate if too long)
                    const formattedAuthors = insight.authors && insight.authors.length > 50 
                        ? insight.authors.substring(0, 50) + '...' 
                        : insight.authors || 'N/A';
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td><a href="${insight.url || '#'}" target="_blank">${insight.title || 'N/A'}</a></td>
                        <td>${truncatedSummary}</td>
                        <td>${insight.relevance_score || 'N/A'}</td>
                        <td>${insight.confidence || 'N/A'}</td>
                        <td>${insight.relevance_tag || 'N/A'}</td>
                        <td>${insight.source || 'N/A'}</td>
                        <td>${formattedAuthors}</td>
                        <td>${insight.year || 'N/A'}</td>
                        <td>${insight.citation_count || 'N/A'}</td>
                    `;
                    tableBody.appendChild(row);
                });
                console.log('Populated references table with data:', data.insights);
            } else {
                console.log('No insights returned from API');
                tableBody.innerHTML = '<tr><td colspan="10">No references available.</td></tr>';
            }
        } else {
            console.error('References table body not found in DOM');
        }
    } catch (error) {
        console.error('Error fetching references:', error);
        const tableBody = document.getElementById('references-table-body');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="10">Error loading references: ' + error.message + '</td></tr>';
        } else {
            console.error('References table body not found in DOM');
        }
    } finally {
        window.hideReferencesSpinner();
    }
}

// Expose the fetchReferences function to the global scope
window.fetchReferences = fetchReferences;
