/**
 * MongoDB Change Stream Sync Service
 *
 * Listens to EC2 MongoDB changes via Change Stream and replicates to local MongoDB.
 * This enables real-time sync without requiring EC2 to connect back to local.
 *
 * Usage:
 *   npx tsx scripts/mongo-change-sync.ts           # Start change stream listener
 *   npx tsx scripts/mongo-change-sync.ts --init    # Run initial full sync first
 */

import { MongoClient, ChangeStreamDocument, ChangeStream, Db, Document } from 'mongodb';

// Configuration from environment
const EC2_URI = process.env.MONGO_EC2_URI || 'mongodb://localhost:27019';
const LOCAL_URI = process.env.MONGO_LOCAL_URI || 'mongodb://localhost:27018';
const DB_NAME = 'orionld';

// Retry configuration
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

let ec2Client: MongoClient;
let localClient: MongoClient;
let changeStream: ChangeStream<Document, ChangeStreamDocument<Document>>;

/**
 * Connect to both MongoDB instances
 */
async function connect(): Promise<{ ec2Db: Db; localDb: Db }> {
  console.log('[MongoDB Sync] Connecting to databases...');
  console.log(`  EC2:   ${EC2_URI}`);
  console.log(`  Local: ${LOCAL_URI}`);

  ec2Client = new MongoClient(EC2_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  localClient = new MongoClient(LOCAL_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  await ec2Client.connect();
  console.log('[MongoDB Sync] Connected to EC2');

  await localClient.connect();
  console.log('[MongoDB Sync] Connected to Local');

  return {
    ec2Db: ec2Client.db(DB_NAME),
    localDb: localClient.db(DB_NAME),
  };
}

/**
 * Perform initial full sync of all collections
 */
async function initialSync(ec2Db: Db, localDb: Db): Promise<void> {
  console.log('[MongoDB Sync] Starting initial full sync...');
  console.log('');

  const collections = await ec2Db.listCollections().toArray();
  let totalDocs = 0;

  for (const collInfo of collections) {
    const collName = collInfo.name;

    // Skip system collections
    if (collName.startsWith('system.')) {
      continue;
    }

    console.log(`[INIT] Syncing collection: ${collName}`);

    try {
      const docs = await ec2Db.collection(collName).find({}).toArray();

      if (docs.length > 0) {
        // Clear local collection and insert all docs
        await localDb.collection(collName).deleteMany({});
        await localDb.collection(collName).insertMany(docs);
        totalDocs += docs.length;
        console.log(`[INIT] ${collName}: ${docs.length} documents synced`);
      } else {
        // Ensure collection exists even if empty
        await localDb.createCollection(collName).catch(() => {});
        console.log(`[INIT] ${collName}: empty (collection created)`);
      }
    } catch (err) {
      console.error(`[INIT] Error syncing ${collName}:`, err);
    }
  }

  console.log('');
  console.log(`[INIT] Initial sync complete. Total documents: ${totalDocs}`);
  console.log('');
}

/**
 * Start listening to Change Stream and replicate changes
 */
async function startChangeStreamSync(ec2Db: Db, localDb: Db): Promise<void> {
  console.log('[MongoDB Sync] Starting Change Stream listener...');
  console.log('[MongoDB Sync] Waiting for changes from EC2...');
  console.log('');

  // Watch all collections in the database
  changeStream = ec2Db.watch([], {
    fullDocument: 'updateLookup',
  });

  changeStream.on('change', async (change: ChangeStreamDocument<Document>) => {
    const timestamp = new Date().toISOString();

    try {
      // Get collection name from namespace
      const collName = change.ns?.coll;
      if (!collName) {
        return;
      }

      const collection = localDb.collection(collName);
      const docId = (change as any).documentKey?._id;

      switch (change.operationType) {
        case 'insert': {
          const doc = (change as any).fullDocument;
          if (doc) {
            await collection.insertOne(doc);
            console.log(`${timestamp} [INSERT] ${collName}: ${docId}`);
          }
          break;
        }

        case 'update':
        case 'replace': {
          const doc = (change as any).fullDocument;
          if (doc) {
            await collection.replaceOne(
              { _id: docId },
              doc,
              { upsert: true }
            );
            console.log(`${timestamp} [UPDATE] ${collName}: ${docId}`);
          }
          break;
        }

        case 'delete': {
          await collection.deleteOne({ _id: docId });
          console.log(`${timestamp} [DELETE] ${collName}: ${docId}`);
          break;
        }

        case 'drop': {
          // Collection was dropped
          await collection.drop().catch(() => {});
          console.log(`${timestamp} [DROP] ${collName}`);
          break;
        }

        case 'rename': {
          // Collection was renamed
          const newName = (change as any).to?.coll;
          if (newName) {
            await localDb.renameCollection(collName, newName).catch(() => {});
            console.log(`${timestamp} [RENAME] ${collName} -> ${newName}`);
          }
          break;
        }

        case 'invalidate': {
          console.log(`${timestamp} [INVALIDATE] Stream invalidated, reconnecting...`);
          // Restart the stream
          await startChangeStreamSync(ec2Db, localDb);
          break;
        }

        default:
          console.log(`${timestamp} [${change.operationType.toUpperCase()}] ${collName}`);
      }
    } catch (err) {
      console.error(`${timestamp} [SYNC ERROR]`, err);
    }
  });

  changeStream.on('error', async (err) => {
    console.error('[STREAM ERROR]', err);

    // Attempt to reconnect
    console.log('[MongoDB Sync] Attempting to reconnect...');
    await sleep(RETRY_DELAY_MS);

    try {
      await connect();
      const { ec2Db: newEc2Db, localDb: newLocalDb } = await connect();
      await startChangeStreamSync(newEc2Db, newLocalDb);
    } catch (reconnectErr) {
      console.error('[RECONNECT ERROR]', reconnectErr);
      process.exit(1); // Let Docker/PM2 restart us
    }
  });

  changeStream.on('close', () => {
    console.log('[MongoDB Sync] Change stream closed');
  });
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log('[MongoDB Sync] Shutting down...');

  if (changeStream) {
    await changeStream.close();
  }

  if (ec2Client) {
    await ec2Client.close();
  }

  if (localClient) {
    await localClient.close();
  }

  console.log('[MongoDB Sync] Shutdown complete');
  process.exit(0);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('');
  console.log('==========================================');
  console.log('  MongoDB Change Stream Sync Service');
  console.log('==========================================');
  console.log('');

  // Handle shutdown signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  let retries = MAX_RETRIES;

  while (retries > 0) {
    try {
      const { ec2Db, localDb } = await connect();

      // Run initial sync if --init flag is provided
      if (process.argv.includes('--init')) {
        await initialSync(ec2Db, localDb);
      }

      // Start change stream sync
      await startChangeStreamSync(ec2Db, localDb);

      // Keep the process running
      await new Promise(() => {});
    } catch (err) {
      console.error('[ERROR]', err);
      retries--;

      if (retries > 0) {
        console.log(`[MongoDB Sync] Retrying in ${RETRY_DELAY_MS / 1000}s... (${retries} attempts left)`);
        await sleep(RETRY_DELAY_MS);
      } else {
        console.error('[MongoDB Sync] Max retries exceeded. Exiting.');
        process.exit(1);
      }
    }
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
