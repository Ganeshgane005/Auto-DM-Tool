import express from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { webhookRouter } from './webhook.js';
import { apiRouter } from './routes.js';

const app = express();

// The webhook router parses its own raw body, so mount it before express.json().
app.use('/webhook', webhookRouter);
app.use(express.json());
app.use('/api', apiRouter);
app.get('/health', (_req, res) => res.json({ ok: true }));

// The dashboard (built React app in web/dist). Run `npm run build:web` first.
const webDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api|webhook|health).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

// dbName keeps data in "dm-tool" even if the connection string has no database name.
await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName });
app.listen(config.port, () => console.log(`dm-tool listening on :${config.port}`));
