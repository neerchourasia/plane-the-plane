import { db, sessionName, cleanName, ADMIN_NAME } from '../lib/accounts.js';

// Admin only: removes a pilot and their save. The admin pilot cannot be removed.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if ((await sessionName(req)) !== ADMIN_NAME) return res.status(403).json({ error: 'Only the admin pilot can delete pilots.' });
  const name = cleanName(req.body?.name);
  if (!name || name === ADMIN_NAME) return res.status(400).json({ error: 'Choose a pilot to delete.' });
  const r = await db();
  await r.del(['pilot:' + name, 'save:' + name]);
  await r.sRem('pilots', name);
  res.json({ ok: true });
}
