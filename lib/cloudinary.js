import { v2 as cloudinary } from 'cloudinary';
import { generateSlug } from './utils';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Per-folder transform presets — resize + compress every image to a fixed canvas so storage stays
// lean and all cards/banners are always the same size. IMPORTANT: only use this for folders that are
// ALWAYS photos. 'shipment-docs' deliberately has NO preset entry — it accepts PDFs as well as
// images (the shipment editor's "Upload Document (PDF/Image)" field), and forcing every upload
// there through an image `fetch_format` conversion (as this used to do, forcing webp) would silently
// re-encode/corrupt any PDF into an invalid file — which is exactly why "All Documents" merges
// (issue 11) were silently dropping every uploaded attachment: pdf-lib couldn't parse the corrupted
// result and the per-attachment try/catch quietly skipped it.
const PRESETS = {
  products:     { width: 800,  height: 800,  crop: 'fill', quality: 75,  format: 'webp' },
  banners:      { width: 1400, height: 560,  crop: 'fill', quality: 80,  format: 'webp' },
  avatars:      { width: 200,  height: 200,  crop: 'fill', quality: 80,  format: 'webp' },
  branding:     { width: 600,  height: 300,  crop: 'fit',  quality: 90,  format: 'webp' },
  // Issue 9 (R24): the letterhead is now drawn as the actual PDF page background (see
  // lib/pdfLetterhead.js), not squeezed into a small header band, so it needs real print
  // resolution and can be ANY aspect ratio (a wide banner graphic or a tall/full-page template
  // image) -- crop:'limit' only ever scales DOWN an oversized upload and never crops or forces a
  // fixed box, so nothing is distorted or cut off. ~2480x3508 is A4 at 300dpi, a generous ceiling
  // for a letterhead graphic; quality 95 keeps it visually lossless for print.
  letterheads:  { width: 2480, height: 3508, crop: 'limit', quality: 95,  format: 'webp' },
  default:      { width: 1200, quality: 80,  format: 'webp' },
};
// Folders whose uploads must be stored byte-for-byte as uploaded — no format/quality transform at
// all — because they can contain non-image files (PDFs) that a forced image conversion would corrupt.
const NO_TRANSFORM_FOLDERS = ['shipment-docs'];

export const uploadImage = async (base64Image, folder = 'shah-international', seoName = '') => {
  const isDocumentFolder = NO_TRANSFORM_FOLDERS.some(f => folder.includes(f));
  const key = Object.keys(PRESETS).find(k => folder.includes(k)) || 'default';
  const preset = PRESETS[key];

  // Issue 3 (SEO): a descriptive public_id turns the final image URL from a random hash
  // (".../products/xk3n9f8s2j.webp") into something readable and indexable
  // (".../products/fresh-alphonso-mango-ky3f8a2b.webp"). Only kicks in when the caller has a name to
  // work with (e.g. the admin form passes its Name/Title field at upload time) — falls back to
  // Cloudinary's own random public_id otherwise, so nothing changes for call sites that don't pass
  // one (shipment docs, letterheads, incentive attachments — internal-only, no public SEO value).
  // Can't rename an image already uploaded under the old random naming without re-uploading it, so
  // this only affects new uploads going forward, not the existing catalog.
  const slug = seoName ? generateSlug(String(seoName)).slice(0, 60) : '';
  const publicId = slug ? `${slug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` : undefined;

  const transformations = isDocumentFolder
    ? { folder, resource_type: 'auto', ...(publicId && { public_id: publicId }) } // no format/quality override — preserve the original file exactly
    : {
        folder,
        resource_type: 'auto',
        quality: preset.quality ?? 80,
        fetch_format: preset.format ?? 'webp',
        ...(preset.width  && { width:  preset.width  }),
        ...(preset.height && { height: preset.height }),
        ...(preset.crop   && { crop:   preset.crop   }),
        ...(publicId && { public_id: publicId }),
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
