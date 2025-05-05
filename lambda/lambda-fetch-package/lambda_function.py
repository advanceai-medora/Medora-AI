import boto3
import logging
import requests
import json
from datetime import datetime, timedelta
import time
from xml.etree import ElementTree as ET
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.client('dynamodb', region_name='ap-south-1')

def fetch_existing_ids():
    try:
        response = dynamodb.scan(
            TableName='MedoraReferences',
            ProjectionExpression='id'
        )
        return set(item['id']['S'] for item in response.get('Items', []) if 'id' in item)
    except Exception as e:
        logger.error(f"Error fetching existing IDs: {str(e)}")
        return set()

def fetch_pubmed_articles():
    try:
        existing_ids = fetch_existing_ids()

        # PubMed API endpoint
        base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
        search_url = f"{base_url}/esearch.fcgi"
        fetch_url = f"{base_url}/efetch.fcgi"
        
        # Search for allergy- and asthma-related articles (no date restriction)
        search_params = {
            "db": "pubmed",
            "term": "(allergy AND asthma)",
            "retmax": 10,
            "retmode": "json",
            "sort": "pub_date"
        }
        search_response = requests.get(search_url, params=search_params)
        search_response.raise_for_status()
        search_data = search_response.json()
        
        pmids = search_data["esearchresult"]["idlist"]
        if not pmids:
            logger.info("No new PubMed articles found for allergy and asthma")
            return []
        
        # Filter out existing PMIDs
        pmids = [pmid for pmid in pmids if f"pubmed_{pmid}" not in existing_ids]
        if not pmids:
            logger.info("All fetched PMIDs already exist in MedoraReferences")
            return []
        
        # Fetch article details
        fetch_params = {
            "db": "pubmed",
            "id": ",".join(pmids),
            "retmode": "xml"
        }
        fetch_response = requests.get(fetch_url, params=fetch_params)
        fetch_response.raise_for_status()
        
        # Parse XML
        root = ET.fromstring(fetch_response.content)
        articles = []
        
        for article in root.findall(".//PubmedArticle"):
            pmid = article.find(".//PMID").text
            title = article.find(".//ArticleTitle").text if article.find(".//ArticleTitle") is not None else "N/A"
            abstract_elem = article.find(".//Abstract/AbstractText")
            abstract = abstract_elem.text if abstract_elem is not None and abstract_elem.text else "N/A"
            pub_year = article.find(".//PubDate/Year")
            pub_date = pub_year.text if pub_year is not None else "N/A"
            
            # Skip articles without abstracts or titles
            if abstract == "N/A" or title == "N/A":
                logger.info(f"Skipping PubMed article PMID {pmid}: Missing title or abstract")
                continue
            
            # Ensure the article is related to allergy or asthma
            text_to_search = (title + " " + abstract).lower()
            allergy_terms = [
                "allergy", "allergic", "anaphylaxis", "anaphylactic", "hives", "urticaria",
                "asthma", "asthmatic", "rhinitis", "eosinophil", "pollinosis", "atopic",
                "eczema", "immunotherapy", "sensitization", "ige", "wasp sting", "food allergy",
                "shellfish", "allergen", "hypersensitivity", "bronchitis", "drug allergy",
                "mold allergy", "allergic conjunctivitis"
            ]
            keywords = ",".join([term for term in allergy_terms if term in text_to_search])
            if not keywords:
                logger.info(f"Skipping PubMed article PMID {pmid}: No allergy-related keywords found")
                continue
            
            articles.append({
                "id": f"pubmed_{pmid}",
                "pubmed_id": pmid,
                "title": title,
                "summary": abstract,
                "keywords": keywords,
                "publication_date": pub_date,
                "relevance_tag": f"Relevant to {keywords.split(',')[0] if keywords else 'allergy'}",
                "confidence": "Recommended",
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
            })
        
        return articles
    except Exception as e:
        logger.error(f"Error fetching PubMed articles: {str(e)}")
        return []

