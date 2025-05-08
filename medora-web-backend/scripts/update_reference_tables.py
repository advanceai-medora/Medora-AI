import boto3
import json
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def update_references_table(tenant_id, region='ap-south-1'):
    """
    Update MedoraReferences table to add tenantID to all items
    """
    try:
        # Initialize DynamoDB client
        dynamodb = boto3.client('dynamodb', region_name=region)
        table_name = 'MedoraReferences'
        
        # Scan the table to get all items
        logger.info(f"Scanning {table_name} for existing records...")
        response = dynamodb.scan(TableName=table_name)
        items = response.get('Items', [])
        
        # Handle pagination if necessary
        while 'LastEvaluatedKey' in response:
            response = dynamodb.scan(
                TableName=table_name,
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            items.extend(response.get('Items', []))
        
        logger.info(f"Found {len(items)} records to update in {table_name}")
        
        # Update each item to add tenantID
        updated_count = 0
        for item in items:
            if 'tenantID' in item:
                logger.debug(f"Item already has tenantID attribute: {item.get('id', {}).get('S', 'unknown')}")
                continue
                
            # Get the ID (primary key)
            item_id = item['id']['S']
            
            # Update the item to add tenantID
            dynamodb.update_item(
                TableName=table_name,
                Key={
                    'id': {'S': item_id}
                },
                UpdateExpression="SET tenantID = :tid",
                ExpressionAttributeValues={
                    ':tid': {'S': tenant_id}
                }
            )
            logger.info(f"Updated record with ID {item_id}")
            
            updated_count += 1
            
            # Add a small delay to avoid hitting DynamoDB throughput limits
            if updated_count % 10 == 0:
                time.sleep(0.5)
        
        logger.info(f"Successfully updated {updated_count} records in {table_name}")
        return updated_count
        
    except Exception as e:
        logger.error(f"Error updating records in {table_name}: {str(e)}")
        raise

def create_gsi_pay_per_request(region='ap-south-1'):
    """
    Create a GSI on the MedoraReferences table without provisioned capacity
    """
    try:
        dynamodb = boto3.client('dynamodb', region_name=region)
        table_name = 'MedoraReferences'
        
        # Check if GSI already exists
        logger.info(f"Checking if GSI already exists for {table_name}...")
        try:
            response = dynamodb.describe_table(TableName=table_name)
            gsis = response.get('Table', {}).get('GlobalSecondaryIndexes', [])
            
            for gsi in gsis:
                if gsi['IndexName'] == 'tenantID-index':
                    logger.info(f"GSI 'tenantID-index' already exists on {table_name}")
                    return False
        except Exception as e:
            logger.error(f"Error checking GSI existence: {str(e)}")
        
        # GSI doesn't exist, create it
        logger.info(f"Creating GSI 'tenantID-index' on {table_name}...")
        
        response = dynamodb.update_table(
            TableName=table_name,
            AttributeDefinitions=[
                {'AttributeName': 'id', 'AttributeType': 'S'},
                {'AttributeName': 'tenantID', 'AttributeType': 'S'}
            ],
            GlobalSecondaryIndexUpdates=[
                {
                    'Create': {
                        'IndexName': 'tenantID-index',
                        'KeySchema': [
                            {'AttributeName': 'tenantID', 'KeyType': 'HASH'}
                        ],
                        'Projection': {'ProjectionType': 'ALL'}
                        # No ProvisionedThroughput for PAY_PER_REQUEST tables
                    }
                }
            ]
        )
        
        logger.info(f"Successfully requested GSI creation for {table_name}")
        
        # Wait for the GSI to be created (this can take several minutes)
        logger.info(f"Waiting for GSI to be active...")
        waiter = dynamodb.get_waiter('table_exists')
        waiter.wait(
            TableName=table_name,
            WaiterConfig={
                'Delay': 30,
                'MaxAttempts': 20
            }
        )
        
        # Check if GSI is active
        response = dynamodb.describe_table(TableName=table_name)
        gsis = response.get('Table', {}).get('GlobalSecondaryIndexes', [])
        for gsi in gsis:
            if gsi['IndexName'] == 'tenantID-index':
                logger.info(f"GSI Status: {gsi['IndexStatus']}")
                
        logger.info(f"GSI creation process completed for {table_name}")
        return True
        
    except Exception as e:
        logger.error(f"Error creating GSI for {table_name}: {str(e)}")
        raise

def main():
    # Update records in MedoraReferences table
    tenant_id = 'doctor@allergyaffiliates.com'
    updated_count = update_references_table(tenant_id)
    logger.info(f"Updated {updated_count} records in MedoraReferences")
    
    # Create GSI
    created = create_gsi_pay_per_request()
    if created:
        logger.info("GSI created for MedoraReferences")
    else:
        logger.info("GSI already exists or creation skipped for MedoraReferences")

if __name__ == "__main__":
    main()
