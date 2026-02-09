/**
 * Script to configure CORS for Cloudflare R2 bucket
 * This allows the frontend to upload files directly to R2 using signed URLs
 * 
 * Run with: node configure-r2-cors.js
 */

const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '../.env' });

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
const bucketName = process.env.CLOUDFLARE_BUCKET_NAME;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error('❌ Missing required environment variables:');
    console.error('   CLOUDFLARE_ACCOUNT_ID:', !!accountId);
    console.error('   CLOUDFLARE_ACCESS_KEY_ID:', !!accessKeyId);
    console.error('   CLOUDFLARE_SECRET_ACCESS_KEY:', !!secretAccessKey);
    console.error('   CLOUDFLARE_BUCKET_NAME:', !!bucketName);
    process.exit(1);
}

const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
    },
});

const corsConfiguration = {
    CORSRules: [
        {
            AllowedOrigins: [
                'http://localhost:5173',
                'http://localhost:3000',
                'https://surabhi-loyalty.web.app',
                'https://surabhiloyalty.web.app',
                'https://surabhiloyalty.firebaseapp.com',
                'https://sustainablekgv.com',
                'https://www.sustainablekgv.com'
            ],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag', 'Content-Length'],
            MaxAgeSeconds: 3600
        }
    ]
};

async function configureCORS() {
    try {
        // console.log(`\n🔧 Configuring CORS for bucket: ${bucketName}\n`);

        // First, try to get current CORS configuration
        try {
            const getCurrentCors = new GetBucketCorsCommand({ Bucket: bucketName });
            const currentCors = await client.send(getCurrentCors);
            // console.log('📋 Current CORS configuration:');
            // console.log(JSON.stringify(currentCors.CORSRules, null, 2));
        } catch (error) {
            if (error.name === 'NoSuchCORSConfiguration') {
                // console.log('📋 No existing CORS configuration found.');
            } else {
                console.warn('⚠️  Could not retrieve current CORS:', error.message);
            }
        }

        // Set new CORS configuration
        const command = new PutBucketCorsCommand({
            Bucket: bucketName,
            CORSConfiguration: corsConfiguration
        });

        await client.send(command);

        // console.log('\n✅ CORS configuration updated successfully!\n');
        // console.log('📝 New CORS rules:');
        // console.log(JSON.stringify(corsConfiguration.CORSRules, null, 2));
        // console.log('\n✨ Your R2 bucket is now configured to accept uploads from:');
        corsConfiguration.CORSRules[0].AllowedOrigins.forEach(origin => {
            // console.log(`   - ${origin}`);
        });
        // console.log('\n');

    } catch (error) {
        console.error('\n❌ Error configuring CORS:', error);
        console.error('Error details:', error.message);
        process.exit(1);
    }
}

configureCORS();
