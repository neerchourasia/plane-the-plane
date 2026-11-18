import crypto from 'node:crypto';
import { db, EMAIL_RE, isAdmin, sessionName, tokenOf, samePassword, newSalt, hashPassword, blocked, noteFail, clearFails, ipOf } from '../lib/accounts.js';

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

  if (b.action === 'email') {
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email) || email.length > 80) return res.status(400).json({ error: 'Enter a valid email address.' });
    const owner = await r.get('email:' + email);
    if (owner && owner !== name) return res.status(409).json({ error: 'That email is already used by another pilot.' });
    if (pilot.email && pilot.email !== email) await r.del('email:' + pilot.email);
    await r.set('email:' + email, name);
    pilot.email = email;
    await r.set('pilot:' + name, JSON.stringify(pilot));
    return res.json({ ok: true });
  }

  // admin tools, only for the admin pilot (its email is ADMIN_EMAIL)
  if (['admin_list', 'admin_delete', 'admin_coins', 'admin_password', 'admin_ban', 'admin_mute'].includes(b.action)) {
    if (!isAdmin(pilot)) return res.status(403).json({ error: 'Admin only.' });
    if (b.action === 'admin_delete') {
      const target = typeof b.target === 'string' ? b.target.trim().toLowerCase() : '';
      if (!target || target === name) return res.status(400).json({ error: 'Pick another pilot to delete.' });
      const traw = await r.get('pilot:' + target);
      const t = traw ? JSON.parse(traw) : null;
      await r.del(['pilot:' + target, 'save:' + target, 'presence:' + target].concat(t && t.email ? ['email:' + t.email] : []));
      await r.sRem('pilots', target);
      await r.sRem('banned', target);
      await r.sRem('muted', target);
      await r.zRem('online', target);
      return res.json({ ok: true });
    }
    if (b.action === 'admin_ban' || b.action === 'admin_mute') {
      const target = typeof b.target === 'string' ? b.target.trim().toLowerCase() : '';
      if (!target || target === name || !(await r.exists('pilot:' + target))) return res.status(400).json({ error: 'Pick another pilot.' });
      const set = b.action === 'admin_ban' ? 'banned' : 'muted';
      if (b.on) await r.sAdd(set, target); else await r.sRem(set, target);
      if (b.action === 'admin_ban' && b.on) { await r.del('presence:' + target); await r.zRem('online', target); }
      return res.json({ ok: true });
    }
    if (b.action === 'admin_coins' || b.action === 'admin_password') {
      const target = typeof b.target === 'string' ? b.target.trim().toLowerCase() : '';
      const traw = target ? await r.get('pilot:' + target) : null;
      if (!traw) return res.status(404).json({ error: 'No such pilot.' });
      if (b.action === 'admin_coins') {
        const coins = Math.round(Number(b.coins));
        if (!Number.isFinite(coins) || coins < 0 || coins > 100000000) return res.status(400).json({ error: 'Coins must be a number from 0 to 100000000.' });
        const sraw = await r.get('save:' + target);
        const sv = sraw ? JSON.parse(sraw) : {};
        sv.coins = coins;
        await r.set('save:' + target, JSON.stringify(sv));
        return res.json({ ok: true });
      }
      // a new temporary password for a pilot who forgot theirs: shown once to the admin, who passes it on
      const t = JSON.parse(traw);
      const temp = crypto.randomBytes(6).toString('base64url');
      t.salt = newSalt();
      t.hash = hashPassword(temp, t.salt);
      await r.set('pilot:' + target, JSON.stringify(t));
      return res.json({ ok: true, password: temp });
    }
    const names = (await r.sMembers('pilots')).sort();
    const now = Date.now();
    const banned = new Set(await r.sMembers('banned')), muted = new Set(await r.sMembers('muted'));
    const list = [];
    for (const n of names) {
      const [p, sv, seen] = await Promise.all([r.get('pilot:' + n), r.get('save:' + n), r.zScore('online', n)]);
      if (!p) continue;
      const pp = JSON.parse(p), ss = sv ? JSON.parse(sv) : {};
      list.push({ name: n, email: pp.email || '', created: pp.created || '', lastSignIn: pp.lastSignIn || '', coins: ss.coins || 0, xp: ss.xp || 0, online: seen != null && seen > now - 60000, banned: banned.has(n), muted: muted.has(n) });
    }
    return res.json({ pilots: list });
  }

  // the other actions ask for the current password
  if (b.action === 'password' || b.action === 'delete') {
    const current = typeof b.password === 'string' ? b.password : (typeof b.oldPassword === 'string' ? b.oldPassword : '');
    if (await blocked(name, ipOf(req))) return res.status(429).json({ error: 'Too many wrong passwords. Try again in 15 minutes.' });
    if (!samePassword(current, pilot.salt, pilot.hash)) {
      await noteFail(name, ipOf(req));
      return res.status(401).json({ error: 'Wrong password.' });
    }
    await clearFails(name, ipOf(req));

    if (b.action === 'password') {
      const next = b.newPassword;
      if (typeof next !== 'string' || next.length < 4 || next.length > 64) return res.status(400).json({ error: 'Use a new password of 4 to 64 characters.' });
      pilot.salt = newSalt();
      pilot.hash = hashPassword(next, pilot.salt);
      await r.set('pilot:' + name, JSON.stringify(pilot));
      return res.json({ ok: true });
    }

    await r.del(['pilot:' + name, 'save:' + name, 'presence:' + name, 'session:' + tokenOf(req)].concat(pilot.email ? ['email:' + pilot.email] : []));
    await r.sRem('pilots', name);
    await r.zRem('online', name);
    return res.json({ ok: true });
  }
  res.status(400).json({ error: 'Unknown action.' });
}
