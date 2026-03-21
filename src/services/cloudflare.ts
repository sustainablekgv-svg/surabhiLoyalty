import { getFirebaseUserForFunctions } from '@/lib/authService';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

interface UploadResponse {
    signedUrl: string;
    fileUrl: string;
    key: string;
}

export const uploadImageToR2 = async (file: File, folder: string = 'uploads'): Promise<string> => {
    if (!file) {
        throw new Error("No file provided");
    }

    // Basic Validation
    if (!file.type.startsWith('image/')) {
        throw new Error("Invalid file type. Please upload an image.");
    }

    const MAX_SIZE_MB = 10;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`File size exceeds ${MAX_SIZE_MB}MB limit.`);
        
    }

    try {
        const user = await getFirebaseUserForFunctions();
        const token = await user.getIdToken(true);
        // console.log("Calling createR2UploadUrl. User UID:", user.uid, "Token Length:", token.length);
        
        // 1. Get Signed URL from Backend
        const createR2UploadUrl = httpsCallable<{ filename: string; contentType: string; folder?: string }, UploadResponse>(
            functions, 
            'createR2UploadUrl'
        );
        
        const requestPayload = {
            filename: file.name,
            contentType: file.type,
            folder
        };

        // First attempt with refreshed token; retry once after another forced refresh
        // to handle edge cases where callable still receives stale auth context.
        let data: UploadResponse;
        try {
            const response = await createR2UploadUrl(requestPayload);
            data = response.data;
        } catch (firstErr: any) {
            const code = firstErr?.code as string | undefined;
            const shouldRetry =
                code === 'functions/unauthenticated' ||
                code === 'functions/internal' ||
                code === 'unauthenticated';

            if (!shouldRetry) {
                throw firstErr;
            }

            await user.getIdToken(true);
            const retryResponse = await createR2UploadUrl(requestPayload);
            data = retryResponse.data;
        }

        const { signedUrl, fileUrl } = data;

        if (!signedUrl) {
           throw new Error("Failed to retrieve signed URL from server.");
        }

        // 2. Upload to R2 using the Signed URL
        // Note: This determines if CORS is configured correctly on the R2 bucket.
        // console.log("Uploading to R2...");
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type,
            },
            body: file,
        });

        if (!uploadResponse.ok) {
            console.error("R2 Upload Failed:", uploadResponse.status, uploadResponse.statusText);
            
            // Check for common issues
            if (uploadResponse.status === 403) {
                 throw new Error("Upload permission denied. Check server credentials or CORS.");
            }
             if (uploadResponse.status === 400) {
                 throw new Error("Invalid upload request. Check file type/size.");
            }

            throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        return fileUrl;
    } catch (error: any) {
        console.error('Error uploading image to R2:', error);
        
        // Enhance error message for common network issues
        if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
             throw new Error("Network error during upload. This might be a CORS issue on the storage bucket.");
        }

        throw new Error(error.message || "Unknown error during image upload");
    }
};

export const deleteImageFromR2 = async (fileUrl: string): Promise<void> => {
    if (!fileUrl) return;
    try {
        const user = await getFirebaseUserForFunctions();
        const token = await user.getIdToken(true);
        const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
        if (!projectId) {
            throw new Error('Missing VITE_FIREBASE_PROJECT_ID');
        }
        // HTTP endpoint: explicit CORS for custom domains (callable preflight can fail on Cloud Run).
        const url = `https://us-central1-${projectId}.cloudfunctions.net/deleteImageFromR2Http`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ fileUrl }),
        });
        if (!res.ok) {
            let errMsg = `Delete failed (${res.status})`;
            try {
                const data = (await res.json()) as { error?: string };
                if (data?.error) errMsg = data.error;
            } catch {
                /* ignore */
            }
            throw new Error(errMsg);
        }
    } catch (error) {
        console.error("Failed to delete image from R2:", error);
        throw error;
    }
};
