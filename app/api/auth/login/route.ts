import { type NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { verifyPassword, generateToken } from '@/lib/auth';
import type { User } from '@/lib/models';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const db = await getDatabase();
    const user = await db.collection<User>('users').findOne({ username });

    if (!user || !(await verifyPassword(password, user.password))) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update user online status
    await db
      .collection('users')
      .updateOne(
        { _id: user._id },
        { $set: { isOnline: true, lastSeen: new Date() } }
      );

    const token = generateToken(user._id!.toString(), user.role);

    const response = NextResponse.json({
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 9 * 60 * 60 // 9 hours
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
