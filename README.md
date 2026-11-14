# presenter-helper
A presenter tool aid, which includes a timer and a place to have presenting notes.

Speaking notes sit on the top half of the screen and a big timer on the bottom half. Move between slides with the arrow keys (or a presentation clicker), and resize the text on the fly.

## Features
- **Present mode:** the current slide's notes on top (scrollable), the timer on the bottom, and a control bar in between
- **Target length (optional):** shows time remaining. The timer turns amber near the end and red when you go over
- **Adjustable text size**, remembered for each presentation
- **Editor:** one notes box per slide, which you can add, reorder and delete. If you paste text containing a line with only `---`, it is split into slides at each `---`
- **Autosave** in your browser, plus JSON export/import for backups
- **Keeps the screen awake** while the timer runs (in supporting browsers)
- **Works on phones:**
  - Swipe left or right to change slides.
  - In portrait, the present controls fit in one compact row.
  - In landscape, notes and timer sit side by side.
  - Buttons are at least 44px tall, so they're easy to tap.
  - The layout stays clear of notches and rounded corners.

### Presenting shortcuts
| Key | Action |
| --- | --- |
| → / PageDown | Next slide |
| ← / PageUp | Previous slide |
| ↑ / ↓ | Scroll notes |
| + / − | Bigger / smaller text |
| Space | Start / pause timer |
| R | Reset timer |
| F | Fullscreen |
| Esc | Exit |

Most presentation clickers send PageUp/PageDown, so they work out of the box. On touch screens, swipe left or right outside the control bar to change slides. (iPhone Safari doesn't allow web pages to go fullscreen, so the Fullscreen button is hidden there.)

## How saving works
Right now, data is stored in the browser's `localStorage`. Each browser on each device has its own copy, and clearing your browser data deletes it. To move notes between devices, use **Export backup** and **Import backup** on the home page.

Sign-in and cloud sync (via [Supabase](https://supabase.com)) are planned. All persistence goes through the store adapter in [`public/js/models/localStore.js`](public/js/models/localStore.js), so the backend swap means writing a new adapter with the same `load()` / `save()` interface.

### Environment variables
Copy [`.env.example`](.env.example) to `.env` and fill in your Supabase values. `.env` is git-ignored.

| Variable | Where to find it |
| --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` / public key |

Never use the `service_role` key in this project; it bypasses row-level security. For deploys, add the same variables as GitHub Actions repository secrets.

## Architecture
The app uses **Model–View–Controller** with native ES modules. There is still no build step and there are no dependencies.

```
public/                      # the deployed site
  index.html                 # page shell; loads js/main.js as a module
  style.css
  js/
    main.js                  # composition root: wires models, views, controllers, router
    router.js                # hash router (#/, #/edit/<id>, #/present/<id>) + href helpers
    utils.js                 # DOM-free helpers (esc, fmtDuration, uid…)
    models/                  # data + rules; no DOM access, unit-tested in Node
      presentation.js        #   normalize(), splitNotes(), font limits
      presentationsModel.js  #   the collection and every mutation; persists via a store
      localStore.js          #   storage adapter (localStorage today)
      timer.js               #   stopwatch + target status (ok / warn / over)
    views/                   # render HTML and turn DOM events into callbacks; no app logic
      homeView.js  editView.js  presentView.js  ui.js
    controllers/             # connect a view to the model for one route
      homeController.js  editController.js  presentController.js
    services/
      screen.js              # wake lock + fullscreen browser APIs
tests/                       # node:test unit tests for models and utils
scripts/check.js             # CI static checks
netlify.toml                 # publish ./public
```

How the pieces talk to each other:
- **Views** never touch the model. They call handler callbacks (`onNext`, `onNotes`…) that the controller passes to `view.bind()`.
- **Controllers** call model methods, then tell the view what to show.
- **Models** never touch the DOM, which is why they can be tested in Node.

## Run locally
There's nothing to install. ES modules need to be served over HTTP, so opening `index.html` straight from disk won't work:

```sh
npm start        # same as: npx serve public
```

## Checks and tests
```sh
npm run check    # required files, JS syntax, and that every relative import resolves
npm test         # unit tests (Node's built-in test runner)
```

## CI/CD
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request and on every push to `main`:

1. **Check:** runs `npm run check` and `npm test`.
2. **Deploy:** runs only if Check passes.
   - **Pull requests** get a Netlify deploy preview, and the URL is posted as a comment on the PR.
   - **Pushes to `main`** deploy to production.

### One-time Netlify setup
1. Create the site in Netlify: **Add new site → Deploy manually**, or use `npx netlify-cli sites:create`.
2. Copy the **Site ID** from **Site configuration → General → Site details**.
3. Create a personal access token under **User settings → Applications → Personal access tokens**.
4. In GitHub, add both as repository secrets under **Settings → Secrets and variables → Actions**:
   - `NETLIFY_SITE_ID`
   - `NETLIFY_AUTH_TOKEN`

Until those secrets exist, the deploy job skips with a notice instead of failing.

> Use **either** this GitHub Actions deploy **or** Netlify's own "Import from Git" auto-deploys, not both. Otherwise every change deploys twice.

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md). AI coding agents should also read [AGENTS.md](AGENTS.md).

## License
[MIT](LICENSE)
