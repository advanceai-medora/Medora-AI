import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.client('dynamodb', region_name='ap-south-1')

def lambda_handler(event, context):
    try:
        response = dynamodb.scan(TableName='MedoraReferences')
        items = response.get('Items', [])

        allergy_terms = [
            'allergy', 'allergic', 'anaphylaxis', 'anaphylactic', 'hives', 'urticaria',
            'asthma', 'asthmatic', 'rhinitis', 'eosinophil', 'pollinosis', 'atopic',
            'eczema', 'immunotherapy', 'sensitization', 'ige', 'wasp sting', 'food allergy',
            'shellfish', 'allergen', 'hypersensitivity', 'bronchitis', 'drug allergy',
            'mold allergy', 'allergic conjunctivitis'
        ]

        seen_pmids = set()
        for item in items:
            # Check for duplicates
            pubmed_id = item.get('pubmed_id', {}).get('S', item.get('pmid', {}).get('S', 'N/A'))
            if pubmed_id in seen_pmids:
                dynamodb.delete_item(
                    TableName='MedoraReferences',
                    Key={'id': item['id']}
                )
                logger.info(f"Deleted duplicate entry: {item['id']['S']}")
                continue
            seen_pmids.add(pubmed_id)

            # Check for mock data (PMIDs starting with 402)
            if pubmed_id.startswith('402'):
                dynamodb.delete_item(
                    TableName='MedoraReferences',
                    Key={'id': item['id']}
                )
                logger.info(f"Deleted mock entry: {item['id']['S']}")
                continue

            # Check for missing fields
            if 'title' not in item or 'summary' not in item or 'keywords' not in item:
                dynamodb.delete_item(
                    TableName='MedoraReferences',
                    Key={'id': item['id']}
                )
                logger.info(f"Deleted incomplete entry: {item['id']['S']}")
                continue

            # Check for empty summary or keywords
            summary = item['summary']['S'].lower()
            if summary in ["n/a", "summary not available", ""]:
                dynamodb.delete_item(
                    TableName='MedoraReferences',
                    Key={'id': item['id']}
                )
                logger.info(f"Deleted entry with missing summary: {item['id']['S']}")
                continue

            if 'L' in item['keywords'] and not item['keywords']['L']:
                dynamodb.delete_item(
                    TableName='MedoraReferences',
                    Key={'id': item['id']}
                )
                logger.info(f"Deleted entry with empty keywords: {item['id']['S']}")
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
                logger.info(f"Updated keywords for entry: {item['id']['S']}")
                keywords = new_keywords.lower()
            else:
                keywords = item['keywords']['S'].lower()

            relevance_tag = item.get('relevance_tag', {}).get('S', '').lower()

            # Check if the entry is allergy-related
            is_allergy_related = any(term in keywords or term in relevance_tag or term in summary for term in allergy_terms)
            if not is_allergy_related:
                dynamodb.delete_item(
                    TableName='MedoraReferences',
                    Key={'id': item['id']}
                )
                logger.info(f"Deleted non-allergy entry: {item['id']['S']}")
                continue

            # Check for outdated entries (before 2020)
            pub_date = int(item['publication_date']['S'])
            if pub_date < 2020:
                dynamodb.delete_item(
                    TableName='MedoraReferences',
                    Key={'id': item['id']}
                )
                logger.info(f"Deleted outdated entry (before 2020): {item['id']['S']}")
                continue

        return {"statusCode": 200, "body": "Cleanup completed"}
    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")
        return {"statusCode": 500, "body": f"Error: {str(e)}"}
