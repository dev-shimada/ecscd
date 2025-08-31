const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

async function createTable() {
  const tableName = process.env.DYNAMODB_TABLE_NAME || 'ecscd';
  const region = process.env.AWS_REGION || 'us-east-1';
  
  const client = new DynamoDBClient({ region });

  // Check if table already exists
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`Table ${tableName} already exists`);
    return;
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') {
      throw error;
    }
  }

  const createTableParams = {
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  };

  try {
    const result = await client.send(new CreateTableCommand(createTableParams));
    console.log(`Table ${tableName} created successfully`);
    console.log('Table ARN:', result.TableDescription.TableArn);
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  }
}

if (require.main === module) {
  createTable().catch(console.error);
}

module.exports = { createTable };