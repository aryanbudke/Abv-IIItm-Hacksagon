import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { clerkClient } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, mobile } = body;
    let { email } = body;

    if (!userId || !name || !email) {
      return NextResponse.json(
        { error: 'User ID, name, and email are required' },
        { status: 400 }
      );
    }

    // Normalize email to prevent case/space mismatches
    email = email.toLowerCase().trim();

    const supabase = createServerClient();

    // 1. First check if user exists by Clerk ID
    const { data: userById, error: selectByIdError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (selectByIdError) {
      console.error('User select-by-id error:', selectByIdError);
      return NextResponse.json({ error: selectByIdError.message }, { status: 500 });
    }

    if (userById) {
      // User exists with this ID - Update fields if needed
      // (We also update the email here in case it changed in Clerk)
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name,
          email, // Ensure email is in sync with Clerk in case it changed
          mobile: mobile || userById.mobile || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        // If updating email causes a conflict with ANOTHER user, ignore that part or handle it
        if (updateError.code === '23505' && updateError.message?.includes('users_email_key')) {
           console.warn(`User ${userId} tried to change email to ${email}, but that email is taken by another record.`);
           // Proceed with updating other fields
           await supabase
             .from('users')
             .update({ name, mobile: mobile || userById.mobile || null })
             .eq('id', userId);
        } else {
          console.error('User update error:', updateError);
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
      }
    } else {
      // 2. User NOT found by ID - Maybe they exist with this email under a different/placeholder ID?
      const { data: userByEmail, error: selectByEmailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (selectByEmailError) {
        console.error('User select-by-email error:', selectByEmailError);
        return NextResponse.json({ error: selectByEmailError.message }, { status: 500 });
      }

      if (userByEmail) {
        // Found matching email under a different ID - Fix the record by adopting the new Clerk ID
        const { error: patchIdError } = await supabase
          .from('users')
          .update({
            id: userId,
            name,
            mobile: mobile || userByEmail.mobile || null,
            updated_at: new Date().toISOString(),
          })
          .eq('email', email);

        if (patchIdError) {
          console.error('User ID patch error:', patchIdError);
          return NextResponse.json({ error: patchIdError.message }, { status: 500 });
        }
      } else {
        // 3. Truly new user - INSERT
        const patientId = `PAT${Date.now().toString().slice(-6)}`;
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: userId,
            name,
            email,
            patient_id: patientId,
            mobile: mobile || null,
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          // Final catch: if a race condition happened and email was inserted between check and now
          if (insertError.code === '23505' && insertError.message?.includes('users_email_key')) {
             // Try searching again or simply assume it's now fine since it's already there
             return NextResponse.json({ success: true, message: 'User already exists (race condition handled)' });
          }
          console.error('User insert error:', insertError);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
    }

    // Set Clerk role to "patient" if not already set
    try {
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);
      const existingRole = (clerkUser.publicMetadata as any)?.role;
      if (!existingRole) {
        await clerk.users.updateUserMetadata(userId, {
          publicMetadata: { role: 'patient' },
        });
      }
    } catch (clerkError) {
      console.warn('Post-user-ensure Clerk metadata update failed (non-critical):', clerkError);
    }

    return NextResponse.json({ success: true, message: 'User ensured successfully' });

  } catch (error: any) {
    console.error('Error ensuring user:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to ensure user' },
      { status: 500 }
    );
  }
}

