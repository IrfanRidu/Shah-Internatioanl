/**
 * Resizes and compresses an image file in the browser before uploading.
 *
 * This exists because phone camera photos are commonly 3–8MB; base64-encoding
 * them for the JSON upload body can exceed request size limits and cause the
 * upload to silently fail (the most common real-world cause of "uploading
 * photo failed" reports). Shrinking client-side first keeps every upload
 * small and fast, and avoids ever needing to debug platform-specific body
 * size limits.
 *
 * @param {File} file
 * @param {Object} opts
 * @param {number} [opts.maxDimension=1200] - max width/height in pixels
 * @param {number} [opts.quality=0.82] - JPEG quality 0-1
 * @returns {Promise<string>} a base64 data URL, ready to send to /api/upload
 */
export function resizeImageFile(file, { maxDimension = 1200, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select an image file'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load the image'));
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG compresses far better than PNG for photos; transparent PNGs
        // (logos, icons) are preserved as PNG so they don't lose transparency.
        const isPng = file.type === 'image/png';
        const mime = isPng ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mime, isPng ? undefined : quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
