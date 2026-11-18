import crypto from 'node:crypto';
import { db, EMAIL_RE } from '../lib/accounts.js';

// "Forgot password": emails a one-hour reset link to the address a pilot signed up with.
// Needs two settings in Vercel: RESEND_API_KEY (from resend.com) and MAIL_FROM (a sender address Resend allows, for example "Plane the Plane <onboarding@resend.dev>").
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) return res.status(501).json({ error: 'Password emails are not set up yet. Ask the admin to reset your password.' });
  const email = typeof (req.body || {}).email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 80) return res.status(400).json({ error: 'Enter the email you signed up with.' });
  const r = await db();
  // the same answer whether or not the email is known, and at most one email a minute per address
  const ok = { ok: true, message: 'If that email belongs to a pilot, a reset link is on its way.' };
  if (!(await r.set('forgotlimit:' + email, '1', { NX: true, EX: 60 }))) return res.json(ok);
  const name = await r.get('email:' + email);
  if (!name) return res.json(ok);
  const token = crypto.randomBytes(24).toString('hex');
  await r.set('reset:' + token, name, { EX: 3600 });
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'planetheplane.vercel.app';
  const link = `https://${host}/?reset=${token}`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [email], subject: 'Reset your Plane the Plane password', text: `Hi ${name},\n\nOpen this link within one hour to choose a new password:\n${link}\n\nIf you did not ask for this, ignore this email.` })
    });
  } catch (e) { /* the pilot can ask again */ }
  res.json(ok);
}
