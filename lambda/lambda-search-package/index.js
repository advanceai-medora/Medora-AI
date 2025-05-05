const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    try {
        const query = event.queryStringParameters?.q || 'allergy';
        const size = parseInt(event.queryStringParameters?.size) || 10;

        const params = {
            TableName: 'MedoraReferences',
            FilterExpression: 'contains(#k, :q) or contains(#r, :q) or contains(#t, :q) or contains(#s, :q)',
            ExpressionAttributeNames: {
                '#k': 'keywords',
                '#r': 'relevance_tag',
                '#t': 'title',
                '#s': 'summary'
            },
            ExpressionAttributeValues: { ':q': query.toLowerCase() },
            Limit: size
        };

        const result = await dynamodb.scan(params).promise();
        const references = result.Items.filter(item => item.ttl > Math.floor(Date.now() / 1000));

        console.log('Raw scan result:', JSON.stringify(result.Items));
        console.log('Filtered references:', JSON.stringify(references));

        return {
            statusCode: 200,
            body: JSON.stringify({ results: references }),
            headers: {
                'Access-Control-Allow-Origin': 'https://test.medoramd.ai',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            }
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify('Error fetching references: ' + error.message),
            headers: {
                'Access-Control-Allow-Origin': 'https://test.medoramd.ai',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            }
        };
    }
};
