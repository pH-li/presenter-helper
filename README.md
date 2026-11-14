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

Most presentation clickers send PageUp/PageDown, so they work out of the box.

## How saving works
Right now, data is stored in the browser's `localStorage`. Each browser on each device has its own copy, and clearing your browser data deletes it. To move notes between devices, use **Export backup** and **Import backup** on the home page.

Sign-in and cloud sync (via [Supabase](https://supabase.com)) are planned. All persistence goes through [`public/store.js`](public/store.js), so that is the only file the backend swap should need to touch.

## Project structure
```
public/            # the deployed site (no build step)
  index.html       # page shell
  app.js           # routing, home, editor and present views
  store.js         # persistence layer (localStorage today)
  style.css        # all styles
netlify.toml       # Netlify config: publish ./public
.github/workflows/ # CI checks + Netlify deploys
```

## Run locally
There's no build step and nothing to install. Serve the `public` folder with any static server:

```sh
npx serve public
```

Then open the URL it prints. Opening `index.html` directly from disk also mostly works, but a server matches production more closely.

## CI/CD
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request and on every push to `main`:

1. **Check:** verifies the required files exist and syntax-checks every JavaScript file.
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
