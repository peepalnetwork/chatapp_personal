import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/mongodb';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { autoDeleteDays } = await request.json();

    const db = await getDatabase();

    const existingSettings = await db.collection('systemSettings').findOne({});
    if (!existingSettings) {
      await db.collection('systemSettings').insertOne({
        autoDeletionDays: autoDeleteDays,
        udpatedAt: new Date()
      });
    }

    if (existingSettings)
      await db.collection('systemSettings').updateOne(
        {
          _id: existingSettings?._id
        },
        {
          $set: {
            autoDeletionDays: autoDeleteDays,
            updatedAt: new Date()
          }
        }
      );

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('Auto deletion update failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDatabase();

    let existingSettings = await db.collection('systemSettings').findOne({});
    if (!existingSettings) {
      await db.collection('systemSettings').insertOne({
        autoDeletionDays: 10,
        udpatedAt: new Date()
      });
    }

    return NextResponse.json({
      autoDeletionDays: existingSettings?.autoDeletionDays ?? 10
    });
  } catch (error) {
    console.error('Auto deletion update failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
