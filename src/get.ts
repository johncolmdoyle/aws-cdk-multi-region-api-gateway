const AWS = require('aws-sdk');

export const handler = async (event: any = {}) : Promise <any> => {
  return { statusCode: 200, body: process.env.AWS_REGION };
};

