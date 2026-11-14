# Contributing

Thanks for helping out! This is a small, dependency-free static site, so getting started is quick.

## Setup
```sh
git clone https://github.com/pH-li/presenter-helper.git
cd presenter-helper
npm start          # writes config from .env, serves ./public on http://localhost:3000
```

You only need Node.js 20 or newer. There's nothing to `npm install`.

## Branches and pull requests
Never commit directly to `main`. Every change goes on its own branch and lands through a pull request.

Name branches `<type>/<short-description>` and start PR titles with the same type in uppercase:

| Type | Use for | Branch example | PR title example |
| --- | --- | --- | --- |
| `FEAT` | New user-facing functionality | `feat/next-slide-preview` | `FEAT: Show a preview of the next slide` |
| `FIX` | Bug fixes | `fix/timer-reset` | `FIX: Timer keeps running after reset` |
| `REFACTOR` | Code changes with no behavior change | `refactor/mvc` | `REFACTOR: Split app into MVC modules` |
| `DOCS` | Documentation only | `docs/readme-deploy` | `DOCS: Clarify Netlify setup` |
| `TEST` | Adding or fixing tests | `test/timer-edge-cases` | `TEST: Cover timer over-time state` |
| `CI` | Workflows and build tooling | `ci/cache-node` | `CI: Cache npm in workflow` |
| `CHORE` | Maintenance (deps, config, cleanup) | `chore/gitignore` | `CHORE: Ignore editor files` |

## Workflow
1. Branch off `main` using the naming above.
2. Make your change.
3. Run what CI runs:
   ```sh
   npm run check
   npm test
   ```
4. Test by hand in a browser. Cover at least:
   - Creating, editing and deleting a presentation
   - In present mode: ← → between slides, ↑ ↓ scrolling, + − text size, and Space / R for the timer
   - Reloading the page and confirming your data is still there
   - A phone-width window (about 400px)
5. Open a pull request against `main`. CI must pass. If Netlify secrets are configured, a deploy preview link is posted on the PR so reviewers can try your change.
6. Merging to `main` deploys to production automatically.

## Architecture (MVC)
The code lives in `public/js/`. See the README for the full file map.

- **Models** (`models/`) hold data and rules. They must not touch the DOM, `window` or `document`, and they get unit tests in `tests/`.
- **Views** (`views/`) render HTML and translate DOM events into callbacks passed to `bind()`. They contain no app logic and never import models.
- **Controllers** (`controllers/`) own one route each. A controller's `mount(id)` binds its view to the model and returns either `false` (not found) or a cleanup function.
- **Services** (`services/`) wrap browser APIs such as wake lock and fullscreen.
- **`main.js`** is the only place where objects are constructed and wired together.

## Guidelines
- **No build step, framework or runtime dependencies** unless there's a strong reason.
- **Persistence goes through a store adapter** (`models/localStore.js`). Only adapters touch `localStorage` or a backend.
- **Escape user content.** Anything a user typed must go through `esc()` before it goes into `innerHTML`, or be set via `textContent` / `.value`.
- **Keyboard first.** Every present-mode action should have a shortcut. If you add one, update `KEYMAP` in `presentController.js`, the on-screen hint in `presentView.js`, and the README table.
- **Keep the saved data format backward compatible.** Old saved data must still load. Add defaults for new fields in `normalize()` (`models/presentation.js`).
- **Add tests** for any new model logic.
- **Never commit secrets.** `.env` is git-ignored. A Supabase anon key is fine to ship in the frontend. Service-role keys and Netlify tokens are not.

## Commit messages
Write short, imperative subject lines ("Add next-slide preview", "Fix timer drift after pause"), with a body when the why isn't obvious.

## Reporting bugs
Open a GitHub issue with:
- What you did, what you expected, and what happened
- Your browser and OS
