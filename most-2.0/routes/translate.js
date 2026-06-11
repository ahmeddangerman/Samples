import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import db from '../db.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.TRANSLATION_MODEL || 'claude-opus-4-8';

const SYSTEM_PROMPT = `You are an expert Russian translator helping someone communicate naturally and warmly with a native Russian speaker.

Provide exactly 3 Russian translation variants of the given text. Vary the phrasing, word choice, and register while preserving the meaning.

Output ONLY a JSON array with no markdown fences and no extra text:
[
  {"russian": "...", "english": "...", "breakdown": "..."},
  {"russian": "...", "english": "...", "breakdown": "..."},
  {"russian": "...", "english": "...", "breakdown": "..."}
]

Fields:
- russian: The Russian translation in Cyrillic script
- english: A natural English back-translation of the Russian (not a copy of the original)
- breakdown: 1-2 sentences explaining key word choices, register differences, or what makes this variant distinct`;

router.post('/translate', async (req, res) => {
  const { text, tone = 'neutral' } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

  const cacheKey = crypto.createHash('sha256').update(`${tone}::${text.trim()}`).digest('hex');

  const cached = db.prepare('SELECT value FROM cache WHERE key = ?').get(cacheKey);
  if (cached) {
    const data = JSON.parse(cached.value);
    return res.json(data);
  }

  let rawContent;
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Tone: ${tone}\nText: ${text.trim()}` }],
    });
    rawContent = message.content[0].text;
  } catch (err) {
    return res.status(502).json({ error: `Anthropic API error: ${err.message}` });
  }

  let variants;
  try {
    variants = JSON.parse(rawContent);
    if (!Array.isArray(variants) || variants.length !== 3) throw new Error('Expected array of 3');
  } catch {
    return res.status(502).json({ error: 'Model returned unexpected format. Try again.' });
  }

  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare(
    'INSERT INTO translations (input_text, source_lang, tone, variants_json, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(text.trim(), 'en', tone, JSON.stringify(variants), now);

  const payload = { id: result.lastInsertRowid, variants };

  db.prepare('INSERT OR REPLACE INTO cache (key, value, created_at) VALUES (?, ?, ?)').run(
    cacheKey, JSON.stringify(payload), now
  );

  res.json(payload);
});

router.get('/translations', (req, res) => {
  const { q = '', limit = 50 } = req.query;
  const rows = q
    ? db.prepare(
        'SELECT * FROM translations WHERE input_text LIKE ? ORDER BY created_at DESC LIMIT ?'
      ).all(`%${q}%`, Number(limit))
    : db.prepare('SELECT * FROM translations ORDER BY created_at DESC LIMIT ?').all(Number(limit));

  res.json(rows.map(r => ({ ...r, variants: JSON.parse(r.variants_json) })));
});

export default router;
