# Dr. Kishwar Shah — doctor portfolio

A responsive React + Vite portfolio with a private doctor dashboard, animated botanical artwork, editable content, and moderated patient feedback. The backend runs locally with Vite and on Vercel as a Node.js function.

## Run locally

Requires Node.js 20.19+ (Node.js 22 LTS recommended).

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The doctor dashboard is **http://127.0.0.1:5173/admin**.

The requested `admin` account is configured in this workspace's ignored `.env.local`, using the password supplied in the request. The password is stored as a salted scrypt hash, never included in the browser bundle or the tracked source.

For a fresh checkout, or to change the password:

```sh
npm run setup
```

Enter the desired password at the hidden prompt. This creates or updates `.env.local` with `ADMIN_USERNAME=admin`, a password hash, and a random session secret. Restart the development server afterwards. Rotating these values invalidates existing sessions.

## Publish on Vercel

1. Push the project to your Git repository, then import it in Vercel. Select the **Vite** preset. The included `vercel.json` sets `npm run build`, output directory `dist`, and API/page routing.
2. In your Vercel project, open **Storage**, create a **private Vercel Blob store**, and connect it to the project. Make sure `BLOB_READ_WRITE_TOKEN` is available to the deployment. Use separate stores for preview and production if you want to keep their data separate.
3. In **Settings → Environment Variables**, add the exact values of `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, and `SESSION_SECRET` from your local `.env.local`. Copy them privately; do not commit this file. These are server variables: do **not** prefix them with `VITE_`.
4. Deploy or redeploy after configuring the variables. Visit `/admin`, sign in, save an edit, and submit and approve a test review to confirm your connected storage works. Delete the test review afterwards.
5. Confirm the council registration renewal before sharing the portfolio. The current content states only the original 2019 registration and explicitly leaves renewal unverified.

The app deliberately returns a setup error if deployed on Vercel without durable storage. It does not pretend that a local serverless file can persist edits.

Vercel Blob storage details: [private storage](https://vercel.com/docs/vercel-blob/private-storage), [SDK and conditional writes](https://vercel.com/docs/vercel-blob/using-blob-sdk).

## How JSON storage works

- `data/site.json` contains the initial public profile, experience, education, and focus areas.
- Local use creates `data/site.local.json` on the first write. It contains content, a revision counter, feedback, and temporary rate-limit records. It is ignored by Git and blocked from direct browser access by Vite.
- On Vercel, the same JSON document lives at `portfolio/site.json` in the **private** Blob store. Only the server can access it. Writes use ETag comparisons, retry on conflicts, and read the latest version to avoid silently overwriting another request.
- Profile saves check a revision counter. If a second editor has already saved, the dashboard asks you to reload instead of overwriting their work.
- After the runtime JSON document exists, it is the source of truth; later edits to the seed file do not replace live data.
- **Download JSON backup** exports the current profile and all feedback to a local file. It contains private feedback email addresses, so treat backups as private. Backups omit internal throttling records. There is no public backup endpoint or automatic restore feature.

The first Vercel deployment starts from the seed. Local edits are not automatically uploaded: repeat desired edits in the deployed dashboard. A redeployment preserves the connected Blob document.

## Dashboard

- **Profile & content:** name, initials, location, email, headings, introduction, biography, practice status, registration wording, and optional HTTPS portrait URL.
- **Experience / Education / Focus areas:** add, edit, remove, and reorder entries; save when ready.
- **Patient feedback:** review pending submissions, approve and publish, reject, unpublish, return to pending, or permanently delete.
- **Download JSON backup:** save a private copy of the current data.

A portrait URL must point to an actual HTTPS image. The supplied design uses an original botanical illustration and monogram until a photo is added. No stock person is presented as the doctor.

## Feedback workflow

Visitors choose a 1–5 star rating, enter a display name and message, optionally provide an email, and consent to publication. The form asks them not to include medical or sensitive personal details. Every submission starts as **pending**. Only the doctor can approve it.

Approved feedback appears on both the homepage and `/reviews`. Public responses include only the display name, message, rating, and date. Email addresses and moderation statuses remain private. Rejecting or unpublishing removes feedback from the public API immediately; an already-open page shows the change on its next reload.

Submissions go to the dashboard. No automated email notification service is configured. The contact button opens the visitor's email app addressed to `drkks786@gmail.com`.

## Security and scope

- Server-side password verification, signed 8-hour HttpOnly/SameSite cookies, Secure cookies on Vercel.
- Every admin API route checks authentication. State-changing requests check origin and require a custom request header.
- Persistent limits: 10 login attempts per 15 minutes and 5 feedback submissions per hour per IP. Feedback includes a honeypot and server validation.
- Request bodies are limited to 100 KB, each content list to 30 entries, and the feedback collection to 5,000 submissions. This JSON approach is intended for a modest portfolio, not a high-volume clinic records system.
- Credentials are supplied through server environment variables; the public build contains none.
- Current council renewal, contact numbers, registration numbers, medical outcomes, and testimonials were not invented.
- Fonts use Google Fonts, with local system fallbacks. Optional portrait URLs load from the configured image host.

## Checks

```sh
npm test
npm run build
npm audit
```

`npm test` covers access control, login, origin checks, validation, persistent JSON edits, stale-edit protection, moderation, privacy, concurrent writes, export, throttling, and logout.

Browser checks use Playwright:

```sh
npx playwright install chromium
npm run test:browser
```

If Chromium is already installed elsewhere, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path. The browser test starts a separate Vite server on port 5174, uses an isolated temporary JSON file and test credentials, checks desktop/mobile workflows, writes screenshots to `test-results/`, and removes the temporary data afterwards. Your real portfolio content is not changed.

`npm run preview` only previews the static production assets; use `npm run dev` or Vercel to exercise the API.

## Structure

```text
src/App.jsx          Public portfolio, reviews, feedback form
src/Admin.jsx        Sign-in and doctor dashboard
src/styles.css       Responsive visual design and animation
api/index.js         Vercel-compatible API handler
server/auth.js       Password hashing and signed sessions
server/store.js      Local/private Blob JSON storage
server/validation.js Server-side content validation
data/site.json       Initial public content
tests/               API and browser workflow checks
vercel.json          Deployment, routing, and response headers
```
