import { db } from '../lib/accounts.js';

// Public leaderboard: longest flight, most back flips and today's daily missions. Only names and totals are sent.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET.' });
  const day = typeof req.query?.day === 'string' ? req.query.day : '';
  const r = await db();
  const names = await r.sMembers('pilots');
  const rows = [];
  for (const name of names) {
    const save = JSON.parse((await r.get('save:' + name)) || '{}');
    const best = save.records && save.records[0] ? parseFloat(save.records[0].km) || 0 : 0;
    rows.push({
      name,
      callsign: String(save.callsign || '').slice(0, 12),
      best,
      flips: Number(save.flips) || 0,
      daily: save.daily && save.daily.date === day ? (save.daily.done || []).length : 0
    });
  }
  const top = key => rows.filter(x => x[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, 10);
  res.json({ best: top('best'), flips: top('flips'), daily: top('daily') });
}
