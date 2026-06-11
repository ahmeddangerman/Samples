import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.post('/phrases', (req, res) => {
  const { russian, english, breakdown, category, tags, source_translation_id } = req.body;
  if (!russian?.trim() || !english?.trim()) {
    return res.status(400).json({ error: 'russian and english are required' });
  }

  try {
    const result = db.prepare(
      `INSERT INTO phrases (russian, english, breakdown, category, tags, source_translation_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      russian.trim(), english.trim(), breakdown || null,
      category || 'custom', tags || null, source_translation_id || null,
      Math.floor(Date.now() / 1000)
    );
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Phrase already exists' });
    throw err;
  }
});

router.get('/phrases', (req, res) => {
  const { q = '', category = '', tag = '' } = req.query;
  let sql = 'SELECT * FROM phrases WHERE 1=1';
  const params = [];

  if (q) {
    sql += ' AND (russian LIKE ? OR english LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (tag) {
    sql += ' AND ("," || tags || "," LIKE ?)';
    params.push(`%,${tag},%`);
  }

  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.delete('/phrases/:id', (req, res) => {
  const result = db.prepare('DELETE FROM phrases WHERE id = ?').run(Number(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.get('/phrases/categories', (_req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM phrases WHERE category IS NOT NULL ORDER BY category').all();
  const defaults = ['greetings', 'gratitude', 'affection', 'apology', 'planning', 'small talk', 'gifts', 'travel', 'food', 'custom'];
  const existing = rows.map(r => r.category);
  const merged = [...new Set([...defaults, ...existing])];
  res.json(merged);
});

export default router;
