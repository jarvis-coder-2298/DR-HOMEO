import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import handler from '../api/index.js';
import { hashPassword } from '../server/auth.js';

let server, base, session, reviewId;
const path = resolve(`test-results/api-${randomUUID()}.local.json`);
before(async () => {
  process.env.DATA_FILE = path;
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD_HASH = hashPassword('Test-only-password-123!');
  process.env.SESSION_SECRET = 'test-only-session-secret-at-least-32-characters';
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL;
  server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); await rm(path, { force: true }); });
async function request(route, method = 'GET', data, auth = false, extra = {}) {
  const response = await fetch(`${base}/api/${route}`, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'portfolio', Origin: base, ...(auth ? { Cookie: session } : {}), ...extra }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
  return { response, status: response.status, data: await response.json() };
}
const submission = { name: 'Test patient', email: 'private@example.com', rating: 4, message: 'A thoughtful test experience.', consent: true };

test('public content exposes supplied profile and no private data', async () => {
  const result = await request('content');
  assert.equal(result.status, 200);
  assert.equal(result.data.content.profile.name, 'Dr. Kishwar Shah');
  assert.deepEqual(result.data.reviews, []);
  assert.deepEqual(Object.keys(result.data).sort(), ['content', 'reviews']);
});
test('all administrative data and writes require authentication', async () => {
  for (const route of ['admin/content', 'admin/feedback', 'admin/export']) assert.equal((await request(route)).status, 401);
  assert.equal((await request('admin/content', 'PUT', { content: {} })).status, 401);
  assert.equal((await request('admin/feedback', 'PATCH', { id: 'anything', status: 'approved' })).status, 401);
});
test('cross-origin and missing request header are rejected', async () => {
  assert.equal((await request('feedback', 'POST', submission, false, { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await request('feedback', 'POST', submission, false, { 'X-Requested-With': '' })).status, 403);
});
test('invalid login fails; correct credentials issue a private session cookie', async () => {
  assert.equal((await request('session', 'POST', { username: 'admin', password: 'incorrect' })).status, 401);
  const result = await request('session', 'POST', { username: 'admin', password: 'Test-only-password-123!' });
  assert.equal(result.status, 200);
  const raw = result.response.headers.get('set-cookie');
  assert.match(raw, /HttpOnly/); assert.match(raw, /SameSite=Strict/);
  session = raw.split(';')[0];
  assert.equal((await request('session', 'GET', undefined, true)).data.authenticated, true);
  assert.equal((await request('session', 'GET', undefined, false, { Cookie: `${session}tampered` })).data.authenticated, false);
});
test('profile updates persist as JSON and reject stale changes', async () => {
  const current = (await request('admin/content', 'GET', undefined, true)).data;
  current.content.profile.location = 'Pune · Test update';
  const saved = await request('admin/content', 'PUT', current, true);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.revision, 1);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).content.profile.location, 'Pune · Test update');
  assert.equal((await request('content')).data.content.profile.location, 'Pune · Test update');
  assert.equal((await request('admin/content', 'PUT', current, true)).status, 409);
  const invalid = structuredClone(saved.data);
  invalid.content.profile.photoUrl = 'javascript:alert(1)';
  assert.equal((await request('admin/content', 'PUT', invalid, true)).status, 400);
});
test('feedback validates consent, ratings and length', async () => {
  for (const changes of [{ consent: false }, { rating: 6 }, { email: 'invalid' }, { message: 'x'.repeat(2001) }]) assert.equal((await request('feedback', 'POST', { ...submission, ...changes })).status, 400);
});
test('pending feedback is private; approval publishes only safe fields', async () => {
  assert.equal((await request('feedback', 'POST', submission)).status, 201);
  assert.equal((await request('content')).data.reviews.length, 0);
  const rows = (await request('admin/feedback', 'GET', undefined, true)).data.feedback;
  assert.equal(rows.length, 1); assert.equal(rows[0].status, 'pending');
  assert.equal(rows[0].email, submission.email); reviewId = rows[0].id;
  assert.equal((await request('admin/feedback', 'PATCH', { id: reviewId, status: 'approved' }, true)).status, 200);
  const reviews = (await request('content')).data.reviews;
  assert.equal(reviews.length, 1); assert.equal(reviews[0].name, submission.name);
  assert.equal(reviews[0].email, undefined); assert.equal(reviews[0].status, undefined);
});
test('unpublishing removes a review; deletion permanently removes it', async () => {
  assert.equal((await request('admin/feedback', 'PATCH', { id: reviewId, status: 'rejected' }, true)).status, 200);
  assert.equal((await request('content')).data.reviews.length, 0);
  assert.equal((await request('admin/feedback', 'DELETE', { id: reviewId }, true)).status, 200);
  assert.equal((await request('admin/feedback', 'GET', undefined, true)).data.feedback.length, 0);
});
test('concurrent submissions are retained and submission limit persists', async () => {
  const results = await Promise.all([0, 1, 2, 3].map(n => request('feedback', 'POST', { ...submission, name: `Concurrent ${n}` })));
  assert.ok(results.every(r => r.status === 201));
  assert.equal((await request('admin/feedback', 'GET', undefined, true)).data.feedback.length, 4);
  assert.equal((await request('feedback', 'POST', submission)).status, 429);
});
test('admin backup omits internal throttling records and includes pending feedback', async () => {
  const result = await request('admin/export', 'GET', undefined, true);
  assert.equal(result.status, 200); assert.equal(result.data.feedback.length, 4);
  assert.equal(result.data.rateLimits, undefined);
  assert.match(result.response.headers.get('content-disposition'), /attachment/);
});
test('login attempts are throttled and logout clears the cookie', async () => {
  for (let i = 0; i < 8; i++) assert.equal((await request('session', 'POST', { username: 'admin', password: 'incorrect' })).status, 401);
  assert.equal((await request('session', 'POST', { username: 'admin', password: 'incorrect' })).status, 429);
  const result = await request('session', 'DELETE', undefined, true);
  assert.match(result.response.headers.get('set-cookie'), /Max-Age=0/);
});
