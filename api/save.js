import { db, sessionName, DEFAULT_SAVE } from '../lib/accounts.js';

// GET loads the signed-in pilot's save; PUT stores it
export default async function handler(req, res) {
  const name = await sessionName(req);
  if (!name) return res.status(401).json({ error: 'Sign in again.' });
  const r = await db();
  if (req.method === 'GET') {
    const save = await r.get('save:' + name);
    return res.json({ save: save ? JSON.parse(save) : DEFAULT_SAVE });
  }
  if (req.method === 'PUT') {
    const save = req.body;
    if (!save || typeof save !== 'object' || Array.isArray(save)) return res.status(400).json({ error: 'Send the save as a JSON object.' });
    const text = JSON.stringify(save);
    if (text.length > 200000) return res.status(413).json({ error: 'The save is too large.' });
    await r.set('save:' + name, text);
    return res.json({ ok: true });
  }
  res.status(405).json({ error: 'Use GET or PUT.' });
}
