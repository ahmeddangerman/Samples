import 'dotenv/config';
import express from 'express';
import { copyFileSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const REQUIRED_ENV = ['ANTHROPIC_API_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

import db from './db.js';
import translateRouter from './routes/translate.js';
import phrasesRouter from './routes/phrases.js';
import cardsRouter from './routes/cards.js';
import statsRouter from './routes/stats.js';
import importRouter from './routes/import.js';

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api', translateRouter);
app.use('/api', phrasesRouter);
app.use('/api', cardsRouter);
app.use('/api', statsRouter);
app.use('/api', importRouter);

app.get('/api/settings', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
});

app.post('/api/settings', (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const save = db.transaction(pairs => {
    for (const [k, v] of pairs) upsert.run(k, String(v));
  });
  save(Object.entries(req.body));
  res.json({ ok: true });
});

app.get('/api/export', (_req, res) => {
  const data = {
    translations: db.prepare('SELECT * FROM translations').all()
      .map(r => ({ ...r, variants: JSON.parse(r.variants_json) })),
    phrases: db.prepare('SELECT * FROM phrases').all(),
    cards: db.prepare('SELECT * FROM cards').all(),
    reviews: db.prepare('SELECT * FROM reviews').all(),
  };
  res.setHeader('Content-Disposition', `attachment; filename="most-export-${Date.now()}.json"`);
  res.json(data);
});

function runBackup() {
  const dbPath = join(__dirname, 'data', 'app.sqlite');
  const backupDir = join(__dirname, 'data', 'backups');
  const date = new Date().toISOString().slice(0, 10);
  const dest = join(backupDir, `${date}.sqlite`);

  try {
    copyFileSync(dbPath, dest);

    const files = readdirSync(backupDir)
      .filter(f => f.endsWith('.sqlite'))
      .sort();
    if (files.length > 14) {
      files.slice(0, files.length - 14).forEach(f => {
        try { unlinkSync(join(backupDir, f)); } catch {}
      });
    }
  } catch (err) {
    console.error('Backup failed:', err.message);
  }
}

runBackup();
setInterval(runBackup, 24 * 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Мост 2.0 running at http://localhost:${PORT}`);
});
