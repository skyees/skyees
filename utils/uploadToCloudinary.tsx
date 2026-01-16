export const uploadToCloudinary = async (fileUri: string, type: 'audio' | 'video') => {
  const CLOUD_NAME = "dn5m2txky";
  const UPLOAD_PRESET = "rajkiranv";
  
 const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    type: `${type}/${type === 'audio' ? 'aac' : 'mp4'}`,
    name: `media.${type === 'audio' ? 'aac' : 'mp4'}`
  });
    formData.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`, {
    method: 'POST',
    body: formData
  });

  const json = await res.json();
  return json.secure_url;
};