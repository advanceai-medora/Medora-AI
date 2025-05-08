import boto3
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_gsi_pay_per_request(table_name, region='ap-south-1'):
    """Create GSI without specifying provisioned capacity for PAY_PER_REQUEST tables"""
    try:
        dynamodb = boto3.client('dynamodb', region_name=region)
        
        # Check if GSI already exists
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
        
        # Get the attribute definitions from the table
        attribute_defs = response.get('Table', {}).get('AttributeDefinitions', [])
        attr_names = [attr['AttributeName'] for attr in attribute_defs]
        
        # Prepare new attribute definitions list
        new_attr_defs = []
        
        # Add existing attribute definitions that we need
        for attr in attribute_defs:
            if attr['AttributeName'] in ['patient_id']:
                new_attr_defs.append(attr)
        
        # Add tenantID attribute if it doesn't exist
        if 'tenantID' not in attr_names:
            new_attr_defs.append({'AttributeName': 'tenantID', 'AttributeType': 'S'})
            
        # Add patient_id attribute if it doesn't exist
        if 'patient_id' not in attr_names:
            new_attr_defs.append({'AttributeName': 'patient_id', 'AttributeType': 'S'})
            
        # Create GSI without provisioned throughput
        logger.info(f"Creating GSI 'tenantID-patient_id-index' on {table_name}...")
        
        try:
            response = dynamodb.update_table(
                TableName=table_name,
                AttributeDefinitions=new_attr_defs,
                GlobalSecondaryIndexUpdates=[
                    {
                        'Create': {
                            'IndexName': 'tenantID-patient_id-index',
                            'KeySchema': [
                                {'AttributeName': 'tenantID', 'KeyType': 'HASH'},
                                {'AttributeName': 'patient_id', 'KeyType': 'RANGE'}
                            ],
                            'Projection': {'ProjectionType': 'ALL'}
                            # No ProvisionedThroughput for PAY_PER_REQUEST tables
                        }
                    }
                ]
            )
            
            logger.info(f"Successfully requested GSI creation for {table_name}")
            return True
        except Exception as e:
            logger.error(f"Error creating GSI: {str(e)}")
            return False
            
    except Exception as e:
        logger.error(f"Error creating GSI for {table_name}: {str(e)}")
        return False

if __name__ == "__main__":
    # Create GSIs for both tables
    tables = ['MedoraSOAPNotes', 'MedoraPatientInsights']
    
    for table in tables:
        logger.info(f"Creating GSI for {table}...")
        success = create_gsi_pay_per_request(table)
        if success:
            logger.info(f"GSI creation initiated for {table}")
        else:
            logger.info(f"GSI creation failed or skipped for {table}")
