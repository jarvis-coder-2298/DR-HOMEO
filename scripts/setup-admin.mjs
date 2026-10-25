import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { hashPassword } from '../server/auth.js';

let muted = false;
const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback(); } });
const rl = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
try {
  process.stdout.write('Admin password (input hidden): ');
  muted = true;
  const password = await rl.question('');
  muted = false;
  process.stdout.write('\n');
  if (password.length < 8) throw new Error('Use at least 8 characters.');
  let previous = '';
  try { previous = await readFile('.env.local', 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const retained = previous.split(/\r?\n/).filter(line => !/^(ADMIN_USERNAME|ADMIN_PASSWORD_HASH|SESSION_SECRET)=/.test(line)).join('\n').trim();
  const values = `ADMIN_USERNAME=admin\nADMIN_PASSWORD_HASH=${hashPassword(password)}\nSESSION_SECRET=${randomBytes(48).toString('hex')}\n`;
  await writeFile('.env.local', `${values}${retained}\n`, { mode: 0o600 });
  console.log('Admin configured in .env.local. Restart the dev server after changing credentials.');
} finally { rl.close(); }
