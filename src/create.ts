const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || '';
const PRIMARY_KEY = process.env.PRIMARY_KEY || '';

export const handler = async (event: any = {}) : Promise <any> => {

  const apiKeyId = event.pathParameters.id;

  if (!apiKeyId) {
    return { statusCode: 400, body: `Error: You are missing the path parameter id` };
  }

  const params = {
    TableName: TABLE_NAME,
    Key: {
      [PRIMARY_KEY]: apiKeyId
    }
  };

  try {
    const response = await db.put(params).promise();
    return { statusCode: 201 };
  } catch (dbError) {
    return { statusCode: 500, body: JSON.stringify(dbError) };
  }
};
