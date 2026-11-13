import { db, sessionName, ADMIN_NAME } from '../lib/accounts.js';

// every pilot who has signed up; only the admin pilot may read this
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET.' });
  const name = await sessionName(req);
  if (name !== ADMIN_NAME) return res.status(403).json({ error: 'Only the admin pilot can see this.' });
  const r = await db();
  const names = await r.sMembers('pilots');
  const rows = [];
  for (const n of names) {
    const pilot = JSON.parse((await r.get('pilot:' + n)) || 'null');
    const save = JSON.parse((await r.get('save:' + n)) || '{}');
    if (!pilot) continue;
    rows.push({ name: pilot.name, created: pilot.created, lastSignIn: pilot.lastSignIn, xp: save.xp || 0, coins: save.coins ?? null });
  }
  rows.sort((a, b) => (a.created || '').localeCompare(b.created || ''));
  res.json({ pilots: rows });
}
