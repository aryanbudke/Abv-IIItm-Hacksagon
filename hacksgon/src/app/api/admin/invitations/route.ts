import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

/**
 * Admin-only endpoint: Check for existing invitations or users by email.
 * This is used to display the "Account Status" in the Doctor Management dashboard.
 */
export async function GET(request: NextRequest) {
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

    const emailsParam = request.nextUrl.searchParams.get('emails');
    const singleEmail = request.nextUrl.searchParams.get('email');
    
    const emails = emailsParam 
      ? emailsParam.split(',').map(e => e.trim()).filter(Boolean)
      : singleEmail ? [singleEmail.trim()] : [];

    if (emails.length === 0) {
      return NextResponse.json({});
    }

    // 1. Check which users already exist in Clerk (Batch)
    // Clerk's getUserList supports max 100 emails usually, 
    // but for our dashboard pages (10-20 items) it's perfect.
    const users = await clerk.users.getUserList({ emailAddress: emails, limit: 100 });
    
    // 2. Fetch all invitations (we filter them locally)
    // Note: getInvitationList returns pending by default.
    const invitations = await clerk.invitations.getInvitationList();

    // 3. Build a map of results
    const results: Record<string, any> = {};

    for (const email of emails) {
      // Find user
      const user = users.data.find(u => 
        u.emailAddresses.some(e => e.emailAddress.toLowerCase() === email.toLowerCase())
      );

      if (user) {
        results[email] = {
          status: 'active',
          userId: user.id,
          message: 'User already has a Clerk account.',
        };
        continue;
      }

      // Find invitation
      const invitation = invitations.data.find(inv => 
        inv.emailAddress.toLowerCase() === email.toLowerCase()
      );

      if (invitation) {
        results[email] = {
          status: invitation.status,
          invitationId: invitation.id,
          createdAt: invitation.createdAt,
          message: `Invitation status: ${invitation.status}`,
        };
      } else {
        results[email] = {
          status: 'none',
          message: 'No invitation or account found for this email.',
        };
      }
    }

    // If it was a single email request, return the object directly for backward compatibility
    if (singleEmail && !emailsParam) {
      return NextResponse.json(results[singleEmail.trim()]);
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error fetching invitation status:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch invitation status' },
      { status: 500 }
    );
  }
}