def fetch_clinical_trials():
    try:
        existing_ids = fetch_existing_ids()

        base_url = "https://clinicaltrials.gov/api/v2/studies"
        params = {
            "query.cond": "Allergy OR Asthma OR Anaphylaxis OR Hives OR Urticaria OR Eczema OR Rhinitis OR Food Allergy OR Drug Allergy OR Mold Allergy",
            "filter.overallStatus": "RECRUITING,ACTIVE_NOT_RECRUITING,COMPLETED",
            "fields": "NCTId,BriefTitle,BriefSummary,Condition,InterventionName,LastUpdatePostDate",
            "pageSize": 20
        }

        response = requests.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()

        trials = data.get("studies", [])
        if not trials:
            logger.info("No new ClinicalTrials.gov trials found for allergy-related terms")
            return []

        articles = []
        for trial in trials:
            nct_id = trial.get("protocolSection", {}).get("identificationModule", {}).get("nctId", "N/A")
            if f"clinicaltrials_{nct_id}" in existing_ids:
                logger.info(f"Skipping existing trial: NCT {nct_id}")
                continue

            title = trial.get("protocolSection", {}).get("identificationModule", {}).get("briefTitle", "N/A")
            summary = trial.get("protocolSection", {}).get("descriptionModule", {}).get("briefSummary", "N/A")
            conditions = trial.get("protocolSection", {}).get("conditionsModule", {}).get("conditions", [])
            interventions = trial.get("protocolSection", {}).get("armsInterventionsModule", {}).get("interventions", [])
            last_updated = trial.get("protocolSection", {}).get("statusModule", {}).get("lastUpdatePostDateStruct", {}).get("date", "N/A")

            # Log trial details for debugging
            logger.info(f"Processing trial NCT {nct_id}: Title={title}, LastUpdated={last_updated}, Conditions={conditions}")

            if summary == "N/A" or title == "N/A":
                logger.info(f"Skipping trial NCT {nct_id}: Missing title or summary")
                continue

            # Check for allergy relevance in title, summary, or conditions
            text_to_search = (title + " " + summary + " " + " ".join(conditions)).lower()
            allergy_terms = [
                "allergy", "allergic", "anaphylaxis", "anaphylactic", "hives", "urticaria",
                "asthma", "asthmatic", "rhinitis", "eosinophil", "pollinosis", "atopic",
                "eczema", "immunotherapy", "sensitization", "ige", "wasp sting", "food allergy",
                "shellfish", "allergen", "hypersensitivity", "bronchitis", "drug allergy",
                "mold allergy", "allergic conjunctivitis"
            ]
            keywords = ",".join([term for term in allergy_terms if term in text_to_search])
            if not keywords:
                logger.info(f"Skipping trial NCT {nct_id}: No allergy-related keywords found")
                continue

            articles.append({
                "id": f"clinicaltrials_{nct_id}",
                "pubmed_id": nct_id,
                "title": title,
                "summary": summary,
                "keywords": keywords,
                "publication_date": last_updated.split('-')[0],
                "relevance_tag": f"Relevant to {keywords.split(',')[0]}",
                "confidence": "Recommended",
                "url": f"https://clinicaltrials.gov/study/{nct_id}"
            })

        return articles
    except Exception as e:
        logger.error(f"Error fetching ClinicalTrials.gov trials: {str(e)}")
        return []

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type(requests.exceptions.RequestException)
)
def fetch_nih_reporter():
    try:
        existing_ids = fetch_existing_ids()

        base_url = "https://api.reporter.nih.gov/v2/projects/search"
        params = {
            "query": "allergy OR asthma",
            "limit": 10
        }
        response = requests.post(base_url, json=params)
        response.raise_for_status()
        data = response.json()

        projects = data.get("results", [])
        if not projects:
            logger.info("No new NIH REPORTER projects found for allergy-related terms")
            return []

        articles = []
        for project in projects:
            project_id = project.get("project_number", "N/A")
            if f"nihreporter_{project_id}" in existing_ids:
                logger.info(f"Skipping existing NIH project: {project_id}")
                continue

            title = project.get("title", "N/A")
            abstract = project.get("abstract", "N/A")
            fiscal_year = str(project.get("fiscal_year", "N/A"))

            if abstract == "N/A" or title == "N/A":
                logger.info(f"Skipping NIH project {project_id}: Missing title or abstract")
                continue

            text_to_search = (title + " " + abstract).lower()
            allergy_terms = [
                "allergy", "allergic", "anaphylaxis", "anaphylactic", "hives", "urticaria",
                "asthma", "asthmatic", "rhinitis", "eosinophil", "pollinosis", "atopic",
                "eczema", "immunotherapy", "sensitization", "ige", "wasp sting", "food allergy",
                "shellfish", "allergen", "hypersensitivity", "bronchitis", "drug allergy",
                "mold allergy", "allergic conjunctivitis"
            ]
            keywords = ",".join([term for term in allergy_terms if term in text_to_search])
            if not keywords:
                logger.info(f"Skipping NIH project {project_id}: No allergy-related keywords found")
                continue

            articles.append({
                "id": f"nihreporter_{project_id}",
                "pubmed_id": project_id,
                "title": title,
                "summary": abstract,
                "keywords": keywords,
                "publication_date": fiscal_year,
                "relevance_tag": f"Relevant to {keywords.split(',')[0]}",
                "confidence": "Recommended",
                "url": f"https://reporter.nih.gov/project-details/{project_id}"
            })

        return articles
    except Exception as e:
        logger.error(f"Error fetching NIH REPORTER projects: {str(e)}")
        return []

