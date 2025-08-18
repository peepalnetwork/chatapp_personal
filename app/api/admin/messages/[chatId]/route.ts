import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getCurrentUser } from '@/lib/auth';
import { Message } from '@/lib/models/server';
export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDatabase();
    const chat = await db
      .collection('chats')
      .findOne({ _id: new ObjectId(params.chatId) });
    if (!chat)
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

    const messages = await db
      .collection<Message>('messages')
      .find({ chatId: new ObjectId(params.chatId) })
      .sort({ timestamp: 1 })
      .toArray();

    const mapped = messages.map(m => ({
      _id: m._id.toString(),
      chatId: m.chatId.toString(),
      sender: m.sender.toString(),
      content: m.content,
      type: m.type,
      image: m.image,
      timestamp: m.timestamp,
      readBy: (m.readBy || []).map(r => ({
        userId: r.userId.toString(),
        readAt: r.readAt
      }))
    }));

    return NextResponse.json(mapped);
  } catch (e) {
    console.error('Admin GET messages error:', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
