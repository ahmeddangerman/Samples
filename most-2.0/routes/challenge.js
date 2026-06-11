import express from 'express';
import db from '../db.js';
import CONTENT from './challenge-content.js';

const router = express.Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentDay(startedAt) {
  const start = new Date(startedAt + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((now - start) / 86400000);
  return Math.min(30, Math.max(1, diffDays + 1));
}

router.get('/challenge/status', (req, res) => {
  const challenge = db.prepare(
    'SELECT * FROM challenge WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
  ).get();

  if (!challenge) return res.json({ started: false });

  const currentDay = getCurrentDay(challenge.started_at);
  const dayContent = CONTENT[currentDay - 1];

  const completions = db.prepare('SELECT day_number FROM challenge_completions').all();
  const completedSet = new Set(completions.map(c => c.day_number));
  const completionGrid = Array.from({ length: 30 }, (_, i) => completedSet.has(i + 1));

  const reps = db.prepare(
    'SELECT phrase_index, reps_done FROM speaking_reps WHERE day_number = ? AND practiced_at = ?'
  ).all(currentDay, todayStr());

  const repsByIdx = {};
  for (const r of reps) repsByIdx[r.phrase_index] = r.reps_done;

  const todayPhrases = dayContent.phrases.map((p, idx) => ({
    ...p,
    index: idx,
    repsToday: repsByIdx[idx] || 0,
  }));

  res.json({
    started: true,
    currentDay,
    topic: dayContent.topic,
    completionGrid,
    todayPhrases,
    isCompleted: completedSet.has(currentDay),
    totalCompleted: completedSet.size,
    startedAt: challenge.started_at,
  });
});

router.post('/challenge/start', (req, res) => {
  db.prepare('UPDATE challenge SET is_active = 0').run();
  db.prepare('DELETE FROM challenge_completions').run();
  db.prepare('DELETE FROM speaking_reps').run();
  db.prepare('INSERT INTO challenge (started_at, is_active) VALUES (?, 1)').run(todayStr());
  res.json({ ok: true });
});

router.post('/challenge/speak', (req, res) => {
  const { day_number, phrase_index } = req.body;
  if (day_number == null || phrase_index == null) {
    return res.status(400).json({ error: 'day_number and phrase_index required' });
  }

  db.prepare(`
    INSERT INTO speaking_reps (day_number, phrase_index, reps_done, practiced_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(day_number, phrase_index, practiced_at) DO UPDATE SET reps_done = reps_done + 1
  `).run(day_number, phrase_index, todayStr());

  const row = db.prepare(
    'SELECT reps_done FROM speaking_reps WHERE day_number = ? AND phrase_index = ? AND practiced_at = ?'
  ).get(day_number, phrase_index, todayStr());

  res.json({ ok: true, reps_done: row.reps_done });
});

router.post('/challenge/complete-day', (req, res) => {
  const challenge = db.prepare(
    'SELECT * FROM challenge WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
  ).get();
  if (!challenge) return res.status(400).json({ error: 'No active challenge' });

  const currentDay = getCurrentDay(challenge.started_at);
  const phraseCount = CONTENT[currentDay - 1].phrases.length;

  const { cnt } = db.prepare(
    'SELECT COUNT(DISTINCT phrase_index) as cnt FROM speaking_reps WHERE day_number = ? AND practiced_at = ?'
  ).get(currentDay, todayStr());

  if (cnt < phraseCount) {
    return res.status(400).json({
      error: `Practice all phrases first (${cnt}/${phraseCount} done)`,
    });
  }

  db.prepare(
    'INSERT OR IGNORE INTO challenge_completions (day_number, completed_at) VALUES (?, ?)'
  ).run(currentDay, todayStr());

  res.json({ ok: true, dayCompleted: currentDay });
});

export default router;
