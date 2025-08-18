import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDatabase } from './mongodb';
import type { ReplaceObjectId, User } from './models/client';
import type { User as UserServer } from './models/server';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function convertServerToClient<T>(data: T): ReplaceObjectId<T> {
  if (data === null || data === undefined) {
    return data as any;
  }

  if (data instanceof ObjectId) {
    return data.toString() as any;
  }

  if (data instanceof Date) {
    return data.toISOString() as any;
  }

  if (Array.isArray(data)) {
    return data.map(item => convertServerToClient(item)) as any;
  }

  if (typeof data === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(data)) {
      converted[key] = convertServerToClient(value);
    }
    return converted;
  }

  return data as any;
}

export async function verifyPassword(
  password: string,
  dbPassword: string
): Promise<boolean> {
  return password === dbPassword;
}

export function generateToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

export async function verifyToken(
  token: string
): Promise<{ userId: string; role: string } | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: string;
    };
    return decoded;
  } catch {
    return null;
  }
}

export async function getCurrentUser(
  request?: NextRequest,
  tokenData?: string
): Promise<User | null> {
  try {
    let token;
    if (request) {
      token = request.cookies.get('token')?.value;
    } else if (tokenData) {
      token = tokenData;
    }

    if (!token) return null;

    const decoded = await verifyToken(token);
    if (!decoded) return null;

    const db = await getDatabase();
    const user = await db
      .collection<UserServer>('users')
      .findOne({ _id: new ObjectId(decoded.userId) });
    return user ? convertServerToClient(user) : null;
  } catch {
    return null;
  }
}
