# Contributing

Thanks for helping out! This is a small, dependency-free static site, so getting started is quick.

## Setup
```sh
git clone https://github.com/pH-li/presenter-helper.git
cd presenter-helper
npx serve public
```

You only need a recent Node.js (for `npx` and the syntax check). There is nothing to install.

## Workflow
1. Branch off `main` using a descriptive name, such as `feat/next-slide-preview` or `fix/timer-reset`.
2. Make your change.
3. Run the same check CI runs:
   ```sh
   for f in public/*.js; do node --check "$f"; done
   ```
4. Test by hand in a browser. Cover at least:
   - Creating, editing and deleting a presentation
   - In present mode: ← → between slides, ↑ ↓ scrolling, + − text size, and Space / R for the timer
   - Reloading the page and confirming your data is still there
   - A phone-width window (about 400px)
5. Open a pull request against `main`. CI must pass. If Netlify secrets are configured, a deploy preview link is posted on the PR so reviewers can try your change.
6. Merging to `main` deploys to production automatically.

## Guidelines
- **No build step or framework** unless there's a strong reason. Plain HTML, CSS and JavaScript keep deploys trivial.
- **All persistence goes through `public/store.js`.** Don't call `localStorage` (or a backend) from anywhere else.
- **Escape user content.** Anything a user typed must go through `esc()` before it goes into `innerHTML`, or be set via `textContent` / `.value`.
- **Keyboard first.** Every present-mode action should have a shortcut. If you add one, document it in the README's shortcut table and in the on-screen hint in `app.js`.
- **Keep the saved data format backward compatible.** Old saved data must still load. Extend `normalize()` in `app.js` with defaults for any new fields.
- **Never commit secrets.** A Supabase anon key is fine to ship in the frontend. Service-role keys and Netlify tokens are not.

## Commit messages
Write short, imperative subject lines ("Add next-slide preview", "Fix timer drift after pause"), with a body when the why isn't obvious.

## Reporting bugs
Open a GitHub issue with:
- What you did, what you expected, and what happened
- Your browser and OS
