import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

type ClerkUserEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    first_name: string | null;
    last_name: string | null;
    phone_numbers: { phone_number: string }[];
    image_url: string;
    public_metadata: Record<string, unknown>;
    deleted?: boolean;
  };
};

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('CLERK_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  // Get Svix headers for verification
  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // Verify the webhook signature
  const payload = await req.text();
  const wh = new Webhook(webhookSecret);

  let event: ClerkUserEvent;
  try {
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserEvent;
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  const supabase = createServerClient();

  if (event.type === 'user.created' || event.type === 'user.updated') {
    const { id, email_addresses, first_name, last_name, phone_numbers } = event.data;

    const primaryEmail = email_addresses[0]?.email_address ?? '';
    const name = [first_name, last_name].filter(Boolean).join(' ') || primaryEmail.split('@')[0];
    const mobile = phone_numbers[0]?.phone_number ?? null;
    const patientId = `PAT${Date.now().toString().slice(-6)}`;

    const { error } = await supabase.from('users').upsert(
      {
        id,
        name,
        email: primaryEmail,
        mobile,
        patient_id: patientId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'id',
        ignoreDuplicates: false,
      }
    );

    if (error) {
      console.error(`Failed to upsert user on ${event.type}:`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`User ${id} synced to database (${event.type})`);
  }

  if (event.type === 'user.deleted') {
    const { id } = event.data;
    // Soft-delete: just log it. Uncomment below for hard delete.
    // const { error } = await supabase.from('users').delete().eq('id', id);
    console.log(`User ${id} deleted in Clerk — no action taken in DB`);
  }

  return NextResponse.json({ success: true });
}
