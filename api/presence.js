import { db, sessionName } from '../lib/accounts.js';

// Live pilots: each signed-in pilot sends its position every few seconds and gets back the other pilots who sent
// theirs recently. Positions expire after 15 seconds, so a pilot who closes the game disappears.
const STALE_MS = 12000;
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const name = await sessionName(req);
  if (!name) return res.status(401).json({ error: 'Sign in again.' });
  const b = req.body || {};
  const num = v => (Number.isFinite(v) ? v : 0);
  const mine = {
    name,
    callsign: String(b.callsign || '').slice(0, 12),
    plane: String(b.plane || '').slice(0, 20),
    x: num(b.x), y: num(b.y), z: num(b.z), yaw: num(b.yaw),
    v: Math.max(0, Math.min(700, num(b.v)))
  };
  const r = await db();
  const now = Date.now();
  await r.set('presence:' + name, JSON.stringify(mine), { EX: 15 });
  await r.zAdd('online', { score: now, value: name });
  await r.zRemRangeByScore('online', 0, now - 60000);
  const names = (await r.zRangeByScore('online', now - STALE_MS, '+inf')).filter(n => n !== name).slice(0, 30);
  const rows = names.length ? await r.mGet(names.map(n => 'presence:' + n)) : [];
  const others = rows.filter(Boolean).map(t => JSON.parse(t));
  res.json({ others });
}
