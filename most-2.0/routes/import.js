import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.post('/import/conversation', (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

  // Extract Cyrillic words from the pasted text
  const matches = text.match(/[а-яёА-ЯЁ]+/g) || [];
  const unique = [...new Set(matches.map(w => w.toLowerCase()))];

  // Find which ones are not already in the deck
  const known = new Set(
    db.prepare('SELECT russian FROM cards').all().map(r => r.russian.toLowerCase())
  );

  const unknown = unique
    .filter(w => !known.has(w) && w.length > 2)
    .map(w => ({ russian: w, english: '' }));

  res.json({ unknown, total: unique.length, unknown_count: unknown.length });
});

export default router;
