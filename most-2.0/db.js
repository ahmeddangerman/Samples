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

  CREATE TABLE IF NOT EXISTS challenge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS challenge_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_number INTEGER NOT NULL UNIQUE,
    completed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS speaking_reps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_number INTEGER NOT NULL,
    phrase_index INTEGER NOT NULL,
    reps_done INTEGER NOT NULL DEFAULT 0,
    practiced_at TEXT NOT NULL,
    UNIQUE(day_number, phrase_index, practiced_at)
  );
`);

export default db;
