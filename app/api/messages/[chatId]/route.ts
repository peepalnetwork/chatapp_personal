import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDatabase();

    // Verify user is participant in chat
    const chat = await db.collection('chats').findOne({
      _id: new ObjectId(params.chatId),
      participants: new ObjectId(currentUser._id)
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const messages = await db
      .collection('messages')
      .aggregate([
        {
          $match: { chatId: new ObjectId(params.chatId) }
        },
        {
          $sort: { timestamp: 1 }
        },
        {
          $lookup: {
            from: 'users', // collection name
            localField: 'sender', // field in messages
            foreignField: '_id', // field in users
            as: 'sender'
          }
        },
        {
          $unwind: '$sender'
        },
        {
          $addFields: {
            sender: {
              _id: '$sender._id',
              username: '$sender.username'
            }
          }
        }
      ])
      .toArray();

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
