import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import cloudinary from '@/lib/cloudinary';

// Force dynamic rendering — reads live session data on every request.
export const dynamic = 'force-dynamic';

// Batch 19 (R33-7): direct-to-Cloudinary signed upload. The existing app/api/upload/route.js
// accepts a base64 image inside a JSON request body — that CANNOT be reused for chat attachments,
// because Vercel serverless functions (standard Node runtime) have a hard, non-configurable 4.5MB
// request body cap, and base64 adds ~33% overhead on top of the real file size. A 50MB file would
// need a ~66MB request body — nowhere close to fitting.
//
// This route's only job is generating a short-lived, cryptographically signed upload credential.
// The actual file bytes never pass through this backend (or Vercel's body limit) at all — the
// browser POSTs the file directly to Cloudinary's own upload endpoint using this signature. See
// lib/clientDirectUpload.js for the client side of this flow.
//
// Gated behind ANY authenticated session (not admin-only, unlike ADMIN_ONLY_FOLDERS in the
// existing /api/upload route) — customers need to attach files to chat messages too. This, plus
// the signature itself being short-lived and server-generated, is what makes the upload "secure":
// a stranger can't upload directly into this Cloudinary account without first authenticating
// through our own session system.
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Please login' }, { status: 401 });

    const { folder = 'chat-attachments' } = await request.json().catch(() => ({}));
    const timestamp = Math.round(Date.now() / 1000);
    // Only params actually sent to Cloudinary need to be part of the signature — folder and
    // timestamp are the only two this flow uses.
    const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, process.env.CLOUDINARY_API_SECRET);

    return NextResponse.json({
      success: true,
      signature,
      timestamp,
      folder,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
