import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDatabase } from './mongodb';
import type { User } from './models';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
      .collection<User>('users')
      .findOne({ _id: new ObjectId(decoded.userId) });
    console.log('from server', user);
    return JSON.parse(JSON.stringify(user));
  } catch {
    return null;
  }
}
