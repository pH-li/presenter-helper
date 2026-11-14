# AGENTS.md

Guidance for AI coding agents working in this repository. Humans should read [CONTRIBUTING.md](CONTRIBUTING.md); everything there applies here too.

## What this is
Presenter Helper is a static web app for speakers. The present view shows one slide's notes on the top half of the screen and a timer on the bottom half. It is deployed to Netlify from `public/`, with no build step and no runtime dependencies.

## Architecture: MVC with native ES modules
| Path | Role |
| --- | --- |
| `public/index.html` | Shell; loads `js/main.js` with `type="module"` |
| `public/js/main.js` | Composition root. The **only** place objects are constructed and wired |
| `public/js/router.js` | `Router` (hash routes `''`, `edit`, `present`), `href.*()` builders, `navigate()` |
| `public/js/utils.js` | DOM-free helpers: `esc`, `uid`, `clamp`, `plural`, `fmtDate`, `fmtDuration` |
| `public/js/models/presentation.js` | `normalize()`, `splitNotes()`, font constants |
| `public/js/models/presentationsModel.js` | `PresentationsModel`: the collection and all mutations; persists via an injected store |
| `public/js/models/localStore.js` | `LocalStore` adapter (`load()` / `save()`), with storage injectable for tests |
| `public/js/models/timer.js` | `Timer`, with an injectable clock; `status(targetMinutes)` returns `none`/`ok`/`warn`/`over` |
| `public/js/views/*.js` | `HomeView`, `EditView`, `PresentView` and shared `ui.js` (`bindRoot`, `armConfirm`, `toast`, `downloadFile`) |
| `public/js/controllers/*.js` | One per route. `mount(id)` returns `false` (not found → home) or a cleanup function |
| `public/js/services/screen.js` | Wake lock and fullscreen wrappers |
| `tests/*.test.js` | `node:test` unit tests for models and utils |
| `scripts/check.js` | CI static checks: required files, `node --check`, relative imports resolve |

### Layer rules
- **Models:** no DOM, `window` or `document`. They must run in Node. Every change to a model needs a test.
- **Views:** render with `innerHTML` and attach delegated handlers via `bindRoot()` on `#app`, dispatching on `data-act` / `data-field`. They call the callbacks the controller passed to `bind()` and never import models.
- **Controllers:** call model methods, then update the view. Anything registered on `document` or `window`, and any interval, must be torn down in the cleanup function that `mount()` returns.
- **Persistence:** only store adapters may touch `localStorage` or a backend.

## Data model
Stored under the localStorage key `presenter-helper:v1`:
```js
{ presentations: [{ id, title, targetMinutes, fontSize, updatedAt, slides: [{ id, notes }] }] }
```
Any new field needs a default in `normalize()` so older saved data still loads. Don't change the key or the data shape without a migration.

## Conventions
- **XSS:** user text goes through `esc()` before it enters HTML strings, or is assigned via `textContent` / `.value`.
- **Keyboard shortcuts** live in three places: `KEYMAP` in `presentController.js`, the `.keys` hint in `presentView.js`, and the README table. Keep all three in sync.
- Use `el.hidden` to show or hide elements, and keep layouts usable at about 400px wide.
- Don't add dependencies, frameworks or a build step unless asked.

## Verifying changes
```sh
npm run check   # static checks (CI)
npm test        # unit tests (CI)
npm start       # serve ./public and exercise the UI in a browser
```
There are no automated UI tests yet. If your change touches behavior, say plainly what you did and didn't verify in a browser.

## Git workflow
- Never commit to `main`. Work on a branch named `<type>/<description>`, e.g. `feat/…`, `fix/…`, `refactor/…`, `docs/…`, `test/…`, `ci/…` or `chore/…`.
- PR titles start with the uppercase type: `FEAT: …`, `FIX: …`, `REFACTOR: …`, `DOCS: …`, `TEST: …`, `CI: …`, `CHORE: …`.
- CI (`npm run check` and `npm test`) must pass before merging.

## Planned work
- **Supabase auth + cloud sync.** Add a new store adapter with the same `load()` / `save()` interface (likely async, so the model API may need to become async), keeping `LocalStore` as an offline fallback. Config comes from `SUPABASE_URL` / `SUPABASE_ANON_KEY` (see `.env.example`). Only the anon key may reach the frontend, and row-level security must restrict each row to its owner.

## Don'ts
- Don't commit secrets: `.env`, Netlify tokens or Supabase service-role keys.
- Don't reach into the DOM from models, or into models from views.
