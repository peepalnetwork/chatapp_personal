import { NextResponse, type NextRequest } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';
import { rm } from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { Chat, Message } from '@/lib/models/server';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDatabase();
    const chats = await db
      .collection<Chat>('chats')
      .aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'participants',
            foreignField: '_id',
            as: 'participantsUsers',
            pipeline: [{ $project: { username: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'messages',
            localField: 'lastMessageId',
            foreignField: '_id',
            as: 'lastMessage'
          }
        },
        {
          $project: {
            type: 1,
            name: 1,
            createdAt: 1,
            lastMessage: { $arrayElemAt: ['$lastMessage', 0] },
            participantsUsers: 1
          }
        },
        { $sort: { 'lastMessage.timestamp': -1, createdAt: -1 } }
      ])
      .toArray();

    const mapped = chats.map((c: any) => ({
      _id: c._id.toString(),
      type: c.type,
      name: c.name,
      createdAt: c.createdAt,
      lastMessage: c.lastMessage,
      participants: (c.participantsUsers || []).map((u: any) => ({
        _id: u._id.toString(),
        username: u.username
      }))
    }));

    return NextResponse.json(mapped);
  } catch (e) {
    console.error('Admin GET chats error:', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all');

    if (all) {
      const db = await getDatabase();

      const uploadDir = path.join(process.cwd(), 'uploads', 'images');
      if (existsSync(uploadDir)) {
        rmSync(uploadDir, { recursive: true, force: true });
      }

      await db.collection<Message>('messages').deleteMany({});
      await db.collection<Chat>('chats').deleteMany({});
      return NextResponse.json({ success: true, deletedAll: true });
    }

    return NextResponse.json({ error: 'Missing parameter' }, { status: 400 });
  } catch (e) {
    console.error('Admin DELETE chats error:', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