def fetch_openalex():
    try:
        existing_ids = fetch_existing_ids()

        base_url = "https://api.openalex.org/works"
        params = {
            "filter": "title.search:allergy asthma",
            "per-page": 10
        }
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()

        works = data.get("results", [])
        if not works:
            logger.info("No new OpenAlex works found for allergy-related terms")
            return []

        articles = []
        for work in works:
            work_id = work.get("id", "N/A").split("/")[-1]
            if f"openalex_{work_id}" in existing_ids:
                logger.info(f"Skipping existing OpenAlex work: {work_id}")
                continue

            title = work.get("title", "N/A")
            abstract = work.get("abstract", "Abstract not available")
            pub_year = str(work.get("publication_year", "N/A"))

            if title == "N/A":
                logger.info(f"Skipping OpenAlex work {work_id}: Missing title")
                continue

            text_to_search = (title + " " + abstract).lower()
            allergy_terms = [
                "allergy", "allergic", "anaphylaxis", "anaphylactic", "hives", "urticaria",
                "asthma", "asthmatic", "rhinitis", "eosinophil", "pollinosis", "atopic",
                "eczema", "immunotherapy", "sensitization", "ige", "wasp sting", "food allergy",
                "shellfish", "allergen", "hypersensitivity", "bronchitis", "drug allergy",
                "mold allergy", "allergic conjunctivitis"
            ]
            keywords = ",".join([term for term in allergy_terms if term in text_to_search])
            if not keywords:
                logger.info(f"Skipping OpenAlex work {work_id}: No allergy-related keywords found")
                continue

            articles.append({
                "id": f"openalex_{work_id}",
                "pubmed_id": work_id,
                "title": title,
                "summary": abstract,
                "keywords": keywords,
                "publication_date": pub_year,
                "relevance_tag": f"Relevant to {keywords.split(',')[0]}",
                "confidence": "Recommended",
                "url": work.get("doi", f"https://openalex.org/works/{work_id}")
            })

        return articles
    except Exception as e:
        logger.error(f"Error fetching OpenAlex works: {str(e)}")
        return []

