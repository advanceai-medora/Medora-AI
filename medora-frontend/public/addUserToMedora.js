const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

// Configure clients
const cognitoClient = new CognitoIdentityProviderClient({ region: "ap-south-1" });
const dynamoClient = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function addUserToMedora(email, subscriptionId) {
    const userPoolId = "ap-south-1_6zdLiOolJ"; // Your Cognito User Pool ID
    const groupName = "MedoraUsers"; // Cognito group for Medora users

    try {
        // Step 1: Add user to Cognito User Pool
        const createUserCommand = new AdminCreateUserCommand({
            UserPoolId: userPoolId,
            Username: email,
            UserAttributes: [
                { Name: "email", Value: email },
                { Name: "email_verified", Value: "true" },
                { Name: "custom:specialty", Value: "allergist" } // Match existing users' specialty
            ],
            TemporaryPassword: "TempPassword123!", // Temporary password (user will need to reset)
            MessageAction: "SUPPRESS" // Suppress welcome email
        });

        const createUserResponse = await cognitoClient.send(createUserCommand);
        console.log("User created in Cognito:", createUserResponse.User.Username);

        // Extract the sub from the response
        const sub = createUserResponse.User.Attributes.find(attr => attr.Name === "sub").Value;

        // Step 2: Add user to MedoraUsers group
        const addToGroupCommand = new AdminAddUserToGroupCommand({
            UserPoolId: userPoolId,
            Username: email,
            GroupName: groupName
        });

        await cognitoClient.send(addToGroupCommand);
        console.log(`User ${email} added to group ${groupName}`);

        // Step 3: Add subscription record to DynamoDB using sub as user_id
        const putSubscriptionWithSubCommand = new PutCommand({
            TableName: "MedoraSubscriptions",
            Item: {
                user_id: sub,
                subscription_id: subscriptionId,
                status: "active",
                created_at: new Date().toISOString()
            }
        });

        await docClient.send(putSubscriptionWithSubCommand);
        console.log(`Subscription record added for user ${email} with sub ${sub}`);

        // Step 4: Add subscription record to DynamoDB using email as user_id
        const putSubscriptionWithEmailCommand = new PutCommand({
            TableName: "MedoraSubscriptions",
            Item: {
                user_id: email,
                subscription_id: subscriptionId,
                status: "active",
                created_at: new Date().toISOString()
            }
        });

        await docClient.send(putSubscriptionWithEmailCommand);
        console.log(`Subscription record added for user ${email} with email ${email}`);

        return { email, sub };
    } catch (error) {
        console.error("Error adding user to Medora:", error);
        throw error;
    }
}

// Add the IMS user
const imsUserEmail = "siddharthc@meditab.com";
const subscriptionId = "SUB-IMS-001"; // Subscription ID for the IMS user

addUserToMedora(imsUserEmail, subscriptionId)
    .then(result => {
        console.log(`Successfully added IMS user ${result.email} to Medora with sub ${result.sub}`);
    })
    .catch(err => {
        console.error("Failed to add IMS user:", err);
    });
