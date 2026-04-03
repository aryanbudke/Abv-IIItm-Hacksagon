import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

// Admin-only endpoint: assign a role to a user identified by email.
// Called when an admin registers a doctor.
export async function POST(request: NextRequest) {
  try {
    const { userId: callerId } = await auth();
    if (!callerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify caller is an admin
    const clerk = await clerkClient();
    const caller = await clerk.users.getUser(callerId);
    if ((caller.publicMetadata as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, role, resend } = await request.json();
    if (!email || !role) {
      return NextResponse.json({ error: 'email and role are required' }, { status: 400 });
    }
    if (!['patient', 'doctor', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const signUpUrl = `${origin}${process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up'}`;

    // Find the Clerk user by email
    const users = await clerk.users.getUserList({ emailAddress: [email] });
    if (users.totalCount === 0) {
      // If resend is requested, revoke any existing pending invitations first
      if (resend) {
        const invitations = await clerk.invitations.getInvitationList({ status: 'pending' });
        const existing = invitations.data.find(inv => inv.emailAddress === email);
        if (existing) {
          await clerk.invitations.revokeInvitation(existing.id);
        }
      }

      // Create a Clerk Invitation
      await clerk.invitations.createInvitation({
        emailAddress: email,
        publicMetadata: { role },
        redirectUrl: signUpUrl,
      });

      return NextResponse.json({
        success: true,
        invited: true,
        message: `Invitation sent to ${email}. Role will be assigned on sign-up.`,
      });
    }

    const targetUser = users.data[0];
    await clerk.users.updateUserMetadata(targetUser.id, {
      publicMetadata: { role },
    });

    return NextResponse.json({ success: true, message: `Role "${role}" assigned to ${email}` });
  } catch (error: any) {
    console.error('Error setting role:', error);
    return NextResponse.json({ error: error?.message || 'Failed to set role' }, { status: 500 });
  }
}