def fetch_europe_pmc():
    try:
        existing_ids = fetch_existing_ids()

        base_url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
        params = {
            "query": "allergy asthma",
            "resultType": "core",
            "pageSize": 20,
            "format": "json"
        }
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()

        results = data.get("resultList", {}).get("result", [])
        if not results:
            logger.info("No new Europe PMC articles found for allergy-related terms")
            return []

        articles = []
        for result in results:
            pmc_id = result.get("id", "N/A")
            if f"europepmc_{pmc_id}" in existing_ids:
                logger.info(f"Skipping existing Europe PMC article: {pmc_id}")
                continue

            title = result.get("title", "N/A")
            abstract = result.get("abstractText", "N/A")
            pub_year = str(result.get("pubYear", "N/A"))

            if abstract == "N/A" or title == "N/A":
                logger.info(f"Skipping Europe PMC article {pmc_id}: Missing title or abstract")
                continue

            text_to_search = (title + " " + abstract).lower()
            allergy_terms = [
                "allergy", "allergic", "anaphylaxis", "anaphylactic", "hives", "urticaria",
                "asthma", "asthmatic", "rhinitis", "eosinophil", "pollinosis", "atopic",
                "eczema", "immunotherapy", "sensitization", "ige", "wasp sting", "food allergy",
                "shellfish", "allergen", "hypersensitivity", "bronchitis", "drug allergy",
                "mold allergy", "allergic conjunctivitis"
            ]
            keywords = ",".join([term for term in allergy_terms if term in text_to_search])
            if not keywords:
                logger.info(f"Skipping Europe PMC article {pmc_id}: No allergy-related keywords found")
                continue

            articles.append({
                "id": f"europepmc_{pmc_id}",
                "pubmed_id": pmc_id,
                "title": title,
                "summary": abstract,
                "keywords": keywords,
                "publication_date": pub_year,
                "relevance_tag": f"Relevant to {keywords.split(',')[0]}",
                "confidence": "Recommended",
                "url": result.get("doi", f"https://europepmc.org/article/{pmc_id}")
            })

        return articles
    except Exception as e:
        logger.error(f"Error fetching Europe PMC articles: {str(e)}")
        return []

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type(requests.exceptions.RequestException)
)
def fetch_medrxiv():
    try:
        existing_ids = fetch_existing_ids()

        base_url = "https://api.biorxiv.org/details/medrxiv"
        params = {
            "q": "allergy asthma",
            "interval": "all",
            "limit": 10
        }
        response = requests.get(f"{base_url}/0/10", params=params)
        response.raise_for_status()
        data = response.json()

        papers = data.get("collection", [])
        if not papers:
            logger.info("No new MedRxiv/BioRxiv papers found for allergy-related terms")
            return []

        articles = []
        for paper in papers:
            paper_id = paper.get("doi", "N/A").replace("/", "_")
            if f"medrxiv_{paper_id}" in existing_ids:
                logger.info(f"Skipping existing MedRxiv paper: {paper_id}")
                continue

            title = paper.get("title", "N/A")
            abstract = paper.get("abstract", "N/A")
            pub_year = paper.get("date", "N/A").split('-')[0]

            if abstract == "N/A" or title == "N/A":
                logger.info(f"Skipping MedRxiv paper {paper_id}: Missing title or abstract")
                continue

            text_to_search = (title + " " + abstract).lower()
            allergy_terms = [
                "allergy", "allergic", "anaphylaxis", "anaphylactic", "hives", "urticaria",
                "asthma", "asthmatic", "rhinitis", "eosinophil", "pollinosis", "atopic",
                "eczema", "immunotherapy", "sensitization", "ige", "wasp sting", "food allergy",
                "shellfish", "allergen", "hypersensitivity", "bronchitis", "drug allergy",
                "mold allergy", "allergic conjunctivitis"
            ]
            keywords = ",".join([term for term in allergy_terms if term in text_to_search])
            if not keywords:
                logger.info(f"Skipping MedRxiv paper {paper_id}: No allergy-related keywords found")
                continue

            articles.append({
                "id": f"medrxiv_{paper_id}",
                "pubmed_id": paper_id,
                "title": title,
                "summary": abstract,
                "keywords": keywords,
                "publication_date": pub_year,
                "relevance_tag": f"Relevant to {keywords.split(',')[0]}",
                "confidence": "Recommended",
                "url": f"https://www.medrxiv.org/content/{paper_id}"
            })

        return articles
    except Exception as e:
        logger.error(f"Error fetching MedRxiv/BioRxiv papers: {str(e)}")
        return []

