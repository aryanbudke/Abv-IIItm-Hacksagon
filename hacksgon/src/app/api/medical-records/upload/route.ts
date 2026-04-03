import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient } from '@/lib/supabase/server';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// POST /api/medical-records/upload — upload file to Supabase Storage, return signed URL
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only PDF, JPG, PNG, and WebP files are allowed' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File must be under 10 MB' }, { status: 400 });
    }

    const ext = file.name.split('.').pop();
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `${userId}/${uniqueName}`;

    const supabase = createServerClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('medical-records')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Signed URL valid for 10 years
    const { data: signedData, error: signedError } = await supabase.storage
      .from('medical-records')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

    if (signedError || !signedData) {
      return NextResponse.json({ error: 'Failed to generate file URL' }, { status: 500 });
    }

    const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';

    return NextResponse.json({
      file_url: signedData.signedUrl,
      file_type: fileType,
      file_name: uniqueName,
      original_name: file.name,
    });
  } catch (err: any) {
    console.error('[medical-records upload]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
