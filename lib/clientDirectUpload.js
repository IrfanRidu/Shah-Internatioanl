// Batch 19 (R33-7): shared by both chat thread pages (app/(shop)/messages/[id]/page.jsx and
// app/admin/messages/[id]/page.jsx) so the upload flow can't drift between the two. See
// app/api/upload/sign/route.js for the server side (why this exists / why the existing
// app/api/upload/route.js can't be reused for large files) and the full design note in
// AGENT_PROGRESS_19.md.
//
// 50MB is enforced here as OUR OWN ceiling. The actual result also depends on the Cloudinary
// account's own plan limits (free-tier accounts commonly cap images lower than that, while
// video/raw files are often allowed much higher even on free) — that's outside anything this code
// can inspect or control, so a Cloudinary-side rejection is still possible and is surfaced as a
// normal upload error rather than pretended away.
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

// A light safety denylist, not a strict allowlist — "secure...all types file" reasonably reads as
// broad support (images, PDFs, docs, spreadsheets, video, audio, archives, etc. all stay allowed),
// not "accept literally anything including files whose only real use is running code on whoever
// opens them."
const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.scr', '.com', '.jar', '.vbs', '.ps1'];

export function validateAttachment(file) {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" is too large — the limit is 50MB (this file is ${(file.size / (1024 * 1024)).toFixed(1)}MB).`;
  }
  const lower = file.name.toLowerCase();
  if (BLOCKED_EXTENSIONS.some(ext => lower.endsWith(ext))) {
    return `"${file.name}" can't be sent — executable files aren't allowed for security reasons.`;
  }
  return null; // valid
}

// Uploads `file` directly to Cloudinary (never through our own backend/Vercel's body-size limit —
// see the module comment above). `onProgress(fraction)` is called with a 0-1 value as the upload
// proceeds; XMLHttpRequest is used deliberately instead of fetch, since fetch has no reliably
// cross-browser upload-progress event and a 50MB file can genuinely take a while on a slow
// connection — a stalled-looking upload with zero feedback is a bad experience at that size.
export async function uploadAttachmentDirect(file, { folder = 'chat-attachments', onProgress } = {}) {
  const sigRes = await fetch('/api/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  });
  const sigData = await sigRes.json();
  if (!sigData.success) throw new Error(sigData.message || 'Could not start upload');
  const { signature, timestamp, cloudName, apiKey } = sigData;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', folder);

  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Upload failed — unexpected response')); }
      } else {
        // Cloudinary's own error body (e.g. an account-level size/plan limit) — surfaced as-is
        // rather than a generic message, since it's often the actionable, specific reason.
        try {
          const parsed = JSON.parse(xhr.responseText);
          reject(new Error(parsed?.error?.message || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
    xhr.send(formData);
  });

  return { url: result.secure_url, name: file.name, type: file.type || 'application/octet-stream', size: file.size };
}
