import { db, newSalt, hashPassword } from '../lib/accounts.js';

// Finishes "forgot password": the emailed one-hour token plus a new password.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || !/^[a-f0-9]{48}$/.test(token)) return res.status(400).json({ error: 'This reset link is not valid.' });
  if (typeof password !== 'string' || password.length < 4 || password.length > 64) return res.status(400).json({ error: 'Use a password of 4 to 64 characters.' });
  const r = await db();
  const name = await r.get('reset:' + token);
  if (!name) return res.status(400).json({ error: 'This reset link has expired. Ask for a new one.' });
  const raw = await r.get('pilot:' + name);
  if (!raw) return res.status(400).json({ error: 'This pilot no longer exists.' });
  const pilot = JSON.parse(raw);
  pilot.salt = newSalt();
  pilot.hash = hashPassword(password, pilot.salt);
  await r.set('pilot:' + name, JSON.stringify(pilot));
  await r.del('reset:' + token);
  res.json({ ok: true, name });
}
