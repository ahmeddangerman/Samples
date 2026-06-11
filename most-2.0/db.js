import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(join(DATA_DIR, 'backups'), { recursive: true });

const db = new Database(join(DATA_DIR, 'app.sqlite'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS translations (
    id INTEGER PRIMARY KEY,
    input_text TEXT NOT NULL,
    source_lang TEXT NOT NULL DEFAULT 'en',
    tone TEXT,
    variants_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS phrases (
    id INTEGER PRIMARY KEY,
    russian TEXT NOT NULL,
    english TEXT NOT NULL,
    breakdown TEXT,
    category TEXT,
    tags TEXT,
    source_translation_id INTEGER REFERENCES translations(id),
    created_at INTEGER NOT NULL,
    UNIQUE(russian, english)
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY,
    russian TEXT NOT NULL UNIQUE,
    english TEXT NOT NULL,
    example_russian TEXT,
    example_english TEXT,
    ease REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    due_date INTEGER NOT NULL,
    reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id),
    rating INTEGER NOT NULL,
    reviewed_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export default db;
