import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as functions from 'firebase-functions/v2';

// Shared R2 Client Initialization
const getR2Client = () => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
    const bucketName = process.env.CLOUDFLARE_BUCKET_NAME; // Needed by caller usually, but kept for env check

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
         console.error("Missing Cloudflare R2 configuration:", { 
             hasAccountId: !!accountId, 
             hasAccessKey: !!accessKeyId, 
             hasSecret: !!secretAccessKey, 
             hasBucket: !!bucketName 
         });
         throw new functions.https.HttpsError('internal', "Server configuration error: Missing R2 credentials.");
    }

    const client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
        },
    });

    return { client, bucketName, accountId }; // Return needed config
};

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
  // console.log("createR2UploadUrl called with data:", request.data);

  if (!request.auth) {
    console.warn("Unauthenticated attempt");
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const { filename, contentType, folder = 'uploads' } = request.data;
  
  if (!filename || !contentType) {
    console.warn("Invalid arguments:", { filename, contentType });
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with a valid filename and contentType.'
    );
  }
  
  try {
      const { client, bucketName, accountId } = getR2Client();
      const publicUrl = process.env.CLOUDFLARE_PUBLIC_URL;

      // Sanitize filename and add random prefix to avoid collisions
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      // Use folder if provided, sanitize it too to prevent directory traversal
      const sanitizedFolder = folder.replace(/[^a-zA-Z0-9-_]/g, ''); 
      const key = `${sanitizedFolder}/${Date.now()}-${sanitizedFilename}`;

      // console.log(`Generating signed URL for key: ${key}, contentType: ${contentType}`);

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: contentType,
      });

      const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
      
      // Construct public URL. 
      const fileUrl = publicUrl 
        ? `${publicUrl}/${key}` 
        : `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;

      return { signedUrl, fileUrl, key };
    } catch (error: any) {
        console.error('Error generating signed URL:', error);
        console.error(error.stack);
        throw new functions.https.HttpsError('internal', error.message || 'Unable to generate upload URL');
    }
});

export const deleteImageFromR2 = functions.https.onCall({
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
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { key, fileUrl } = request.data;
    if (!key && !fileUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'Must provide key or fileUrl');
    }

    try {
        const { client, bucketName } = getR2Client();
        let targetKey = key;
        
        // Extract key from URL if not provided directly
        if (!targetKey && fileUrl) {
           const publicUrl = process.env.CLOUDFLARE_PUBLIC_URL;
           if (publicUrl && fileUrl.startsWith(publicUrl)) {
               targetKey = fileUrl.replace(`${publicUrl}/`, '');
           } else {
               // Fallback or R2 direct URL format parsing if needed
               // Standard format: https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
               try {
                  const urlObj = new URL(fileUrl);
                  const pathParts = urlObj.pathname.split('/');
                  // If path is /bucket/folder/file
                  if (pathParts.length >= 3 && pathParts[1] === bucketName) {
                      targetKey = pathParts.slice(2).join('/');
                  } else {
                      // Maybe custom domain or simplified structure
                      targetKey = urlObj.pathname.substring(1); // remove leading slash
                  }
               } catch (e) {
                   console.warn("Could not parse fileUrl", fileUrl);
               }
           }
        }

        if (!targetKey) {
            throw new functions.https.HttpsError('invalid-argument', 'Could not determine file key');
        }

        // console.log(`Deleting object from R2: ${targetKey}`);

        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: targetKey,
        });

        await client.send(command);

        return { success: true, message: `Deleted ${targetKey}` };
    } catch (error: any) {
        console.error('Error deleting image from R2:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Delete failed');
    }
});
