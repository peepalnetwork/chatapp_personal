import { getCurrentUser } from '@/lib/auth';
import { Chat, Message } from '@/lib/models/server';
import { getDatabase } from '@/lib/mongodb';
import { existsSync, unlinkSync } from 'fs';
import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDatabase();
    const chatId = new ObjectId(params.id);
    const messagesWithImages = await db
      .collection<Message>('messages')
      .find({
        image: {
          $exists: true
        }
      })
      .toArray();

    for (const msg of messagesWithImages) {
      if (msg.image?.imageUrl) {
        const filePath = path.join(
          process.cwd(),
          'uploads',
          'images',
          msg.image.filename
        );
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      }
    }
    await db.collection<Message>('messages').deleteMany({ chatId });
    await db.collection<Chat>('chats').deleteOne({ _id: chatId });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Admin DELETE chat error:', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
