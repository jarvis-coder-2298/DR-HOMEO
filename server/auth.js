import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function config() {
  if (!process.env.ADMIN_PASSWORD_HASH || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw Object.assign(new Error('Admin setup is incomplete. Configure ADMIN_PASSWORD_HASH and SESSION_SECRET.'), { status: 503 });
  }
  return process.env.SESSION_SECRET;
}
export function passwordMatches(username, password) {
  config();
  const [salt, hash] = process.env.ADMIN_PASSWORD_HASH.split(':');
  if (!salt || !/^[a-f0-9]{128}$/.test(hash || '')) throw Object.assign(new Error('Admin password configuration is invalid.'), { status: 503 });
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex')) && username === (process.env.ADMIN_USERNAME || 'admin');
}
const sign = (value) => createHmac('sha256', config() + process.env.ADMIN_PASSWORD_HASH).update(value).digest('base64url');
export function sessionCookie() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return cookie(`${payload}.${sign(payload)}`, 28800);
}
export function cookie(value = '', maxAge = 0) {
  return `doctor_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
export function isAuthenticated(req) {
  try {
    const raw = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('doctor_session='))?.slice(15);
    if (!raw) return false;
    const [payload, signature] = raw.split('.');
    const expected = Buffer.from(sign(payload));
    const supplied = Buffer.from(signature || '');
    return supplied.length === expected.length && timingSafeEqual(expected, supplied) && JSON.parse(Buffer.from(payload, 'base64url')).exp > Date.now();
  } catch { return false; }
}
