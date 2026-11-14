import { db, sessionName, tokenOf, samePassword, newSalt, hashPassword, blocked, noteFail, clearFails, ADMIN_NAME } from '../lib/accounts.js';

// Account actions for the signed-in pilot: sign out on the server, change the password, delete the account.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const name = await sessionName(req);
  if (!name) return res.status(401).json({ error: 'Sign in again.' });
  const b = req.body || {};
  const r = await db();
  const raw = await r.get('pilot:' + name);
  if (!raw) return res.status(401).json({ error: 'Sign in again.' });
  const pilot = JSON.parse(raw);

  if (b.action === 'logout') {
    await r.del('session:' + tokenOf(req));
    return res.json({ ok: true });
  }

  // the other actions ask for the current password
  if (b.action === 'password' || b.action === 'delete') {
    const current = typeof b.password === 'string' ? b.password : (typeof b.oldPassword === 'string' ? b.oldPassword : '');
    if (await blocked(name)) return res.status(429).json({ error: 'Too many wrong passwords. Try again in 15 minutes.' });
    if (!samePassword(current, pilot.salt, pilot.hash)) {
      await noteFail(name);
      return res.status(401).json({ error: 'Wrong password.' });
    }
    await clearFails(name);

    if (b.action === 'password') {
      const next = b.newPassword;
      if (typeof next !== 'string' || next.length < 4 || next.length > 64) return res.status(400).json({ error: 'Use a new password of 4 to 64 characters.' });
      pilot.salt = newSalt();
      pilot.hash = hashPassword(next, pilot.salt);
      await r.set('pilot:' + name, JSON.stringify(pilot));
      return res.json({ ok: true });
    }

    if (name === ADMIN_NAME) return res.status(403).json({ error: 'The admin pilot cannot be deleted.' });
    await r.del(['pilot:' + name, 'save:' + name, 'presence:' + name, 'session:' + tokenOf(req)]);
    await r.sRem('pilots', name);
    await r.zRem('online', name);
    return res.json({ ok: true });
  }
  res.status(400).json({ error: 'Unknown action.' });
}
