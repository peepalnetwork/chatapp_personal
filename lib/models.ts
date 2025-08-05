import type { ObjectId } from "mongodb"

export interface User {
  _id?: ObjectId
  username: string
  password: string
  role: "admin" | "user"
  isOnline: boolean
  lastSeen: Date
  createdAt: Date
}

export interface Chat {
  _id?: ObjectId
  type: "individual" | "group"
  name?: string // For group chats
  participants: ObjectId[]
  createdBy: ObjectId
  createdAt: Date
  lastMessage?: {
    content: string
    sender: ObjectId
    timestamp: Date
  }
}

export interface Message {
  _id?: ObjectId
  chatId: ObjectId
  sender: ObjectId
  content: string
  type: "text" | "image"
  imageUrl?: string
  timestamp: Date
  readBy: {
    userId: ObjectId
    readAt: Date
  }[]
}

export interface SystemSettings {
  _id?: ObjectId
  autoDeletionDays: 10 | 15
  updatedAt: Date
  updatedBy: ObjectId
}
