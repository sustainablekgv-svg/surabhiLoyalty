import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as functions from 'firebase-functions/v2';

export const createR2UploadUrl = functions.https.onCall({ 
    cors: [
        'http://localhost:5173', 
        'http://localhost:3000', 
        'https://surabhi-loyalty.web.app', 
        'https://surabhiloyalty.web.app',
        'https://surabhiloyalty.firebaseapp.com',
        'https://sustainablekgv.com',
        'https://www.sustainablekgv.com'
    ]
}, async (request) => {
  console.log("createR2UploadUrl called with data:", request.data);

  if (!request.auth) {
    console.warn("Unauthenticated attempt");
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const { filename, contentType } = request.data;
  
  if (!filename || !contentType) {
    console.warn("Invalid arguments:", { filename, contentType });
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with a valid filename and contentType.'
    );
  }
  
  // Initialize inside function to utilize current environment variables and catch errors
  // This prevents module-level crashes from causing 500s/CORS errors on cold start
    // Verify environment configuration before proceeding
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
    const bucketName = process.env.CLOUDFLARE_BUCKET_NAME;
    const publicUrl = process.env.CLOUDFLARE_PUBLIC_URL;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
         console.error("Missing Cloudflare R2 configuration:", { 
             hasAccountId: !!accountId, 
             hasAccessKey: !!accessKeyId, 
             hasSecret: !!secretAccessKey, 
             hasBucket: !!bucketName 
         });
         throw new functions.https.HttpsError('internal', "Server configuration error: Missing R2 credentials.");
    }

    try {
      const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
        },
      });

      // Sanitize filename and add random prefix to avoid collisions
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `uploads/${Date.now()}-${sanitizedFilename}`;

      console.log(`Generating signed URL for key: ${key}, contentType: ${contentType}`);

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: contentType,
      });

      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      
      // Construct public URL. 
      const fileUrl = publicUrl 
        ? `${publicUrl}/${key}` 
        : `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;

      return { signedUrl, fileUrl, key };
    } catch (error: any) {
        console.error('Error generating signed URL:', error);
        // Explicitly log the stack to helping debugging
        console.error(error.stack);
        
        throw new functions.https.HttpsError('internal', error.message || 'Unable to generate upload URL');
    }
});
