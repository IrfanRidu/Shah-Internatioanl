import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadImage } from '@/lib/cloudinary';

// Folders that require admin access
const ADMIN_ONLY_FOLDERS = ['products', 'banners', 'branding', 'letterheads', 'shipment-docs'];

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Please login' }, { status: 401 });

    const body = await request.json();
    const { image, folder } = body;
    if (!image) return NextResponse.json({ success: false, message: 'No image provided' }, { status: 400 });

    const isAdmin = ['superAdmin', 'admin', 'editor'].includes(session.user.role);
    const isAdminFolder = ADMIN_ONLY_FOLDERS.some(f => (folder || '').includes(f));

    if (isAdminFolder && !isAdmin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const result = await uploadImage(image, folder || 'shah-international');
    return NextResponse.json({ success: true, url: result.url, publicId: result.publicId });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
