import { createHash, randomUUID } from 'node:crypto';
import { readState, mutateState } from '../server/store.js';
import { passwordMatches, sessionCookie, cookie, isAuthenticated } from '../server/auth.js';
import { string, email, validateContent, fail } from '../server/validation.js';

async function body(req) {
  if (!req.headers['content-type']?.includes('application/json')) fail('Use application/json.', 415);
  if (req.body !== undefined) {
    const encoded = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(encoded) > 100000) fail('Request too large.', 413);
    try { return JSON.parse(encoded); } catch { fail('Invalid JSON.'); }
  }
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 100000) fail('Request too large.', 413); }
  try { return JSON.parse(raw); } catch { fail('Invalid JSON.'); }
}
function sameOrigin(req) {
  if (req.headers['x-requested-with'] !== 'portfolio') fail('Invalid request.', 403);
  if (req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) fail('Invalid origin.', 403); }
    catch { fail('Invalid origin.', 403); }
  }
}
async function limit(req, type, count, windowMs) {
  // Vercel sets this header; local requests use the socket address.
  const ip = process.env.VERCEL ? req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || 'unknown' : req.socket.remoteAddress || 'local';
  const key = createHash('sha256').update(`${process.env.SESSION_SECRET || 'local'}:${type}:${ip}`).digest('hex');
  await mutateState(state => {
    const now = Date.now();
    state.rateLimits = Object.fromEntries(Object.entries(state.rateLimits || {}).filter(([, item]) => item.reset > now));
    const record = state.rateLimits[key] || { count: 0, reset: now + windowMs };
    if (record.count >= count) fail('Too many attempts. Please try again later.', 429);
    record.count++;
    state.rateLimits[key] = record;
  });
}
const publicReviews = state => state.feedback.filter(r => r.status === 'approved').map(({ id, name, rating, message, createdAt }) => ({ id, name, rating, message, createdAt }));

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  try {
    const url = new URL(req.url, 'http://localhost');
    const route = url.searchParams.get('route') || url.pathname.replace(/^\/api\/?/, '');
    const method = req.method;
    if (!['GET', 'HEAD'].includes(method)) sameOrigin(req);
    if (route === 'content' && method === 'GET') {
      const { state } = await readState();
      return send(200, { content: state.content, reviews: publicReviews(state) });
    }
    if (route === 'session') {
      if (method === 'GET') return send(200, { authenticated: isAuthenticated(req) });
      if (method === 'DELETE') { res.setHeader('Set-Cookie', cookie()); return send(200, { ok: true }); }
      if (method === 'POST') {
        const input = await body(req);
        const username = string(input?.username, 'Username', 100);
        const password = string(input?.password, 'Password', 256);
        await limit(req, 'login', 10, 15 * 60 * 1000);
        if (!passwordMatches(username, password)) fail('Incorrect username or password.', 401);
        res.setHeader('Set-Cookie', sessionCookie());
        return send(200, { authenticated: true });
      }
    }
    if (route.startsWith('admin/') && !isAuthenticated(req)) fail('Please sign in to continue.', 401);
    if (route === 'admin/content') {
      if (method === 'GET') { const { state } = await readState(); return send(200, { content: state.content, revision: state.revision }); }
      if (method === 'PUT') {
        const input = await body(req);
        const content = validateContent(input?.content);
        const revision = await mutateState(state => {
          if (state.revision !== input.revision) fail('Details changed in another session. Reload the editor before saving.', 409);
          state.content = content;
          return ++state.revision;
        });
        return send(200, { content, revision });
      }
    }
    if (route === 'feedback' && method === 'POST') {
      const input = await body(req);
      if (input?.website) return send(201, { ok: true });
      const name = string(input?.name, 'Display name', 80);
      const contact = email(input?.email || '', false);
      const message = string(input?.message, 'Feedback', 2000);
      if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) fail('Choose a rating from 1 to 5.');
      if (input.consent !== true) fail('Please consent to publishing your name and feedback after approval.');
      await limit(req, 'feedback', 5, 60 * 60 * 1000);
      await mutateState(state => {
        if (state.feedback.length >= 5000) fail('Feedback is temporarily unavailable. Please email the doctor.', 503);
        state.feedback.unshift({ id: randomUUID(), name, email: contact, message, rating: input.rating, status: 'pending', createdAt: new Date().toISOString() });
      });
      return send(201, { ok: true });
    }
    if (route === 'admin/feedback') {
      if (method === 'GET') { const { state } = await readState(); return send(200, { feedback: state.feedback }); }
      if (method === 'PATCH' || method === 'DELETE') {
        const input = await body(req);
        await mutateState(state => {
          const review = state.feedback.find(r => r.id === input?.id);
          if (!review) fail('Feedback not found.', 404);
          if (method === 'DELETE') { state.feedback = state.feedback.filter(r => r.id !== input.id); return; }
          if (!['approved', 'rejected', 'pending'].includes(input.status)) fail('Invalid feedback status.');
          review.status = input.status;
        });
        return send(200, { ok: true });
      }
    }
    if (route === 'admin/export' && method === 'GET') {
      const { state } = await readState();
      res.setHeader('Content-Disposition', 'attachment; filename="doctor-portfolio-backup.json"');
      return send(200, { content: state.content, revision: state.revision, feedback: state.feedback });
    }
    return send(404, { error: 'Endpoint not found.' });
  } catch (error) {
    if (!error.status) console.error('Portfolio API error:', error.name, error.code || 'unexpected_error');
    send(error.status || 500, { error: error.status ? error.message : 'Unable to complete the request. Please try again.' });
  }
}
