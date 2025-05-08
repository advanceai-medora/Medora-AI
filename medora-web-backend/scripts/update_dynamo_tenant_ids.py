import boto3
import logging
import argparse
import time
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def update_existing_records(table_name, region, tenant_id):
    """
    Update all existing records in the specified DynamoDB table to add tenantID attribute
    """
    try:
        dynamodb = boto3.client('dynamodb', region_name=region)
        
        # Get all records from the table
        logger.info(f"Scanning table {table_name} for existing records...")
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
                logger.debug(f"Item already has tenantID attribute: {item.get('patient_id', {}).get('S', 'unknown')}")
                continue
                
            # Get primary key values
            patient_id = item['patient_id']['S']
            
            # For MedoraSOAPNotes, we need both patient_id and visit_id
            if 'visit_id' in item:
                visit_id = item['visit_id']['S']
                
                dynamodb.update_item(
                    TableName=table_name,
                    Key={
                        'patient_id': {'S': patient_id},
                        'visit_id': {'S': visit_id}
                    },
                    UpdateExpression="SET tenantID = :tid",
                    ExpressionAttributeValues={
                        ':tid': {'S': tenant_id}
                    }
                )
                logger.info(f"Updated record for patient {patient_id}, visit {visit_id}")
            else:
                # For other tables with different key structure
                dynamodb.update_item(
                    TableName=table_name,
                    Key={
                        'patient_id': {'S': patient_id}
                    },
                    UpdateExpression="SET tenantID = :tid",
                    ExpressionAttributeValues={
                        ':tid': {'S': tenant_id}
                    }
                )
                logger.info(f"Updated record for patient {patient_id}")
            
            updated_count += 1
            
            # Add a small delay to avoid hitting DynamoDB throughput limits
            if updated_count % 10 == 0:
                time.sleep(0.5)
        
        logger.info(f"Successfully updated {updated_count} records in {table_name}")
        return updated_count
        
    except Exception as e:
        logger.error(f"Error updating records in {table_name}: {str(e)}")
        raise

def create_gsi(table_name, region):
    """
    Add a Global Secondary Index to the table for efficient tenant-based queries
    """
    try:
        dynamodb = boto3.client('dynamodb', region_name=region)
        
        # Check if the GSI already exists
        logger.info(f"Checking if GSI already exists for {table_name}...")
        try:
            response = dynamodb.describe_table(TableName=table_name)
            gsis = response.get('Table', {}).get('GlobalSecondaryIndexes', [])
            
            for gsi in gsis:
                if gsi['IndexName'] == 'tenantID-patient_id-index':
                    logger.info(f"GSI 'tenantID-patient_id-index' already exists on {table_name}")
                    return False
        except Exception as e:
            logger.error(f"Error checking GSI existence: {str(e)}")
        
        # GSI doesn't exist, create it
        logger.info(f"Creating GSI 'tenantID-patient_id-index' on {table_name}...")
        
        response = dynamodb.update_table(
            TableName=table_name,
            AttributeDefinitions=[
                {'AttributeName': 'tenantID', 'AttributeType': 'S'},
                {'AttributeName': 'patient_id', 'AttributeType': 'S'}
            ],
            GlobalSecondaryIndexUpdates=[
                {
                    'Create': {
                        'IndexName': 'tenantID-patient_id-index',
                        'KeySchema': [
                            {'AttributeName': 'tenantID', 'KeyType': 'HASH'},
                            {'AttributeName': 'patient_id', 'KeyType': 'RANGE'}
                        ],
                        'Projection': {'ProjectionType': 'ALL'},
                        'ProvisionedThroughput': {'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
                    }
                }
            ]
        )
        
        logger.info(f"Successfully requested GSI creation for {table_name}. Status: {response['TableDescription']['TableStatus']}")
        
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
            if gsi['IndexName'] == 'tenantID-patient_id-index':
                logger.info(f"GSI Status: {gsi['IndexStatus']}")
                
        logger.info(f"GSI creation process completed for {table_name}")
        return True
        
    except ClientError as e:
        if e.response['Error']['Code'] == 'LimitExceededException':
            logger.error(f"You have reached the limit of indexes for table {table_name}")
        else:
            logger.error(f"Error creating GSI for {table_name}: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Error creating GSI for {table_name}: {str(e)}")
        raise

def main():
    parser = argparse.ArgumentParser(description='Update DynamoDB records with tenantID and create GSI')
    parser.add_argument('--region', type=str, default='ap-south-1', help='AWS region')
    parser.add_argument('--tenant', type=str, default='doctor@allergyaffiliates.com', help='Tenant ID to set')
    parser.add_argument('--tables', type=str, required=True, 
                       help='Comma-separated list of tables to update')
    parser.add_argument('--skip-gsi', action='store_true', help='Skip GSI creation')
    parser.add_argument('--skip-update', action='store_true', help='Skip record updates')
    
    args = parser.parse_args()
    
    tables = [t.strip() for t in args.tables.split(',')]
    region = args.region
    tenant_id = args.tenant
    
    logger.info(f"Starting update process for tables: {tables} in region {region}")
    logger.info(f"Will set tenantID to: {tenant_id}")
    
    for table in tables:
        try:
            logger.info(f"Processing table: {table}")
            
            if not args.skip_update:
                # Update existing records
                updated = update_existing_records(table, region, tenant_id)
                logger.info(f"Updated {updated} records in {table}")
            else:
                logger.info(f"Skipping record updates for {table}")
            
            if not args.skip_gsi:
                # Create GSI
                created = create_gsi(table, region)
                if created:
                    logger.info(f"GSI created for {table}")
                else:
                    logger.info(f"GSI already exists or creation skipped for {table}")
            else:
                logger.info(f"Skipping GSI creation for {table}")
                
        except Exception as e:
            logger.error(f"Error processing table {table}: {str(e)}")
    
    logger.info("Process completed")

if __name__ == "__main__":
    main()
