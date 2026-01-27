
import axios from 'axios';

// These should be in your .env file
// VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
// VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo'; 
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'unsigned_preset'; 

export const uploadImageToCloudinary = async (file: File): Promise<string> => {
  if (!file) {
      throw new Error("No file provided");
  }

  // Check for credentials
  if (CLOUD_NAME === 'demo' || UPLOAD_PRESET === 'unsigned_preset') {
      console.error("Cloudinary credentials missing! CLOUD_NAME:", CLOUD_NAME, "PRESET:", UPLOAD_PRESET);
      throw new Error(`Cloudinary configuration missing. Please set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env file. Current: ${CLOUD_NAME}`);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'surabhi');

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      formData
    );
    return response.data.secure_url;
  } catch (error: any) {
    console.error('Error uploading image to Cloudinary:', error);
    const msg = error.response?.data?.error?.message || error.message || "Unknown Upload Error";
    throw new Error(`Image upload failed: ${msg}`);
  }
};
