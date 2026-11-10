// One-time copy: local MongoDB (dm-tool) -> the database in MONGODB_URI (e.g. Atlas).
// Copies accounts, automations and events with the same _ids. Existing docs are replaced, not duplicated.
// Usage: node --env-file=.env scripts/copy-local-to-cloud.js [localUri]
import mongoose from 'mongoose';

const localUri = process.argv[2] || 'mongodb://127.0.0.1:27017/dm-tool';
const dbName = process.env.MONGODB_DB || 'dm-tool';

const local = await mongoose.createConnection(localUri).asPromise();
const cloud = await mongoose.createConnection(process.env.MONGODB_URI, { dbName }).asPromise();

for (const name of ['accounts', 'automations', 'events']) {
  const docs = await local.db.collection(name).find().toArray();
  for (const doc of docs) {
    await cloud.db.collection(name).replaceOne({ _id: doc._id }, doc, { upsert: true });
  }
  console.log(`${name}: copied ${docs.length}`);
}

await local.close();
await cloud.close();
