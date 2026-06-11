import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Tokenise Russian text into individual words, lowercase, stripped of punctuation
function tokenise(text) {
  return [...text.matchAll(/[а-яёА-ЯЁa-zA-Z]+/gu)]
    .map(m => m[0].toLowerCase());
}

router.post('/import/conversation', (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

  const tokens = [...new Set(tokenise(text))];
  if (tokens.length === 0) return res.json({ unknown: [] });

  const known = new Set(
    db.prepare('SELECT russian FROM cards').all().map(c => c.russian.toLowerCase())
  );

  const unknown = tokens.filter(t => !known.has(t) && /[а-яёА-ЯЁ]/u.test(t));

  res.json({ unknown });
});

export default router;
