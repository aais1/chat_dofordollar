import { v2 as cloudinary } from 'cloudinary';
// Removed unused uuid import

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dsjmgwsoa",
  api_key:    process.env.CLOUDINARY_API_KEY || "742217215278788",
  api_secret: process.env.CLOUDINARY_API_SECRET || "CNBxX6x5d5MonadJ5Rd7KZ19VeU",
});

/**
 * Upload a buffer to Cloudinary using an UNSIGNED upload preset.
 * This avoids the "Invalid Signature" errors.
 */
export const uploadToCloudinaryUnsigned = (buffer, folder, resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || "rep_chatapp";
    
    const stream = cloudinary.uploader.upload_stream(
      {
        upload_preset: uploadPreset, // Use unsigned preset
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
};

/**
 * Legacy signed upload (requires valid secret)
 */
export const uploadToCloudinary = (buffer, folder, resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
};

export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

export default cloudinary;
