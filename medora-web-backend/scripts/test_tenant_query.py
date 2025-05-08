import boto3
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def format_item(item):
    """Format a DynamoDB item for easier reading"""
    result = {}
    for key, value in item.items():
        if 'S' in value:
            result[key] = value['S']
        elif 'N' in value:
            result[key] = value['N']
        elif 'BOOL' in value:
            result[key] = value['BOOL']
        elif 'M' in value:
            result[key] = format_item(value['M'])
        elif 'L' in value:
            result[key] = [format_item(i) if 'M' in i else i for i in value['L']]
        else:
            result[key] = value
    return result

def query_by_tenant_with_gsi(table_name, tenant_id, region='ap-south-1'):
    """Query a table using GSI by tenantID"""
    try:
        dynamodb = boto3.client('dynamodb', region_name=region)
        
        # Determine which GSI to use based on table
        if table_name == 'MedoraReferences':
            index_name = 'tenantID-index'
            logger.info(f"Querying {table_name} using {index_name} for tenant {tenant_id}")
            
            response = dynamodb.query(
                TableName=table_name,
                IndexName=index_name,
                KeyConditionExpression='tenantID = :tid',
                ExpressionAttributeValues={
                    ':tid': {'S': tenant_id}
                }
            )
        else:
            index_name = 'tenantID-patient_id-index'
            logger.info(f"Querying {table_name} using {index_name} for tenant {tenant_id}")
            
            response = dynamodb.query(
                TableName=table_name,
                IndexName=index_name,
                KeyConditionExpression='tenantID = :tid',
                ExpressionAttributeValues={
                    ':tid': {'S': tenant_id}
                }
            )
        
        items = response.get('Items', [])
        logger.info(f"Found {len(items)} items for tenant {tenant_id} in table {table_name}")
        return items
    except Exception as e:
        logger.error(f"Error querying {table_name} with GSI: {str(e)}")
        return []

def query_by_tenant_with_scan(table_name, tenant_id, region='ap-south-1'):
    """Query a table using scan with filter by tenantID (fallback method)"""
    try:
        dynamodb = boto3.client('dynamodb', region_name=region)
        
        logger.info(f"Scanning {table_name} with filter for tenant {tenant_id}")
        response = dynamodb.scan(
            TableName=table_name,
            FilterExpression='tenantID = :tid',
            ExpressionAttributeValues={
                ':tid': {'S': tenant_id}
            }
        )
        
        items = response.get('Items', [])
        logger.info(f"Found {len(items)} items for tenant {tenant_id} in table {table_name}")
        return items
    except Exception as e:
        logger.error(f"Error scanning {table_name}: {str(e)}")
        return []

def display_sample_items(items, table_name):
    """Display a few sample items from the results"""
    if not items:
        logger.info(f"No items found in {table_name}")
        return
    
    logger.info(f"\n===== Sample items from {table_name} =====")
    for i in range(min(3, len(items))):
        item = format_item(items[i])
        
        # For MedoraSOAPNotes, show minimal info to avoid large output
        if table_name == 'MedoraSOAPNotes':
            logger.info(f"Item {i+1}:")
            logger.info(f"  patient_id: {item.get('patient_id', 'N/A')}")
            logger.info(f"  visit_id: {item.get('visit_id', 'N/A')}")
            logger.info(f"  tenantID: {item.get('tenantID', 'N/A')}")
            
        # For MedoraPatientInsights, show a bit more info
        elif table_name == 'MedoraPatientInsights':
            logger.info(f"Item {i+1}:")
            logger.info(f"  patient_id: {item.get('patient_id', 'N/A')}")
            logger.info(f"  visit_id: {item.get('visit_id', 'N/A')}")
            logger.info(f"  tenantID: {item.get('tenantID', 'N/A')}")
            
        # For MedoraReferences, show the id and tenantID
        else:
            logger.info(f"Item {i+1}:")
            logger.info(f"  id: {item.get('id', 'N/A')}")
            logger.info(f"  tenantID: {item.get('tenantID', 'N/A')}")
        
        logger.info("------------------------------------------")

def main():
    tenant_id = 'doctor@allergyaffiliates.com'
    tables = ['MedoraSOAPNotes', 'MedoraPatientInsights', 'MedoraReferences']
    
    for table in tables:
        # Try querying with GSI first
        items = query_by_tenant_with_gsi(table, tenant_id)
        
        # If GSI query fails or returns no items, fall back to scan
        if not items:
            logger.info(f"GSI query returned no items for {table}, falling back to scan")
            items = query_by_tenant_with_scan(table, tenant_id)
        
        # Display sample items
        display_sample_items(items, table)

if __name__ == "__main__":
    main()
