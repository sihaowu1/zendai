import mongoose from 'mongoose';
import { config, mongoConfigured } from '../config';
import { log } from '../utils/logger';

/** Connect to MongoDB if configured. Fails gracefully when URI is empty. */
export async function connectMongo(): Promise<void> {
  if (!mongoConfigured) {
    log('mongo', 'No MONGODB_URI configured — marketplace features disabled');
    return;
  }
  try {
    await mongoose.connect(config.mongo.uri);
    log('mongo', 'Connected to MongoDB');
  } catch (err) {
    log('mongo', `Failed to connect to MongoDB: ${(err as Error).message}`);
  }
}

/** Whether Mongoose has an active connection. */
export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
