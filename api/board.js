import { db } from '../lib/accounts.js';

// Public leaderboard: longest flight, most back flips and today's daily missions. Only names and totals are sent.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET.' });
  const day = typeof req.query?.day === 'string' ? req.query.day : '';
  const week = Number(req.query?.week);
  const r = await db();
  const names = await r.sMembers('pilots');
  const rows = [];
  const strips = [];   // airstrips built by pilots, seen by everybody
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
    if (Array.isArray(save.strips)) {
      for (const t of save.strips.slice(0, 3)) {
        if (strips.length < 90 && Number.isFinite(t.x) && Number.isFinite(t.z) && Number.isFinite(t.hdg) && typeof t.region === 'string') strips.push({ owner: String(save.callsign || name).slice(0, 12), name: String(t.name || '').slice(0, 14), x: t.x, z: t.z, hdg: t.hdg, len: 650, region: t.region.slice(0, 12) });
      }
    }
    const best = save.records && save.records[0] ? parseFloat(save.records[0].km) || 0 : 0;
    rows.push({
      name,
      callsign: String(save.callsign || '').slice(0, 12),
      best,
      flips: Number(save.flips) || 0,
      landing: Number(save.landingScore) || 0,
      butters: Number(save.butters) || 0,
      score: save.weekly && save.weekly.week === week ? Number(save.weekly.score) || 0 : 0,
      daily: save.daily && save.daily.date === day ? (save.daily.done || []).length : 0
    });
  }
  const top = key => rows.filter(x => x[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, 10);
  for (const id of Object.keys(races)) races[id] = races[id].sort((a, b) => a.time - b.time).slice(0, 5);
  res.json({ strips, weekly: top('score'), best: top('best'), flips: top('flips'), landing: top('landing'), butters: top('butters'), daily: top('daily'), races });
}
