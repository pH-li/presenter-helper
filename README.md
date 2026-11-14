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
The app works **offline first**: every change is saved in the browser right away (`localStorage`), so presenting never depends on the internet.

**Signed out:** notes live only in that browser. Use **Export backup** / **Import backup** on the home page to move them between devices.

**Signed in** (email magic link, via [Supabase](https://supabase.com)):
- Presentations sync to your account and to every device where you're signed in.
- Changes upload about a second after you make them.
- The app checks for changes from other devices when you sign in, when you come back online, and when you return to the tab.
- If the same presentation was edited in two places, the most recent edit wins.
- Deleting on one device deletes everywhere.
- The first time you sign in, anything you created while signed out is added to your account.
- Signing out removes your account's copy from that device. If some changes haven't uploaded yet, sign-out waits until they have.

Signed-in sync turns on automatically when the Supabase environment variables are set. Without them, the app runs in local-only mode.

### Environment variables
| Variable | Where to find it |
| --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` / publishable key |

Where to set them:
- **Locally:** copy [`.env.example`](.env.example) to `.env`. It's git-ignored. `npm start` reads it.
- **Netlify:** set them under **Project configuration → Environment variables**.

At build time, [`scripts/write-config.js`](scripts/write-config.js) turns them into `public/config.js`. That file is generated and git-ignored. The script also accepts `SUPABASE_DATABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`, the names Netlify's Supabase extension uses.

Never use the `service_role` / `sb_secret_…` key. It bypasses row-level security, and the build fails if you try.

### Supabase setup
1. **Create the table.** The schema and row-level security policies are in [`supabase/migrations/`](supabase/migrations/).
   - With the Supabase **GitHub integration** (Supabase → Project Settings → Integrations → GitHub, with "Deploy to production" on), it's applied automatically when this repo's `main` changes.
   - Otherwise, paste the migration file into **SQL Editor** and run it. It's safe to run more than once.
2. **Set the login URLs.** Under **Authentication → URL Configuration**:
   - Set **Site URL** to `https://presentassist.netlify.app`.
   - Add these **Redirect URLs**: `http://localhost:3000/**` and `https://*--presentassist.netlify.app/**` (deploy previews).
3. **Set up email for real users.** Supabase's built-in email sender only allows a few sign-in emails per hour. Before inviting other people, set up custom SMTP under **Authentication → Emails → SMTP Settings**, for example with Resend or Postmark.

## Architecture
The app uses **Model–View–Controller** with native ES modules. There is still no build step and there are no dependencies.

```
public/                      # the deployed site
  index.html                 # page shell; loads config.js, then js/main.js as a module
  config.js                  # GENERATED from env vars (git-ignored)
  style.css
  js/
    main.js                  # composition root: wires models, services, views, controllers, router
    config.js                # reads the generated config; cloudEnabled flag
    router.js                # hash router (#/, #/edit/<id>, #/present/<id>, #/account) + href helpers
    utils.js                 # DOM-free helpers (esc, fmtDuration, uid…)
    models/                  # data + rules; no DOM access, unit-tested in Node
      presentation.js        #   normalize(), splitNotes(), font limits
      presentationsModel.js  #   the collection and every mutation; persists via a store, notifies subscribers
      localStore.js          #   localStorage adapter (signed-out cache + one cache per user)
      supabaseRemote.js      #   the `presentations` table (fetch / upsert / delete)
      syncMerge.js           #   pure three-way merge + push diff
      timer.js               #   stopwatch + target status (ok / warn / over)
    views/                   # render HTML and turn DOM events into callbacks; no app logic
      homeView.js  editView.js  presentView.js  accountView.js  syncLabels.js  ui.js
    controllers/             # connect a view to the model for one route
      homeController.js  editController.js  presentController.js  accountController.js
    services/
      auth.js                # Supabase magic-link auth
      cloudSync.js           # offline-first sync engine (pull/merge/push, retries)
      supabaseClient.js      # lazy-loads supabase-js from a CDN only when configured
      accountState.js        # auth + sync bundle for views
      screen.js              # wake lock + fullscreen browser APIs
supabase/                    # migrations + config for the Supabase CLI / GitHub integration
tests/                       # node:test unit tests (models, sync engine, config script)
scripts/check.js             # CI static checks
scripts/write-config.js      # env vars → public/config.js (Netlify build command)
netlify.toml                 # build command + publish ./public
```

How the pieces talk to each other:
- **Views** never touch the model. They call handler callbacks (`onNext`, `onNotes`…) that the controller passes to `view.bind()`.
- **Controllers** call model methods, then tell the view what to show.
- **Models** never touch the DOM, which is why they can be tested in Node.

## Run locally
There's nothing to install. ES modules need to be served over HTTP, so opening `index.html` straight from disk won't work:

```sh
npm start        # writes public/config.js from .env, then serves ./public on http://localhost:3000
```

## Checks and tests
```sh
npm run check    # required files, JS syntax, and that every relative import resolves
npm test         # unit tests (Node's built-in test runner)
```

## CI/CD
- **CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `npm run check` and `npm test` on every pull request and every push to `main`. `main` is protected, so the **Check** job must pass, and a code owner must approve, before a PR can merge.
- **CD:** Netlify is connected to the repo with **Import from Git**. It deploys `main` to production at https://presentassist.netlify.app and builds a deploy preview for every PR. Its build command (`node scripts/write-config.js`) is set in [`netlify.toml`](netlify.toml).
- **Database:** Supabase's GitHub integration applies new files in `supabase/migrations/`.

The workflow also contains an optional GitHub Actions deploy job. It stays switched off as long as the `NETLIFY_SITE_ID` / `NETLIFY_AUTH_TOKEN` secrets are unset. Leave them unset while Netlify's Git integration is on, or every change will deploy twice.

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md). AI coding agents should also read [AGENTS.md](AGENTS.md).

## License
[MIT](LICENSE)
