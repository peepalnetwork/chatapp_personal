import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/mongodb';
import type { User } from '@/lib/models/server';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDatabase();
    const users = await db
      .collection<User>('users')
      .find({
        _id: {
          $ne: new ObjectId(currentUser._id)
        },
        role: {
          $ne: 'admin'
        }
      })
      .toArray();

    return NextResponse.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
