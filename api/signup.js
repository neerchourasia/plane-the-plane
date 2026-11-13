import { db, cleanName, validName, newSalt, hashPassword, startSession, DEFAULT_SAVE } from '../lib/accounts.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const { name: rawName, password } = req.body || {};
  const name = cleanName(rawName);
  if (!validName(name)) return res.status(400).json({ error: 'Pick a pilot name of 1 to 16 letters, numbers, - or _.' });
  if (typeof password !== 'string' || password.length < 4 || password.length > 64) return res.status(400).json({ error: 'Use a password of 4 to 64 characters.' });
  const r = await db();
  if (await r.exists('pilot:' + name)) return res.status(409).json({ error: 'That pilot already exists. Sign in instead.' });
  const salt = newSalt();
  const now = new Date().toISOString();
  await r.set('pilot:' + name, JSON.stringify({ name, salt, hash: hashPassword(password, salt), created: now, lastSignIn: now }));
  await r.set('save:' + name, JSON.stringify(DEFAULT_SAVE));
  await r.sAdd('pilots', name);
  const token = await startSession(name);
  res.json({ token, name, save: DEFAULT_SAVE });
}