def clean_table():
    try:
        logger.info("Starting cleanup of MedoraReferences table")
        response = dynamodb.scan(TableName='MedoraReferences')
        items = response.get('Items', [])
        logger.info(f"Found {len(items)} items in MedoraReferences for cleanup")

        allergy_terms = [
            'allergy', 'allergic', 'anaphylaxis', 'anaphylactic', 'hives', 'urticaria',
            'asthma', 'asthmatic', 'rhinitis', 'eosinophil', 'pollinosis', 'atopic',
            'eczema', 'immunotherapy', 'sensitization', 'ige', 'wasp sting', 'food allergy',
            'shellfish', 'allergen', 'hypersensitivity', 'bronchitis', 'drug allergy',
            'mold allergy', 'allergic conjunctivitis'
        ]

        seen_ids = set()
        for item in items:
            try:
                # Check for duplicates
                item_id = item['id']['S']
                if item_id in seen_ids:
                    dynamodb.delete_item(
                        TableName='MedoraReferences',
                        Key={'id': item['id']}
                    )
                    logger.info(f"Deleted duplicate entry: {item_id}")
                    continue
                seen_ids.add(item_id)

                # Check for missing fields
                if 'title' not in item or 'summary' not in item or 'keywords' not in item:
                    dynamodb.delete_item(
                        TableName='MedoraReferences',
                        Key={'id': item['id']}
                    )
                    logger.info(f"Deleted incomplete entry: {item_id}")
                    continue

                # Check for empty summary
                summary = item['summary'].get('S', '').lower()
                if summary in ["n/a", "summary not available", ""]:
                    dynamodb.delete_item(
                        TableName='MedoraReferences',
                        Key={'id': item['id']}
                    )
                    logger.info(f"Deleted entry with missing summary: {item_id}")
                    continue

                # Check for empty keywords
                if 'L' in item['keywords'] and not item['keywords']['L']:
                    dynamodb.delete_item(
                        TableName='MedoraReferences',
                        Key={'id': item['id']}
                    )
                    logger.info(f"Deleted entry with empty keywords: {item_id}")
                    continue

                # Standardize keywords
                if 'L' in item['keywords']:
                    new_keywords = ",".join(kw['S'] for kw in item['keywords']['L'])
                    dynamodb.update_item(
                        TableName='MedoraReferences',
                        Key={'id': item['id']},
                        UpdateExpression="SET keywords = :k",
                        ExpressionAttributeValues={":k": {"S": new_keywords}}
                    )
                    logger.info(f"Updated keywords for entry: {item_id}")
                    keywords = new_keywords.lower()
                else:
                    keywords = item['keywords']['S'].lower()

                title = item['title'].get('S', '').lower()
                relevance_tag = item.get('relevance_tag', {}).get('S', '').lower()

                # Check if the entry is allergy-related (title, summary, or keywords must contain an allergy term)
                text_to_search = title + " " + summary + " " + keywords
                is_allergy_related = any(term in text_to_search for term in allergy_terms)
                if not is_allergy_related:
                    dynamodb.delete_item(
                        TableName='MedoraReferences',
                        Key={'id': item['id']}
                    )
                    logger.info(f"Deleted non-allergy entry: {item_id}")
                    continue

            except Exception as e:
                logger.error(f"Error processing item {item.get('id', {}).get('S', 'unknown')}: {str(e)}")
                continue

    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")
        raise e

