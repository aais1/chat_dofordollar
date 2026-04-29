export const uploadUnsigned = async (file, type) => {
  const cloudName = "dsjmgwsoa"; // Use the cloud name from your dashboard
  const uploadPreset = "rep_chatapp"; // PLEASE REPLACE with your unsigned upload preset name

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const resourceType = type === 'video' ? 'video' : type === 'audio' ? 'video' : 'image';

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Upload failed');
  }

  const data = await response.json();
  return { url: data.secure_url, publicId: data.public_id };
};
