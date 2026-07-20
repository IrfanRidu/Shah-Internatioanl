import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Per-folder transform presets — resize + compress every image to a fixed
// canvas so storage stays lean and all cards/banners are always the same size.
const PRESETS = {
  products:     { width: 800,  height: 800,  crop: 'fill', quality: 75,  format: 'webp' },
  banners:      { width: 1400, height: 560,  crop: 'fill', quality: 80,  format: 'webp' },
  avatars:      { width: 200,  height: 200,  crop: 'fill', quality: 80,  format: 'webp' },
  branding:     { width: 600,  height: 300,  crop: 'fit',  quality: 90,  format: 'webp' },
  letterheads:  { width: 1200, height: 400,  crop: 'fit',  quality: 90,  format: 'webp' },
  'shipment-docs': { quality: 85, format: 'webp' },
  default:      { width: 1200, quality: 80,  format: 'webp' },
};

export const uploadImage = async (base64Image, folder = 'shah-international') => {
  const key = Object.keys(PRESETS).find(k => folder.includes(k)) || 'default';
  const preset = PRESETS[key];

  const transformations = {
    folder,
    resource_type: 'auto',
    quality: preset.quality ?? 80,
    fetch_format: preset.format ?? 'webp',
    ...(preset.width  && { width:  preset.width  }),
    ...(preset.height && { height: preset.height }),
    ...(preset.crop   && { crop:   preset.crop   }),
  };

  const result = await cloudinary.uploader.upload(base64Image, transformations);
  return { url: result.secure_url, publicId: result.public_id };
};

export const deleteImage = async (publicId) => {
  await cloudinary.uploader.destroy(publicId);
};

export const uploadMultiple = async (images, folder) => {
  return Promise.all(images.map((img) => uploadImage(img, folder)));
};

export default cloudinary;
