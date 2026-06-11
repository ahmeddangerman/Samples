import { Router } from 'express';
import db from '../db.js';

const router = Router();

function todayUnix() {
  return Math.floor(Date.now() / 86400000) * 86400;
}

function applyReview(card, rating) {
  let { ease, interval_days, reps, lapses } = card;

  if (rating === 1) {
    reps = 0;
    lapses += 1;
    interval_days = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    if (rating === 2) ease = Math.max(1.3, ease - 0.15);
    if (rating === 4) ease += 0.15;

    if (reps === 0) {
      interval_days = 1;
    } else if (reps === 1) {
      interval_days = 6;
    } else {
      if (rating === 2) {
        interval_days = Math.max(1, Math.round(interval_days * 1.2));
      } else if (rating === 3) {
        interval_days = Math.max(1, Math.round(interval_days * ease));
      } else {
        interval_days = Math.max(1, Math.round(interval_days * ease * 1.3));
      }
    }
    reps += 1;
  }

  const due_date = todayUnix() + interval_days * 86400;
  return { ease, interval_days, due_date, reps, lapses };
}

router.post('/cards/bulk', (req, res) => {
  const { cards } = req.body;
  if (!Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: 'cards array is required' });
  }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO cards
     (russian, english, example_russian, example_english, ease, interval_days, due_date, reps, lapses, created_at)
     VALUES (?, ?, ?, ?, 2.5, 0, ?, 0, 0, ?)`
  );

  const now = Math.floor(Date.now() / 1000);
  const today = todayUnix();
  let added = 0;

  const insertMany = db.transaction(list => {
    for (const c of list) {
      if (!c.russian?.trim() || !c.english?.trim()) continue;
      const r = insert.run(
        c.russian.trim(), c.english.trim(),
        c.example_russian || null, c.example_english || null,
        today, now
      );
      added += r.changes;
    }
  });

  insertMany(cards);
  res.json({ added });
});

router.get('/cards/due', (_req, res) => {
  const cutoff = todayUnix() + 86400;
  const newCardCap = Number(
    db.prepare("SELECT value FROM settings WHERE key = 'daily_new_cap'").get()?.value ?? 8
  );

  const due = db.prepare(
    'SELECT * FROM cards WHERE due_date < ? AND reps > 0 ORDER BY due_date ASC'
  ).all(cutoff);

  const newCards = db.prepare(
    'SELECT * FROM cards WHERE reps = 0 ORDER BY created_at ASC LIMIT ?'
  ).all(newCardCap);

  res.json({ due, new: newCards, total: due.length + newCards.length });
});

router.post('/cards/:id/review', (req, res) => {
  const id = Number(req.params.id);
  const { rating } = req.body;

  if (![1, 2, 3, 4].includes(rating)) {
    return res.status(400).json({ error: 'rating must be 1-4' });
  }

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  if (!card) return res.status(404).json({ error: 'Not found' });

  const updated = applyReview(card, rating);

  db.prepare(
    'UPDATE cards SET ease = ?, interval_days = ?, due_date = ?, reps = ?, lapses = ? WHERE id = ?'
  ).run(updated.ease, updated.interval_days, updated.due_date, updated.reps, updated.lapses, id);

  db.prepare(
    'INSERT INTO reviews (card_id, rating, reviewed_at) VALUES (?, ?, ?)'
  ).run(id, rating, Math.floor(Date.now() / 1000));

  res.json({ ok: true, next_due: updated.due_date, interval_days: updated.interval_days });
});

router.get('/cards', (_req, res) => {
  res.json(db.prepare('SELECT * FROM cards ORDER BY created_at DESC').all());
});

router.delete('/cards/:id', (req, res) => {
  const result = db.prepare('DELETE FROM cards WHERE id = ?').run(Number(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
