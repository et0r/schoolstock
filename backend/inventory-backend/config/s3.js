const { S3Client } = require('@aws-sdk/client-s3');
require('dotenv').config();

const config = {
    region: process.env.AWS_REGION || 'eu-north-1',
};

// Only explicitly set credentials if they exist in .env
// Otherwise, the AWS SDK will automatically use the EC2 IAM Role!
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
}

const s3Client = new S3Client(config);

module.exports = s3Client;