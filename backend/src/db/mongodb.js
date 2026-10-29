import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let isConnected = false;

export async function connectMongoDB() {
  if (isConnected) return mongoose.connection;

  const uri = env.MONGODB_URI ? env.MONGODB_URI.trim() : '';
  if (!uri) {
    logger.warn('⚠️ MONGODB_URI is not set in backend/.env. Please provide your MongoDB connection string (e.g., mongodb+srv://... or mongodb://localhost:27017/ai-calendar) to persist XP, leveling, and tasks consistently across devices.');
    return null;
  }

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      autoIndex: true,
    });

    isConnected = true;
    logger.info('🍃 Connected to MongoDB successfully. Multi-device persistence is active!');

    // Initialize/seed default jobs if empty
    await seedDefaultJobsIfEmpty();

    return mongoose.connection;
  } catch (err) {
    isConnected = false;
    logger.error(`❌ Failed to connect to MongoDB (${err.message}). Check your MONGODB_URI connection string in backend/.env.`);
    return null;
  }
}

export function isMongoConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

// Default Jobs Seed
export async function seedDefaultJobsIfEmpty() {
  try {
    const { Context } = await import('../models/Context.js');
    const count = await Context.countDocuments();
    if (count === 0) {
      const defaults = [
        {
          name: 'Job A',
          color: '#3b82f6',
          icon: 'briefcase',
          isDefault: true,
          workingHours: { start: '09:00', end: '13:00', days: [1, 2, 3, 4, 5] },
          sortOrder: 1,
        },
        {
          name: 'Job B',
          color: '#8b5cf6',
          icon: 'laptop',
          isDefault: false,
          workingHours: { start: '13:30', end: '17:30', days: [1, 2, 3, 4, 5] },
          sortOrder: 2,
        },
        {
          name: 'Side Projects',
          color: '#10b981',
          icon: 'sparkles',
          isDefault: false,
          workingHours: { start: '18:00', end: '20:00', days: [1, 2, 3, 4, 5] },
          sortOrder: 3,
        },
        {
          name: 'Personal',
          color: '#f59e0b',
          icon: 'user',
          isDefault: false,
          workingHours: { start: '07:00', end: '22:00', days: [0, 1, 2, 3, 4, 5, 6] },
          sortOrder: 4,
        },
      ];

      await Context.insertMany(defaults);
      logger.info('✨ Seeded default jobs (Job A, Job B, Side Projects, Personal) directly into MongoDB.');
    }
  } catch (err) {
    logger.warn('Failed to seed default jobs in MongoDB:', err.message);
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  logger.warn('⚠️ MongoDB connection lost.');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  logger.info('🍃 MongoDB connection re-established.');
});
