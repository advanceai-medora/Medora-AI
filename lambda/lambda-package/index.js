const axios = require('axios');
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Initialize AWS Comprehend Medical
const comprehendMedical = new AWS.ComprehendMedical({ region: 'us-east-1' });

// NCBI API key (stored in environment variable)
const NCBI_API_KEY = process.env.NCBI_API_KEY;

// Configure axios with a longer timeout
const axiosInstance = axios.create({
    timeout: 60000 // 60 seconds timeout
});

// Retry logic for axios requests
async function fetchWithRetry(url, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await axiosInstance.get(url);
        } catch (error) {
            if (i === retries - 1) throw error;
            if (error.code === 'ECONNABORTED' || error.message.includes('socket hang up') || (error.response && error.response.status === 429)) {
                console.log(`Retrying request to ${url}, attempt ${i + 1}/${retries} after delay ${delay * Math.pow(2, i)}ms`);
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            } else {
                throw error;
            }
        }
    }
}

exports.handler = async (event) => {
    try {
        // Fetch PubMed references (reduced retmax to 50 to avoid rate limits)
        const pubmedReferences = await fetchPubMedReferences('allergy OR asthma OR immunology AND (2023[pdat] OR 2024[pdat] OR 2025[pdat])', 50);
        const clinicalTrials = await fetchClinicalTrials('cond=asthma+OR+allergy+OR+immunology', 50);

        // Combine and process references
        const references = [...pubmedReferences, ...clinicalTrials];
        const processedReferences = await Promise.all(references.map(async (ref) => {
            let summary = ref.summary || 'N/A';
            if (ref.fullText || ref.abstract) {
                const textToSummarize = ref.fullText || ref.abstract;
                summary = await extractSummary(textToSummarize);
            }
            const keywords = await extractKeywords(ref.title + ' ' + (ref.abstract || ref.fullText || ''));
            const confidence = calculateConfidence(ref);
            const relevanceTag = `Relevant to ${keywords[0] || 'allergy'}`;

            return {
                id: ref.pmid || ref.nctId || Date.now().toString(),
                title: ref.title,
                summary: summary,
                pmid: ref.pmid || ref.nctId || 'N/A',
                url: ref.url,
                keywords: keywords,
                publication_date: ref.publication_date || ref.startDate || new Date().toISOString().split('T')[0],
                confidence: confidence,
                relevance_tag: relevanceTag,
                ttl: Math.floor(Date.now() / 1000) + 86400 // 24-hour TTL
            };
        }));

        // Store in DynamoDB
        const batchPromises = [];
        for (let i = 0; i < processedReferences.length; i += 25) {
            const batch = processedReferences.slice(i, i + 25).map(ref => ({
                PutRequest: { Item: ref }
            }));
            batchPromises.push(dynamodb.batchWrite({
                RequestItems: { 'MedoraReferences': batch }
            }).promise());
        }
        await Promise.all(batchPromises);

        return {
            statusCode: 200,
            body: JSON.stringify('Data fetched and cached successfully')
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify('Error fetching data: ' + error.message)
        };
    }
};

// Fetch PubMed references
async function fetchPubMedReferences(query, size) {
    try {
        const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${size}&retmode=json&api_key=${NCBI_API_KEY}`;
        const searchResponse = await fetchWithRetry(url);
        const pmids = searchResponse.data?.esearchresult?.idlist || [];
        const references = [];
        for (const pmid of pmids) {
            const fetchSummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json&api_key=${NCBI_API_KEY}`;
            const summaryResponse = await fetchWithRetry(fetchSummaryUrl);
            const doc = summaryResponse.data.result[pmid];
            if (!doc) continue;
            const fetchAbstractUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml&rettype=abstract&api_key=${NCBI_API_KEY}`;
            const abstractResponse = await fetchWithRetry(fetchAbstractUrl);
            const abstract = parseAbstract(abstractResponse.data);
            const fullText = await fetchPMCFullText(pmid);
            references.push({
                title: doc.title || 'Untitled Article',
                abstract: abstract,
                fullText: fullText,
                pmid: pmid,
                url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
                publication_date: doc.pubdate ? doc.pubdate.split(' ')[0] : new Date().toISOString().split('T')[0]
            });
        }
        return references;
    } catch (error) {
        console.error('Error fetching PubMed references:', error.message);
        return [];
    }
}

// Parse abstract from PubMed XML response
function parseAbstract(xmlData) {
    const abstractMatch = xmlData.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/);
    return abstractMatch ? abstractMatch[1] : null;
}

// Fetch full text from PubMed Central (PMC)
async function fetchPMCFullText(pmid) {
    try {
        const pmcSearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&db=pmc&id=${pmid}&retmode=json&api_key=${NCBI_API_KEY}`;
        const pmcResponse = await fetchWithRetry(pmcSearchUrl);
        const pmcId = pmcResponse.data.linksets[0]?.links?.[0]?.id || null;
        if (!pmcId) return null;
        const pmcFetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${pmcId}&retmode=text&rettype=abstract&api_key=${NCBI_API_KEY}`;
        const pmcFetchResponse = await fetchWithRetry(pmcFetchUrl);
        return pmcFetchResponse.data;
    } catch (error) {
        console.error('Error fetching PMC full text for PMID:', pmid, error.message);
        return null;
    }
}

// Fetch clinical trials from ClinicalTrials.gov
async function fetchClinicalTrials(query, size) {
    try {
        const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=${encodeURIComponent(query)}&fields=NCTId,BriefTitle,StartDate&pageSize=${size}`;
        const response = await fetchWithRetry(url);
        const trials = response.data.studies || [];
        return trials.map(trial => ({
            title: trial.BriefTitle || 'Untitled Study',
            fullText: null,
            nctId: trial.NCTId || 'N/A',
            url: `https://clinicaltrials.gov/study/${trial.NCTId}`,
            startDate: trial.StartDate || new Date().toISOString().split('T')[0]
        }));
    } catch (error) {
        console.error('Error fetching ClinicalTrials.gov data:', error.message);
        return [];
    }
}

// Extract summary using Comprehend Medical
async function extractSummary(text) {
    try {
        const comprehendResult = await comprehendMedical.detectEntitiesV2({
            Text: text.substring(0, 10000)
        }).promise();
        const entities = comprehendResult.Entities.filter(e => e.Category === 'MEDICAL_CONDITION' || e.Category === 'TREATMENT');
        return entities.map(e => e.Text).join(' ') || 'Summary not available';
    } catch (error) {
        console.error('Error in extractSummary:', error.message);
        return 'Summary not available';
    }
}

// Extract keywords using Comprehend Medical
async function extractKeywords(text) {
    try {
        const comprehendResult = await comprehendMedical.detectEntitiesV2({
            Text: text.substring(0, 10000)
        }).promise();
        const keywords = comprehendResult.Entities
            .filter(e => e.Category === 'MEDICAL_CONDITION' || e.Type === 'DX_NAME')
            .map(e => e.Text.toLowerCase());
        return [...new Set(keywords)];
    } catch (error) {
        console.error('Error in extractKeywords:', error.message);
        return [];
    }
}

// Calculate confidence score
function calculateConfidence(ref) {
    const recencyScore = (new Date() - new Date(ref.publication_date || ref.startDate)) < 365 * 24 * 60 * 60 * 1000 ? 0.5 : 0.3;
    const sourceScore = ref.url.includes('pubmed') || ref.url.includes('clinicaltrials') ? 0.3 : 0.2;
    const relevanceScore = 0.2;
    return Math.min(recencyScore + sourceScore + relevanceScore, 1.0);
}
