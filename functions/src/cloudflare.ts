import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import { onRequest, type Request } from 'firebase-functions/v2/https';

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

// Shared R2 Client Initialization
const getR2Client = () => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
    const bucketName = process.env.CLOUDFLARE_BUCKET_NAME; // Needed by caller usually, but kept for env check

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
         const missing = [];
         if (!accountId) missing.push("CLOUDFLARE_ACCOUNT_ID");
         if (!accessKeyId) missing.push("CLOUDFLARE_ACCESS_KEY_ID");
         if (!secretAccessKey) missing.push("CLOUDFLARE_SECRET_ACCESS_KEY");
         if (!bucketName) missing.push("CLOUDFLARE_BUCKET_NAME");
         
         console.error("Missing Cloudflare R2 configuration details:", missing.join(", "));
         throw new functions.https.HttpsError('internal', `Server configuration error: Missing R2 credentials (${missing.join(", ")}).`);
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

/**
 * Callable: allow browser clients; preflight must reach Cloud Run with public invoker.
 * R2 endpoints still require Firebase Auth (`request.auth`).
 */
const callableOpts = {
  cors: true as const,
  invoker: 'public' as const,
  region: 'us-central1' as const,
};

/** Origins allowed for HTTP delete CORS (explicit reflection; avoids callable preflight issues). */
const httpDeleteAllowedOrigins = new Set([
  'https://surabhiloyalty.web.app',
  'https://surabhiloyalty-uat.web.app',
  'https://surabhiloyalty.firebaseapp.com',
  'https://surabhiloyalty-uat.firebaseapp.com',
  'https://sustainablekgv.com',
  'https://www.sustainablekgv.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
]);

function setHttpDeleteCors(req: Request, res: any): void {
  const origin = req.headers.origin;
  if (origin && httpDeleteAllowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '3600');
}

/** Shared R2 delete implementation (callable + HTTP). */
async function deleteR2ObjectByKeyOrUrl(key: string | undefined, fileUrl: string | undefined): Promise<string> {
  const { client, bucketName } = getR2Client();
  let targetKey = key;

  if (!targetKey && fileUrl) {
    const publicUrl = process.env.CLOUDFLARE_PUBLIC_URL;
    if (publicUrl && fileUrl.startsWith(publicUrl)) {
      targetKey = fileUrl.replace(`${publicUrl}/`, '');
    } else {
      try {
        const urlObj = new URL(fileUrl);
        const pathParts = urlObj.pathname.split('/');
        if (pathParts.length >= 3 && pathParts[1] === bucketName) {
          targetKey = pathParts.slice(2).join('/');
        } else {
          targetKey = urlObj.pathname.substring(1);
        }
      } catch {
        console.warn('Could not parse fileUrl', fileUrl);
      }
    }
  }

  if (!targetKey) {
    throw new functions.https.HttpsError('invalid-argument', 'Could not determine file key');
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: targetKey,
    })
  );

  return targetKey;
}

export const createR2UploadUrl = functions.https.onCall({ 
    ...callableOpts
}, async (request) => {
  if (!request.auth) {
    const authHeader = request.rawRequest.headers['authorization'];
    const origin = request.rawRequest.headers['origin'];
    console.warn("Unauthenticated attempt", { authHeader: authHeader ? "Present" : "Missing", origin });
    throw new functions.https.HttpsError(
      'unauthenticated',
      `The function must be called while authenticated. (Auth Header: ${authHeader ? 'Present' : 'Missing'}, Origin: ${origin})`
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
    ...callableOpts
}, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { key, fileUrl } = request.data;
    if (!key && !fileUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'Must provide key or fileUrl');
    }

    try {
        const targetKey = await deleteR2ObjectByKeyOrUrl(key, fileUrl);
        return { success: true, message: `Deleted ${targetKey}` };
    } catch (error: unknown) {
        console.error('Error deleting image from R2:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        const msg =
            error instanceof Error ? error.message : typeof error === 'string' ? error : 'Delete failed';
        throw new functions.https.HttpsError('internal', msg);
    }
});

/**
 * HTTP + explicit CORS for browsers where callable preflight fails (custom domains / Cloud Run).
 * Auth: Authorization: Bearer &lt;Firebase ID token&gt;. Body JSON: `{ "fileUrl": "..." }` or `{ "key": "..." }`.
 */
export const deleteImageFromR2Http = onRequest(
  {
    region: 'us-central1',
    invoker: 'public',
  },
  async (req: Request, res: any) => {
    setHttpDeleteCors(req, res);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const idToken = authHeader.slice('Bearer '.length).trim();
    try {
      await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      console.warn('deleteImageFromR2Http: invalid ID token', e);
      res.status(401).json({ error: 'Invalid or expired ID token' });
      return;
    }

    let body: { key?: string; fileUrl?: string };
    try {
      if (req.rawBody && req.rawBody.length > 0) {
        body = JSON.parse(req.rawBody.toString('utf8')) as { key?: string; fileUrl?: string };
      } else if (req.body && typeof req.body === 'object') {
        body = req.body as { key?: string; fileUrl?: string };
      } else {
        body = {};
      }
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    const { key, fileUrl } = body;
    if (!key && !fileUrl) {
      res.status(400).json({ error: 'Must provide key or fileUrl' });
      return;
    }

    try {
      const targetKey = await deleteR2ObjectByKeyOrUrl(key, fileUrl);
      res.status(200).json({ success: true, message: `Deleted ${targetKey}` });
    } catch (error: unknown) {
      console.error('deleteImageFromR2Http R2 error:', error);
      if (error instanceof functions.https.HttpsError) {
        const status = error.code === 'invalid-argument' ? 400 : 500;
        res.status(status).json({ error: error.message });
        return;
      }
      const msg = error instanceof Error ? error.message : 'Delete failed';
      res.status(500).json({ error: msg });
    }
  }
);
