import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function initializeDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('chatSystem');

    const found = await db.collection('users').findOne({ username: 'admin' });
    if (found._id) {
      console.log('Database already initialized');
      return await client.close();
    }

    // Create collections
    await db.createCollection('users');
    await db.createCollection('chats');
    await db.createCollection('messages');
    await db.createCollection('systemSettings');

    // Create indexes
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('chats').createIndex({ participants: 1 });
    await db.collection('messages').createIndex({ chatId: 1, timestamp: 1 });

    // Create default admin user
    const password = 'admin123';
    await db.collection('users').insertOne({
      username: 'admin',
      password: password,
      role: 'admin',
      isOnline: false,
      lastSeen: new Date(),
      createdAt: new Date()
    });

    // Create default system settings
    await db.collection('systemSettings').insertOne({
      autoDeletionDays: 15,
      updatedAt: new Date(),
      updatedBy: null
    });

    console.log('Database initialized successfully');
    console.log(
      'Default admin user created: username=admin, password=admin123'
    );
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await client.close();
  }
}

initializeDatabase();
