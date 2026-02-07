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
        // 1. Get Signed URL from Backend
        const createR2UploadUrl = httpsCallable<{ filename: string; contentType: string; folder?: string }, UploadResponse>(
            functions, 
            'createR2UploadUrl'
        );
        
        // console.log(`Requesting signed URL for ${file.name} (${file.type}) in folder ${folder}...`);
        const { data } = await createR2UploadUrl({
            filename: file.name,
            contentType: file.type,
            folder
        });

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
        // console.log(`Attempting to delete image: ${fileUrl}`);
        const deleteFn = httpsCallable<{ fileUrl: string }, { success: boolean; message: string }>(
            functions, 
            'deleteImageFromR2'
        );
        await deleteFn({ fileUrl });
        // console.log(`Successfully requested deletion for: ${fileUrl}`);
    } catch (error) {
        console.error("Failed to delete image from R2:", error);
        // Clean-up should not block user flow, so we log but don't re-throw typically
    }
};
