import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../server/auth.js';

await mkdir('test-results', { recursive: true });
const dataFile = resolve(`test-results/browser-${randomUUID()}.local.json`);
const password = 'Browser-test-password-123!';
const base = 'http://127.0.0.1:5174';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], {
  env: { ...process.env, DATA_FILE: dataFile, ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: hashPassword(password), SESSION_SECRET: randomUUID() + randomUUID(), BLOB_STORE_ID: '', BLOB_READ_WRITE_TOKEN: '', VERCEL_OIDC_TOKEN: '', VERCEL: '' }, stdio: 'pipe', windowsHide: true,
});
let browser;
let activePage;
const errors = [];
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview did not start.')), 20000);
    server.stdout.on('data', data => { if (data.toString().includes('5174')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', data => process.stderr.write(data));
    server.on('exit', code => { clearTimeout(timer); reject(new Error(`Preview exited: ${code}`)); });
  });
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  activePage = page;
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.getByRole('heading', { level: 1 }).waitFor();
  assert.match(await page.title(), /Dr. Kishwar Shah/);
  await page.screenshot({ path: 'test-results/portfolio-desktop.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal((await page.request.get(`${base}/data/site.json`)).status(), 403);
  console.log('PASS: Desktop portfolio renders; private data files are blocked.');

  await page.getByRole('button', { name: 'Leave feedback' }).click();
  await page.getByRole('radio', { name: '5 stars', exact: true }).check();
  await page.getByLabel('Display name', { exact: true }).fill('Browser test patient');
  await page.getByLabel('Email (optional, private)').fill('browser-private@example.com');
  await page.getByLabel('Your experience', { exact: true }).fill('A browser-tested feedback submission.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await page.getByRole('heading', { name: 'Thank you for sharing.' }).waitFor();
  await page.getByRole('button', { name: 'Back to the portfolio' }).click();
  assert.equal(await page.getByText('A browser-tested feedback submission.', { exact: false }).count(), 0);
  console.log('PASS: Feedback submits successfully and stays unpublished.');

  await page.goto(`${base}/admin`);
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in to dashboard' }).click();
  await page.getByRole('heading', { name: 'Your story, in your words.' }).waitFor();
  await page.getByLabel('Homepage introduction', { exact: true }).fill('An updated introduction verified in the browser.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('status').filter({ hasText: 'Saved.' }).waitFor();
  await page.reload();
  await page.getByLabel('Homepage introduction', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Homepage introduction', { exact: true }).inputValue(), 'An updated introduction verified in the browser.');
  await page.getByRole('button', { name: 'Education', exact: true }).click();
  await page.getByRole('button', { name: 'Add education', exact: true }).click();
  await page.getByLabel('Degree / qualification', { exact: true }).last().fill('Test qualification');
  await page.getByLabel('Institution', { exact: true }).last().fill('Test institution');
  await page.getByLabel('Year or progress', { exact: true }).last().fill('Test year');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('status').filter({ hasText: 'Saved.' }).waitFor();
  console.log('PASS: Admin sign-in, profile edits, new education and persistence after reload.');

  await page.getByRole('button', { name: /Patient feedback/ }).click();
  await page.getByRole('button', { name: 'Approve & publish' }).click();
  await page.getByRole('status').filter({ hasText: 'approved and published' }).waitFor();
  await page.getByRole('button', { name: 'Approved', exact: true }).click();
  await page.screenshot({ path: 'test-results/admin-desktop.png', fullPage: true });
  await page.goto(base);
  await page.getByText('“A browser-tested feedback submission.”', { exact: true }).waitFor();
  assert.equal(await page.getByText('browser-private@example.com').count(), 0);
  await page.goto(`${base}/reviews`);
  await page.getByText('“A browser-tested feedback submission.”', { exact: true }).waitFor();
  console.log('PASS: Approved feedback appears on homepage and reviews page; email stays private.');

  await page.goto(`${base}/admin`);
  await page.getByRole('button', { name: /Patient feedback/ }).click();
  await page.getByRole('button', { name: 'Approved', exact: true }).click();
  await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'not visible publicly' }).waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download JSON backup' }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'doctor-portfolio-backup.json');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('heading', { name: 'Welcome back, Doctor.' }).waitFor();
  console.log('PASS: Unpublish, JSON backup download, and sign-out.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.getByRole('heading', { level: 1 }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'test-results/portfolio-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'About me', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded'), 'false');
  await page.getByRole('button', { name: 'Leave feedback' }).click();
  await page.getByRole('dialog').waitFor();
  await page.screenshot({ path: 'test-results/feedback-mobile.png' });
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.goto(`${base}/admin`);
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in to dashboard' }).click();
  await page.getByRole('heading', { name: 'Your story, in your words.' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'test-results/admin-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: Mobile portfolio, menu, feedback dialog, dashboard, and no browser runtime errors.');
} catch (error) {
  if (activePage) await activePage.screenshot({ path: 'test-results/failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill();
  await rm(dataFile, { force: true });
}
