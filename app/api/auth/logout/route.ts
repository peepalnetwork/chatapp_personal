import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (user) {
      const db = await getDatabase();
      await db
        .collection('users')
        .updateOne(
          { _id: user._id },
          { $set: { isOnline: false, lastSeen: new Date() } }
        );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: 'token',
      value: '',
      path: '/',
      expires: new Date(0)
    });
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
