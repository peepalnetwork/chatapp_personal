import type { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  username: string;
  password: string;
  role: 'admin' | 'user';
  lastSeen: Date;
  createdAt: Date;
}

export interface Chat {
  _id?: ObjectId;
  type: 'individual' | 'group';
  name?: string; // For group chats
  participants: ObjectId[];
  createdBy: ObjectId;
  createdAt: Date;
  lastMessageId?: ObjectId;
}

export interface Message {
  _id?: ObjectId;
  chatId: ObjectId;
  sender: ObjectId;
  content: string;
  type: 'text' | 'image';
  image?: {
    imageUrl: string;
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
  };
  timestamp: Date;
  readBy: {
    userId: ObjectId;
    readAt: Date;
  }[];
}

export interface SystemSettings {
  _id?: ObjectId;
  autoDeletionDays: number;
  updatedAt: Date;
  updatedBy: ObjectId;
}
