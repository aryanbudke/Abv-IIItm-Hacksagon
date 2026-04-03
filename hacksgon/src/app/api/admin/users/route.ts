import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const { userId: callerId } = await auth();
    if (!callerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clerk = await clerkClient();

    const caller = await clerk.users.getUser(callerId);
    if ((caller.publicMetadata as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    const params: any = { limit, offset, orderBy: '-created_at' };
    if (search) params.query = search;

    const result = await clerk.users.getUserList(params);

    const users = result.data.map(u => ({
      id:        u.id,
      name:      [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unnamed',
      email:     u.emailAddresses[0]?.emailAddress || '',
      imageUrl:  u.imageUrl,
      role:      (u.publicMetadata as any)?.role || 'patient',
      createdAt: u.createdAt,
    }));

    return NextResponse.json({
      users,
      total: result.totalCount,
      page,
      limit,
      totalPages: Math.ceil(result.totalCount / limit),
    });
  } catch (error: any) {
    console.error('Error listing users:', error);
    return NextResponse.json({ error: error?.message || 'Failed to list users' }, { status: 500 });
  }
}
