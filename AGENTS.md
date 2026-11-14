# AGENTS.md

Guidance for AI coding agents working in this repository. Humans should read [CONTRIBUTING.md](CONTRIBUTING.md); everything there applies here too.

## What this is
Presenter Helper is a static web app for speakers. The present view shows one slide's notes on the top half of the screen and a timer on the bottom half.
- **Hosting:** Netlify's Git integration deploys `public/` to https://presentassist.netlify.app. The only build step is `scripts/write-config.js`, which writes `public/config.js` from environment variables.
- **Sync (optional):** Supabase handles sign-in and data storage. supabase-js loads from a CDN, and only when Supabase is configured. There are no npm dependencies.

## Architecture: MVC with native ES modules
| Path | Role |
| --- | --- |
| `public/index.html` | Shell; loads `config.js` (classic script), then `js/main.js` with `type="module"` |
| `public/config.js` | **Generated, git-ignored.** Sets `window.__APP_CONFIG__ = { supabaseUrl, supabaseAnonKey }` |
| `public/js/config.js` | Reads the generated config; `config.cloudEnabled` |
| `public/js/main.js` | Composition root. The **only** place objects are constructed and wired, including auth → sync → re-render |
| `public/js/router.js` | `Router` (hash routes `''`, `edit`, `present`, `account`; `router.current`), `href.*()` builders, `navigate()` |
| `public/js/utils.js` | DOM-free helpers: `esc`, `uid`, `clamp`, `plural`, `fmtDate`, `fmtDuration` |
| `public/js/models/presentation.js` | `normalize()`, `splitNotes()`, font constants |
| `public/js/models/presentationsModel.js` | `PresentationsModel`: the collection and all mutations; persists via an injected store. Also `subscribe()`, `setStore()`, `replaceAll()` (updates objects in place) and `adopt()` |
| `public/js/models/localStore.js` | `LocalStore` adapter (`load` / `save` / `clear`). The signed-out cache uses key `presenter-helper:v1`; each user gets `userStorageKey(id)` |
| `public/js/models/supabaseRemote.js` | `SupabaseRemote`: `fetchAll` / `upsert` / `remove` on the `presentations` table |
| `public/js/models/syncMerge.js` | Pure `mergeRemote()` (three-way, last-write-wins by `updatedAt`, handles deletes via `lastSynced`) and `diffForPush()` |
| `public/js/models/timer.js` | `Timer`, with an injectable clock; `status(targetMinutes)` returns `none`/`ok`/`warn`/`over` |
| `public/js/views/*.js` | `HomeView`, `EditView`, `PresentView`, `AccountView`, `syncLabels.js` and shared `ui.js` (`bindRoot`, `armConfirm`, `toast`, `downloadFile`) |
| `public/js/controllers/*.js` | One per route. `mount(id)` returns `false` (not found → home) or a cleanup function |
| `public/js/services/auth.js` | `AuthService`: magic-link sign-in (PKCE, so the code arrives as `?code=` and never clashes with the hash router), `onChange(user)` |
| `public/js/services/cloudSync.js` | `CloudSync`: offline-first engine. Pulls and merges on sign-in, on coming online and when the tab regains focus; debounced push; retries; status events |
| `public/js/services/supabaseClient.js` | Lazy `getSupabase()`; imports supabase-js from jsDelivr only when configured |
| `public/js/services/accountState.js` | `createAccount(auth, sync)`: the bundle controllers use for account status |
| `public/js/services/screen.js` | Wake lock and fullscreen wrappers |
| `supabase/migrations/*.sql` | Database schema and RLS. Applied by the Supabase GitHub integration. Must stay idempotent |
| `tests/*.test.js` | `node:test` unit tests: models, sync merge, the sync engine against a fake cloud, and the config script |
| `scripts/check.js` | CI static checks: required files, `node --check`, relative imports resolve |
| `scripts/write-config.js` | Env (+ `.env`) → `public/config.js`; rejects secret keys |
| `public/privacy.html`, `public/terms.html` | Static legal pages (no JS), styled with `style.css`. Contact: lyrwrites@gmail.com |
| `supabase/migrations/*_delete_my_account.sql` | `delete_my_account()` RPC (SECURITY DEFINER, `authenticated` only): deletes the caller from `auth.users`, which cascades to their presentations |

### Layer rules
- **Models:** no DOM, `window` or `document`. They must run in Node. Every change to a model needs a test.
- **Views:** render with `innerHTML` and attach delegated handlers via `bindRoot()` on `#app`, dispatching on `data-act` / `data-field`. They call the callbacks the controller passed to `bind()` and never import models.
- **Controllers:** call model methods, then update the view. Anything registered on `document` or `window`, and any interval, must be torn down in the cleanup function that `mount()` returns.
- **Persistence:** only store adapters (`LocalStore`, `SupabaseRemote`) and `CloudSync` may touch `localStorage` or the backend.
- **Sync is offline-first.** The model API stays synchronous and always works against the local cache. `CloudSync` reconciles with the cloud in the background. Never make UI wait on the network, except for sign-out, which flushes first.

## Data model
The local cache, under `presenter-helper:v1` (signed out) or `presenter-helper:v1:user:<id>`:
```js
{ presentations: [{ id, title, targetMinutes, fontSize, updatedAt, slides: [{ id, notes }] }] }
```
The cloud table `public.presentations` has the columns `(user_id, id, data jsonb, updated_at)`, with primary key `(user_id, id)` and RLS that limits every operation to `auth.uid() = user_id`.

Rules for changing the data:
- Any new field needs a default in `normalize()` so older saved data still loads. Don't change the keys or the data shape without a migration.
- Schema changes go in a **new** timestamped file in `supabase/migrations/`. Never edit a migration that has already been applied.
- `updatedAt` drives conflict resolution. Bump it for content edits (the model does this). Leave it alone for display preferences such as `fontSize`; those still sync, because the push diff compares whole JSON.

## Conventions
- **XSS:** user text goes through `esc()` before it enters HTML strings, or is assigned via `textContent` / `.value`.
- **Keyboard shortcuts** live in three places: `KEYMAP` in `presentController.js`, the `.keys` hint in `presentView.js`, and the README table. Keep all three in sync.
- Use `el.hidden` to show or hide elements, and keep layouts usable at about 400px wide.
- Don't add dependencies, frameworks or a build step unless asked.
- **Keep `privacy.html` true.** If a change sends user data somewhere new, update the policy and its "Last updated" date in the same PR. Examples: a new third-party service, analytics, an email provider, or a different storage region. Never add tracking or analytics without asking.

## Verifying changes
```sh
npm run check   # static checks (CI)
npm test        # unit tests (CI)
npm start       # write config from .env, serve ./public on :3000, exercise the UI
```
There are no automated UI tests yet. If your change touches behavior, say plainly what you did and didn't verify in a browser.

## Git workflow
- Never commit to `main`. Work on a branch named `<type>/<description>`, e.g. `feat/…`, `fix/…`, `refactor/…`, `docs/…`, `test/…`, `ci/…` or `chore/…`.
- PR titles start with the uppercase type: `FEAT: …`, `FIX: …`, `REFACTOR: …`, `DOCS: …`, `TEST: …`, `CI: …`, `CHORE: …`.
- CI (`npm run check` and `npm test`) must pass before merging.

## Don'ts
- Don't commit secrets: `.env`, `public/config.js`, Netlify tokens or Supabase service-role / `sb_secret_` keys. Only the anon / publishable key may reach the frontend.
- Don't disable RLS or add policies that aren't scoped to `auth.uid()`.
- Don't reach into the DOM from models, or into models from views.
