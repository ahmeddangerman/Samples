import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/stats', (_req, res) => {
  const todayUnix = Math.floor(Date.now() / 86400000) * 86400;

  const totalCards = db.prepare('SELECT COUNT(*) as n FROM cards').get().n;
  const learnedCards = db.prepare('SELECT COUNT(*) as n FROM cards WHERE reps >= 2').get().n;
  const dueToday = db.prepare('SELECT COUNT(*) as n FROM cards WHERE due_date < ?').get(todayUnix + 86400).n;
  const totalPhrases = db.prepare('SELECT COUNT(*) as n FROM phrases').get().n;
  const totalTranslations = db.prepare('SELECT COUNT(*) as n FROM translations').get().n;

  // Reviews per day for the last 30 days
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;
  const reviewsByDay = db.prepare(`
    SELECT date(reviewed_at, 'unixepoch') as day, COUNT(*) as count
    FROM reviews
    WHERE reviewed_at >= ?
    GROUP BY day
    ORDER BY day ASC
  `).all(thirtyDaysAgo);

  // Streak: consecutive days with at least one review
  const reviewDays = db.prepare(`
    SELECT DISTINCT date(reviewed_at, 'unixepoch') as day
    FROM reviews
    ORDER BY day DESC
  `).all().map(r => r.day);

  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (reviewDays.length > 0 && (reviewDays[0] === today || reviewDays[0] === yesterday)) {
    let check = reviewDays[0] === today ? today : yesterday;
    for (const day of reviewDays) {
      if (day === check) {
        streak++;
        const d = new Date(check);
        d.setDate(d.getDate() - 1);
        check = d.toISOString().slice(0, 10);
      } else {
        break;
      }
    }
  }

  res.json({
    totalCards,
    learnedCards,
    dueToday,
    totalPhrases,
    totalTranslations,
    streak,
    reviewsByDay,
  });
});

export default router;
