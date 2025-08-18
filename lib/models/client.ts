import type { ObjectId } from 'mongodb';
import type {
  User as ServerUser,
  Chat as ServerChat,
  Message as ServerMessage,
  SystemSettings as ServerSystemSettings
} from './server';

// Utility: Replace ObjectId recursively with string, optionally convert dates
export type ReplaceObjectId<
  T,
  ConvertDates extends boolean = true
> = T extends ObjectId
  ? string
  : T extends ObjectId[]
  ? string[]
  : T extends Date
  ? ConvertDates extends true
    ? string
    : Date
  : T extends (infer U)[]
  ? ReplaceObjectId<U, ConvertDates>[]
  : T extends object
  ? {
      [K in keyof T]: ReplaceObjectId<T[K], ConvertDates>;
    }
  : T;

// ✅ These are pure client types
export type User = ReplaceObjectId<ServerUser>;
export type Chat = ReplaceObjectId<ServerChat>;
export type Message = ReplaceObjectId<ServerMessage>;
export type SystemSettings = ReplaceObjectId<ServerSystemSettings>;
