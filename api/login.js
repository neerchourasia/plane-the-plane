import { db, cleanName, samePassword, startSession, DEFAULT_SAVE } from '../lib/accounts.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const { name: rawName, password } = req.body || {};
  const name = cleanName(rawName);
  if (!name || typeof password !== 'string') return res.status(400).json({ error: 'Enter your pilot name and password.' });
  const r = await db();
  const raw = await r.get('pilot:' + name);
  if (!raw) return res.status(404).json({ error: 'No pilot with that name. Create one instead.' });
  const pilot = JSON.parse(raw);
  if (!samePassword(password, pilot.salt, pilot.hash)) return res.status(401).json({ error: 'Wrong password.' });
  pilot.lastSignIn = new Date().toISOString();
  await r.set('pilot:' + name, JSON.stringify(pilot));
  const token = await startSession(name);
  const save = await r.get('save:' + name);
  res.json({ token, name, save: save ? JSON.parse(save) : DEFAULT_SAVE });
}
