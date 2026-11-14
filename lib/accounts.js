// Shared helpers for the pilot functions. The Redis database holds pilots, saves and sign-in sessions.
import crypto from 'node:crypto';
import { createClient } from 'redis';

export const ADMIN_NAME = 'human';
export const DEFAULT_SAVE = { coins: 1000, owned: [0], selected: 0, xp: 0, completed: 0, contract: null, log: [], liveries: [], planeLivery: {} };
const SESSION_SECONDS = 60 * 60 * 24 * 30;

let clientPromise = null;
// one connection per warm function instance
export function db() {
  if (!clientPromise) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on('error', () => {});
    clientPromise = client.connect().then(() => client).catch(err => { clientPromise = null; throw err; });
  }
  return clientPromise;
}

export const cleanName = n => (typeof n === 'string' ? n.trim().toLowerCase() : '');
export const validName = n => /^[a-z0-9_-]{1,16}$/.test(n);

export const newSalt = () => crypto.randomBytes(16).toString('hex');
export const hashPassword = (password, salt) => crypto.scryptSync(password, salt, 32).toString('hex');
export function samePassword(password, salt, hash) {
  const a = Buffer.from(hashPassword(password, salt), 'hex');
  const b = Buffer.from(String(hash), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// a sign-in lasts 30 days; the token is random and lives only in the page's memory
export async function startSession(name) {
  const token = crypto.randomBytes(32).toString('hex');
  const r = await db();
  await r.set('session:' + token, name, { EX: SESSION_SECONDS });
  return token;
}
// the pilot name behind the Bearer token, or null
export async function sessionName(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const r = await db();
  return r.get('session:' + token);
}

// Too many wrong passwords for one pilot name block further tries for 15 minutes.
export async function blocked(name) {
  const r = await db();
  return (Number(await r.get('fail:' + name)) || 0) >= 8;
}
export async function noteFail(name) {
  const r = await db();
  const n = await r.incr('fail:' + name);
  if (n === 1) await r.expire('fail:' + name, 900);
}
export async function clearFails(name) {
  const r = await db();
  await r.del('fail:' + name);
}
// the Bearer token of a request, or ''
export function tokenOf(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}