def lambda_handler(event, context):
    logger.info("Starting MedoraDataAndTrialsFetcher Lambda execution")
    try:
        # Fetch from PubMed
        pubmed_articles = fetch_pubmed_articles()
        for article in pubmed_articles:
            item = {
                "id": {"S": article["id"]},
                "pubmed_id": {"S": article["pubmed_id"]},
                "title": {"S": article["title"]},
                "summary": {"S": article["summary"]},
                "keywords": {"S": article["keywords"]},
                "publication_date": {"S": article["publication_date"]},
                "relevance_tag": {"S": article["relevance_tag"]},
                "confidence": {"S": article["confidence"]},
                "url": {"S": article["url"]},
                "ttl": {"N": str(int(time.time()) + 90 * 24 * 60 * 60)}
            }
            dynamodb.put_item(TableName='MedoraReferences', Item=item)
            logger.info(f"Stored PubMed article in MedoraReferences: PMID {article['pubmed_id']}")

        # Fetch from ClinicalTrials.gov
        clinical_trials = fetch_clinical_trials()
        for trial in clinical_trials:
            item = {
                "id": {"S": trial["id"]},
                "pubmed_id": {"S": trial["pubmed_id"]},
                "title": {"S": trial["title"]},
                "summary": {"S": trial["summary"]},
                "keywords": {"S": trial["keywords"]},
                "publication_date": {"S": trial["publication_date"]},
                "relevance_tag": {"S": trial["relevance_tag"]},
                "confidence": {"S": trial["confidence"]},
                "url": {"S": trial["url"]},
                "ttl": {"N": str(int(time.time()) + 90 * 24 * 60 * 60)}
            }
            dynamodb.put_item(TableName='MedoraReferences', Item=item)
            logger.info(f"Stored ClinicalTrials.gov trial in MedoraReferences: NCT {trial['pubmed_id']}")

        # Fetch from NIH REPORTER
        nih_projects = fetch_nih_reporter()
        for project in nih_projects:
            item = {
                "id": {"S": project["id"]},
                "pubmed_id": {"S": project["pubmed_id"]},
                "title": {"S": project["title"]},
                "summary": {"S": project["summary"]},
                "keywords": {"S": project["keywords"]},
                "publication_date": {"S": project["publication_date"]},
                "relevance_tag": {"S": project["relevance_tag"]},
                "confidence": {"S": project["confidence"]},
                "url": {"S": project["url"]},
                "ttl": {"N": str(int(time.time()) + 90 * 24 * 60 * 60)}
            }
            dynamodb.put_item(TableName='MedoraReferences', Item=item)
            logger.info(f"Stored NIH REPORTER project in MedoraReferences: {project['pubmed_id']}")

        # Fetch from OpenAlex
        openalex_works = fetch_openalex()
        for work in openalex_works:
            item = {
                "id": {"S": work["id"]},
                "pubmed_id": {"S": work["pubmed_id"]},
                "title": {"S": work["title"]},
                "summary": {"S": work["summary"]},
                "keywords": {"S": work["keywords"]},
                "publication_date": {"S": work["publication_date"]},
                "relevance_tag": {"S": work["relevance_tag"]},
                "confidence": {"S": work["confidence"]},
                "url": {"S": work["url"]},
                "ttl": {"N": str(int(time.time()) + 90 * 24 * 60 * 60)}
            }
            dynamodb.put_item(TableName='MedoraReferences', Item=item)
            logger.info(f"Stored OpenAlex work in MedoraReferences: {work['pubmed_id']}")

        # Fetch from Europe PMC
        europe_pmc_articles = fetch_europe_pmc()
        for article in europe_pmc_articles:
            item = {
                "id": {"S": article["id"]},
                "pubmed_id": {"S": article["pubmed_id"]},
                "title": {"S": article["title"]},
                "summary": {"S": article["summary"]},
                "keywords": {"S": article["keywords"]},
                "publication_date": {"S": article["publication_date"]},
                "relevance_tag": {"S": article["relevance_tag"]},
                "confidence": {"S": article["confidence"]},
                "url": {"S": article["url"]},
                "ttl": {"N": str(int(time.time()) + 90 * 24 * 60 * 60)}
            }
            dynamodb.put_item(TableName='MedoraReferences', Item=item)
            logger.info(f"Stored Europe PMC article in MedoraReferences: {article['pubmed_id']}")

        # Fetch from MedRxiv
        medrxiv_papers = fetch_medrxiv()
        for paper in medrxiv_papers:
            item = {
                "id": {"S": paper["id"]},
                "pubmed_id": {"S": paper["pubmed_id"]},
                "title": {"S": paper["title"]},
                "summary": {"S": paper["summary"]},
                "keywords": {"S": paper["keywords"]},
                "publication_date": {"S": paper["publication_date"]},
                "relevance_tag": {"S": paper["relevance_tag"]},
                "confidence": {"S": paper["confidence"]},
                "url": {"S": paper["url"]},
                "ttl": {"N": str(int(time.time()) + 90 * 24 * 60 * 60)}
            }
            dynamodb.put_item(TableName='MedoraReferences', Item=item)
            logger.info(f"Stored MedRxiv paper in MedoraReferences: {paper['pubmed_id']}")

        # Clean the table
        clean_table()

        total_processed = len(pubmed_articles) + len(clinical_trials) + len(nih_projects) + len(openalex_works) + len(europe_pmc_articles) + len(medrxiv_papers)
        return {
            "statusCode": 200,
            "body": json.dumps(f"Processed {total_processed} allergy-related entries (PubMed: {len(pubmed_articles)}, ClinicalTrials.gov: {len(clinical_trials)}, NIH REPORTER: {len(nih_projects)}, OpenAlex: {len(openalex_works)}, Europe PMC: {len(europe_pmc_articles)}, MedRxiv: {len(medrxiv_papers)})")
        }
    except Exception as e:
        logger.error(f"Error in MedoraDataAndTrialsFetcher: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps(f"Error: {str(e)}")
        }
