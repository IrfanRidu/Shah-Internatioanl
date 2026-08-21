import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadImage } from '@/lib/cloudinary';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

// Folders that require admin access
const ADMIN_ONLY_FOLDERS = ['products', 'banners', 'branding', 'letterheads', 'shipment-docs', 'incentive-applications'];

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Please login' }, { status: 401 });

    const body = await request.json();
    const { image, folder, name } = body;
    if (!image) return NextResponse.json({ success: false, message: 'No image provided' }, { status: 400 });

    const isAdmin = ['superAdmin', 'admin', 'editor'].includes(session.user.role);
    const isAdminFolder = ADMIN_ONLY_FOLDERS.some(f => (folder || '').includes(f));

    if (isAdminFolder && !isAdmin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    // Issue 3 (SEO): optional — callers pass whatever title/name field the admin has already typed
    // (product name, banner title, category name) so the uploaded image gets a descriptive URL slug
    // instead of a random one. Safe to omit; uploadImage() falls back to Cloudinary's normal random
    // public_id when there's nothing to work with yet.
    const result = await uploadImage(image, folder || 'shah-international', name || '');
    return NextResponse.json({ success: true, url: result.url, publicId: result.publicId });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
