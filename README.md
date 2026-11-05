# WriteSpace

A browser-local plain-text publishing demo built with React 18, Vite 5, React Router 6 and Tailwind CSS 3. Guests discover recent posts, registered writers manage their own writing, and administrators oversee posts and local accounts.

## Important demo boundary

**Do not use real passwords or sensitive content.** Passwords are plaintext in localStorage. The built-in administrator login is `admin` / `admin`. Client-side role and ownership checks are usability safeguards, not trusted authentication or authorization. Browser owners can inspect or change all data. There is no backend, API, database, encryption, shared publication, cross-device sync or central backup.

Domain data uses `writespace_posts`, `writespace_users`, and `writespace_session`. Appearance independently uses scalar `writespace_theme` (`light` or `dark`), defaulting to light for missing, invalid or inaccessible values. The shared Dark mode toggle is keyboard-operable; failed preference writes retain the active appearance. Logout preserves theme. The live editor counter is informational UTF-16 string length, imposes no maximum and is never stored with posts. Clearing browser storage loses the only copy. Whole-array writes are last-write-wins across tabs. Failed writes show recovery guidance and do not claim successful persistence. Registration can save an account before a session write fails; follow the inline guidance to log in, rather than registering again.

## Run locally

Use Node 20+ and npm. All application commands run from `frontend/`.

```sh
cd frontend
npm ci --no-bin-links
cp .env.example .env
npm run dev
```

`.env` is ignored. The sample config selects local host/ports and the E2E preview URL; no secrets or API values apply. Vite uses build-time public configuration, not a runtime secret store. The fonts are platform Georgia and Arial: no network font request is required.

## Build and preview

```sh
cd frontend
npm run build
npm run preview
```

The build emits `frontend/dist/`. Runtime is static assets only. Direct route loads need history fallback, supplied in `frontend/nginx.conf`. The Dockerfile uses a Node build stage and nginx serving stage, port 80, root health path `/` (optional `/healthz`).

```sh
docker build -t writespace ./frontend
docker run --rm -p 8080:80 writespace
```

Container commands are deployment instructions, not evidence of a verified Docker build in this run. AWS ECR/ECS/ALB/CloudFront delivery is for downstream DevOps; this Developer stage did not deploy AWS infrastructure. No Vercel target or backend proxy is included.

## Tests and evidence

```sh
cd frontend
npm test
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e -- --workers=1
```

Current brownfield verification: baseline **451 tests passed in 8 files**; final Vitest/Testing Library suite **570 tests passed in 13 files**. Four feature slices were independently verified and committed. Independent read-only test review passed in round 2, score **1.0**, zero high failures. Production Vite build passed.

**E2E is infrastructure-blocked, not passed.** In this run Playwright 1.49.1 hung without stdout/stderr on a 600-second full-suite attempt, a 300-second guest-local copy retry and a 180-second targeted retry. The human approved delivery with this warning. Eight reviewed journey specs remain in `frontend/e2e/`. Standalone Chromium preflight succeeded after installing its missing browser binary and restarting preview: five representative desktop/mobile public, login-error, editor and Admin states were captured in `frontend/preflight/`. This is not a substitute for journey tests. API/database/backend integration tests do not apply. AWS deployment and Docker image execution were not verified by this Developer run.

**Dependency audit warning:** npm reported 11 advisories (2 critical, 7 high, 2 moderate) in the pinned toolchain/runtime dependencies. Versions retain the prescribed Vite 5/Router 6 stack. Do not expose Vite or Vitest development/UI servers publicly. Review dependency upgrades before broader distribution; this run did not claim the advisories resolved.

## Routes and product decisions

Public `/`; guest-only `/login`, `/register`; authenticated `/blogs`, `/blog/:id`, `/write`, `/edit/:id`; administrator-only `/admin`, `/users`. Unknown addresses render a local home-linked fallback. Post content is text, not HTML. Deletions require explicit browser confirmation; default Admin and the current account cannot be deleted through the UI.

Canonical roles are `admin` and `user`; the built-in identity has ID `admin` and display name `Admin`, as approved by the human. The fourth dashboard card retains `Total users` with an em dash and `Metric pending definition`; no additional statistic is invented. The prescribed colorful accents are retained on light surfaces; the full-page rainbow gradient was replaced with a paper hero under the Developer UI rule.

## Source structure

`frontend/src/utils` owns storage, local identity, posts and accounts. `components` owns role navigation/guards/cards/rows. `pages` owns route views. `App.jsx` composes routes; `main.jsx` supplies the one BrowserRouter. State uses only useState/useEffect. There is no Context, TypeScript, state library, data API client or automatic seed data.
