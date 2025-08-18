import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth'; // Adjust import path as needed
import { getDatabase } from '@/lib/mongodb'; // Adjust import path as needed
import { ObjectId } from 'mongodb';

interface Chat {
  type: 'direct' | 'group';
  name?: string;
  participants: ObjectId[];
  createdBy: ObjectId;
  createdAt: Date;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDatabase();
    const chats = await db
      .collection('chats')
      .aggregate([
        {
          $match: {
            participants: new ObjectId(currentUser._id)
          }
        },
        {
          $sort: {
            'lastMessage.timestamp': -1
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
          $lookup: {
            from: 'users',
            localField: 'participants',
            foreignField: '_id',
            as: 'participantUsers'
          }
        },
        {
          $project: {
            _id: 1,
            lastMessage: { $arrayElemAt: ['$lastMessage', 0] },
            participantUsers: {
              $map: {
                input: '$participantUsers',
                as: 'user',
                in: {
                  _id: { $toString: '$$user._id' },
                  username: '$$user.username'
                }
              }
            },
            participants: 1,
            type: 1,
            name: 1
          }
        }
      ])
      .toArray();

    return NextResponse.json(chats);
  } catch (error) {
    console.error('Get chats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, participants, name } = await request.json();

    // Validate group chat constraints
    if (type === 'group' && participants.length > 15) {
      return NextResponse.json(
        { error: 'Group chat cannot have more than 15 participants' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const participantObjectIds = participants.map(
      (id: string) => new ObjectId(id)
    );
    const allParticipants = [
      new ObjectId(currentUser._id),
      ...participantObjectIds
    ];

    const newChat: Chat = {
      type,
      name,
      participants: allParticipants,
      createdBy: new ObjectId(currentUser._id),
      createdAt: new Date()
    };

    const result = await db.collection('chats').insertOne(newChat);
    const [chat] = await db
      .collection('chats')
      .aggregate([
        {
          $match: {
            _id: result.insertedId
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'participants',
            foreignField: '_id',
            as: 'participantUsers'
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
            _id: 1,
            createdAt: 1,
            lastMessage: { $arrayElemAt: ['$lastMessage', 0] },
            participantUsers: {
              $map: {
                input: '$participantUsers',
                as: 'user',
                in: {
                  _id: { $toString: '$$user._id' },
                  username: '$$user.username'
                }
              }
            },
            participants: 1,
            type: 1,
            name: 1,
            createdBy: 1
          }
        }
      ])
      .toArray();

    return NextResponse.json(chat);
  } catch (error) {
    console.error('Create chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
