# AGENTS.md

Guidance for AI coding agents working in this repository. Humans should read [CONTRIBUTING.md](CONTRIBUTING.md); everything there applies here too.

## What this is
Presenter Helper is a static web app for speakers. The present view shows one slide's notes on the top half of the screen and a timer on the bottom half. It is deployed to Netlify from the `public/` directory, with no build step.

## Layout
| Path | Purpose |
| --- | --- |
| `public/index.html` | Page shell; loads `store.js`, then `app.js` (classic scripts, not ES modules) |
| `public/app.js` | Everything else: hash router (`#/`, `#/edit/<id>`, `#/present/<id>`), the three views, and the timer and keyboard handling |
| `public/store.js` | The **only** persistence layer. Exposes the global `Store` with `load()` and `save(data)` |
| `public/style.css` | All styles; dark theme driven by CSS custom properties in `:root` |
| `netlify.toml` | `publish = "public"` |
| `.github/workflows/ci.yml` | Check job (file presence + `node --check`), then Netlify deploy (preview on PRs, prod on `main`) |

## Data model
Everything is stored under the localStorage key `presenter-helper:v1`:
```js
{ presentations: [{ id, title, targetMinutes, fontSize, updatedAt, slides: [{ id, notes }] }] }
```
`normalize()` in `app.js` fills defaults and clamps values. Any new field needs a default there so older saved data still loads.

## Conventions
- Plain JavaScript in an IIFE; no dependencies, bundler or framework. Don't add any without being asked.
- Each view renders with `innerHTML` and handles events through `setHandlers({ click, input, change, paste })` on `#app`, dispatching on `data-act` attributes.
- **XSS:** run user text through `esc()` before it goes into HTML strings, or assign it via `textContent` / `.value`.
- Present mode registers document-level listeners and an interval. Tear them down in the `cleanup` closure, which `route()` calls when you leave the view.
- Keyboard shortcuts are listed in three places: the `onKey` switch, the `.keys` hint in the present markup, and the README table. Keep all three in sync.
- Use `el.hidden` to show or hide elements, and keep the layout usable at a width of about 400px.

## Verifying changes
```sh
for f in public/*.js; do node --check "$f"; done   # what CI runs
npx serve public                                   # then exercise it in a browser
```
There's no automated UI test suite yet. If your change touches behavior, say plainly what you did and didn't verify in a browser.

## Planned work
- **Supabase auth + cloud sync.** Implement it inside `store.js`: keep `localStorage` as an offline fallback and use the Supabase JS client from a CDN. Only the anon key may live in the frontend, and row-level security must restrict each row to its owner.

## Don'ts
- Don't commit secrets: Netlify tokens or Supabase service-role keys.
- Don't change the storage key or the shape of saved data without a migration in `normalize()` / `Store.load()`.
- Don't push directly to `main`. Open a PR so CI runs.
