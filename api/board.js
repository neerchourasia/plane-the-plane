import { db } from '../lib/accounts.js';

// Public leaderboard: longest flight, most back flips and today's daily missions. Only names and totals are sent.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET.' });
  const day = typeof req.query?.day === 'string' ? req.query.day : '';
  const r = await db();
  const names = await r.sMembers('pilots');
  const rows = [];
  const races = {};   // best times per race, for the air races
  for (const name of names) {
    const save = JSON.parse((await r.get('save:' + name)) || '{}');
    if (save.races && typeof save.races === 'object') {
      for (const [id, time] of Object.entries(save.races)) {
        if (/^r[0-9]{1,2}$/.test(id) && Number.isFinite(time) && time > 0) {
          (races[id] = races[id] || []).push({ name, callsign: String(save.callsign || '').slice(0, 12), time });
        }
      }
    }
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
  for (const id of Object.keys(races)) races[id] = races[id].sort((a, b) => a.time - b.time).slice(0, 5);
  res.json({ best: top('best'), flips: top('flips'), daily: top('daily'), races });
}
