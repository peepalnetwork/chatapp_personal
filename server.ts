import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';

import { ObjectId } from 'mongodb';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const dev = process.env.NODE_ENV !== 'production';

let allowedIPs: string[] = [];
const app = next({ dev });

const handler = app.getRequestHandler();

// In-memory presence tracking
const onlineUsers = new Set<string>();
const socketToUser = new Map<string, string>();
const userToSockets = new Map<string, Set<string>>();
const userConnectionCount = new Map<string, number>();

async function getDatabase() {
  return (await import('./lib/mongodb')).getDatabase();
}

const uploadsDir = path.join(process.cwd(), 'uploads');

app.prepare().then(() => {
  const port = +(process.env.PORT || 3000);

  const getAllowedIPs = (): string[] => {
    const allowedIPs = process.env.ALLOWED_IPS;
    if (!allowedIPs) {
      console.warn(
        'ALLOWED_IPS not set in environment variables. All IPs will be allowed.'
      );
      return [];
    }
    return allowedIPs
      .split(',')
      .map(ip => ip.trim())
      .filter(ip => ip.length > 0);
  };

  if (!allowedIPs) allowedIPs = getAllowedIPs();

  const isIPAllowed = (
    clientIP: string,
    allowedIPs: string[]
  ): { allowed: boolean; normalizedIP?: string } => {
    if (allowedIPs.length === 0)
      return {
        allowed: true
      };

    const normalizedIP = clientIP.replace(/^::ffff:/, '');

    return {
      allowed: allowedIPs.some(allowedIP => {
        if (normalizedIP === allowedIP) return true;

        if (allowedIP.includes('/')) {
          const [network, prefixLength] = allowedIP.split('/');
          const prefix = parseInt(prefixLength, 10);

          if (network.includes('.') && normalizedIP.includes('.')) {
            const networkParts = network.split('.').map(Number);
            const ipParts = normalizedIP.split('.').map(Number);

            const networkInt =
              (networkParts[0] << 24) +
              (networkParts[1] << 16) +
              (networkParts[2] << 8) +
              networkParts[3];
            const ipInt =
              (ipParts[0] << 24) +
              (ipParts[1] << 16) +
              (ipParts[2] << 8) +
              ipParts[3];
            const mask = ~((1 << (32 - prefix)) - 1);

            return (networkInt & mask) === (ipInt & mask);
          }
        }

        return false;
      }),
      normalizedIP
    };
  };

  const httpServer = createServer(async (req, res) => {
    const clientIP =
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any).socket?.remoteAddress ||
      '';
    const actualIP = Array.isArray(clientIP)
      ? clientIP[0]
      : clientIP.split(',')[0].trim();
    const { allowed, normalizedIP } = isIPAllowed(actualIP, allowedIPs);

    if (!allowed) {
      console.log(`Blocked request from IP: ${normalizedIP}`);
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain');
      res.end(`Access denied: IP - ${normalizedIP} not whitelisted`);
      return;
    }

    if (req.url?.startsWith('/uploads/')) {
      const filePath = path.join(uploadsDir, req.url.replace('/uploads/', ''));

      // Basic directory traversal protection
      if (!filePath.startsWith(uploadsDir)) {
        res.statusCode = 403;
        return res.end('Access denied');
      }

      // Check for file existence
      const data = await readFile(filePath);

      // Set appropriate content-type header based on file extension (optional)
      // e.g. image/jpeg, image/png, etc.
      // You can use a simple mapping or a package like 'mime-types' to get the content-type
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/jpeg'); // adjust as needed or detect dynamically
      return res.end(data);
    }

    handler(req, res);
  });

  const io = new Server(httpServer);

  io.on('connection', socket => {
    socket.on('join-chat', (chatId: string) => {
      socket.join(chatId);
    });

    socket.on('leave-chat', (chatId: string) => {
      socket.leave(chatId);
    });

    socket.on('send-message', async data => {
      try {
        const db = await getDatabase();
        const message = {
          chatId: new ObjectId(data.chatId as string),
          sender: new ObjectId(data.sender as string),
          content: data.content,
          type: data.type,
          image: data.image,
          timestamp: new Date(),
          readBy: [
            {
              userId: new ObjectId(data.sender as string),
              readAt: new Date()
            }
          ]
        };

        const result = await db.collection('messages').insertOne(message);
        // Fetch the full message including readBy
        const newMessage = await db
          .collection('messages')
          .aggregate([
            { $match: { _id: result.insertedId } },
            {
              $lookup: {
                from: 'users',
                localField: 'sender',
                foreignField: '_id',
                as: 'sender'
              }
            },
            { $unwind: '$sender' },
            {
              $addFields: {
                sender: {
                  _id: '$sender._id',
                  username: '$sender.username'
                }
              }
            }
          ])
          .next();

        // Update chat's lastMessage with full message including readBy
        await db.collection('chats').updateOne(
          { _id: new ObjectId(data.chatId as string) },
          {
            $set: {
              lastMessageId: result.insertedId
            }
          }
        );

        io.to(data.chatId).emit('new-message', newMessage);
        const [chat] = await db
          .collection('chats')
          .aggregate([
            {
              $match: {
                _id: new ObjectId(data.chatId as string)
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
        const participantIds = chat.participantUsers.map((p: any) => p._id);
        participantIds.forEach((participantId: string) => {
          const userSockets = userToSockets.get(participantId);
          if (userSockets && userSockets.size > 0) {
            userSockets.forEach(socketId => {
              io.to(socketId).emit(
                'chat-last-message-updated',
                chat,
                data.sender
              );
            });
          }
        });
      } catch (error) {
        console.error('Error sending message:', error);
      }
    });

    socket.on('mark-read', async data => {
      try {
        const readAt = new Date();
        const db = await getDatabase();

        await (db.collection('messages') as any).updateMany(
          {
            chatId: new ObjectId(data.chatId as string),
            'readBy.userId': { $ne: new ObjectId(data.userId as string) }
          },
          {
            $push: {
              readBy: {
                userId: new ObjectId(data.userId as string),
                readAt
              }
            }
          }
        );
        const [chat] = await db
          .collection('chats')
          .aggregate([
            {
              $match: {
                _id: new ObjectId(data.chatId as string)
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

        io.to(data.chatId).emit(
          'messages-read',
          {
            userId: data.userId,
            chatId: data.chatId,
            readAt
          },
          chat
        );
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // Handle chat creation notification from client
    socket.on('chat-created', data => {
      const { chat, participantIds } = data;

      // Emit to all specified participants
      participantIds.forEach((participantId: string) => {
        const userSockets = userToSockets.get(participantId);
        if (userSockets && userSockets.size > 0) {
          userSockets.forEach(socketId => {
            io.to(socketId).emit('new-chat-created', chat);
          });
        } else {
          console.log(`No active sockets for user ${participantId}`);
        }
      });
    });

    socket.on('user-online', (userId: string) => {
      if (!userId) return;

      socketToUser.set(socket.id, userId);

      if (!userToSockets.has(userId)) {
        userToSockets.set(userId, new Set());
      }
      userToSockets.get(userId)!.add(socket.id);

      const count = (userConnectionCount.get(userId) || 0) + 1;
      userConnectionCount.set(userId, count);

      if (count === 1) {
        onlineUsers.add(userId);
        io.emit('user-status-change', { userId, isOnline: true });
      }
    });

    socket.on('get-presence', () => {
      socket.emit('presence-state', { userIds: Array.from(onlineUsers) });
    });

    socket.on('chat-deleted', data => {
      const { participants, chatId, all } = data;

      if (all) {
        socket.emit('delete-client-chats', { all });
      } else {
        participants.forEach((participantId: string) => {
          const userSockets = userToSockets.get(participantId);
          if (userSockets && userSockets.size > 0) {
            userSockets.forEach(socketId => {
              io.to(socketId).emit('delete-client-chats', { chatId });
            });
          }
        });
      }
    });

    socket.on('disconnect', () => {
      const userId = socketToUser.get(socket.id);
      if (userId) {
        socketToUser.delete(socket.id);

        const userSockets = userToSockets.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            userToSockets.delete(userId);
          }
        }

        const count = (userConnectionCount.get(userId) || 1) - 1;
        if (count <= 0) {
          userConnectionCount.delete(userId);
          if (onlineUsers.delete(userId)) {
            io.emit('user-status-change', { userId, isOnline: false });
          }
        } else {
          userConnectionCount.set(userId, count);
        }
      }
    });
  });
  // import { getDatabase } from './lib/mongodb';
  // import { initCron } from './scripts/cron-manager';
  // import { initializeDatabase } from './scripts/init-database';
  import('./scripts/init-database').then(({ initializeDatabase }) => {
    initializeDatabase();
  });
  import('./scripts/cron-manager').then(({ initCron }) => {
    initCron();
  });

  httpServer
    .once('error', err => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(
        `> Server listening at http://localhost:${port} as ${
          dev ? 'development' : process.env.NODE_ENV
        }`
      );
    });
});
``;
