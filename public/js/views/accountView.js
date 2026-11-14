import { esc } from '../utils.js';
import { href } from '../router.js';
import { bindRoot } from './ui.js';
import { syncLabel, syncTone } from './syncLabels.js';

export class AccountView {
  constructor(root) {
    this.root = root;
  }

  /** @param {{ onSendLink, onSignOut, onSyncNow, onReset }} h */
  bind(h) {
    bindRoot(this.root, {
      submit: (e) => {
        e.preventDefault();
        const input = e.target.querySelector('input[type=email]');
        if (input && input.value.trim()) h.onSendLink(input.value.trim());
      },
      click: (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'signout') h.onSignOut();
        else if (b.dataset.act === 'sync') h.onSyncNow();
        else if (b.dataset.act === 'reset') h.onReset();
      },
    });
  }

  /**
   * @param {{ enabled: boolean, ready: boolean, email: string|null, status: string,
   *           sentTo?: string, busy?: boolean, error?: string }} s
   */
  render(s) {
    document.title = 'Account · Presenter Helper';
    this.root.innerHTML = `
      <main class="page narrow">
        <header class="page-head">
          <a class="btn ghost" href="${href.home()}">← All presentations</a>
        </header>
        <section class="card account">${this.#body(s)}</section>
      </main>`;
    const input = this.root.querySelector('input[type=email]');
    if (input && !s.busy) input.focus();
  }

  #body(s) {
    if (!s.enabled) {
      return `
        <h1>Sync isn't set up</h1>
        <p class="muted">This copy of Presenter Helper has no cloud account configured, so your notes are saved in this browser only.</p>`;
    }
    if (!s.ready && !s.email) {
      return `<h1>Connecting…</h1><p class="muted">If this takes a while you may be offline. Your notes are still saved on this device.</p>`;
    }
    if (s.email) {
      return `
        <h1>Your account</h1>
        <p>Signed in as <strong>${esc(s.email)}</strong></p>
        <p class="sync-line"><span class="dot ${syncTone(s)}"></span>${esc(syncLabel(s))}</p>
        <p class="muted">Your presentations sync automatically to every device where you sign in. They also stay on this device, so you can present without internet.</p>
        ${s.error ? `<p class="error-text">${esc(s.error)}</p>` : ''}
        <div class="row">
          <button class="btn" data-act="sync" ${s.busy ? 'disabled' : ''}>Sync now</button>
          <button class="btn ghost danger-text" data-act="signout" ${s.busy ? 'disabled' : ''}>Sign out</button>
        </div>`;
    }
    if (s.sentTo) {
      return `
        <h1>Check your email</h1>
        <p>We sent a sign-in link to <strong>${esc(s.sentTo)}</strong>.</p>
        <p class="muted">Open it on this device and you'll be signed in automatically. It can take a minute to arrive, so check your spam folder too.</p>
        <button class="btn ghost" data-act="reset">Use a different email</button>`;
    }
    return `
      <h1>Sync across devices</h1>
      <p class="muted">Sign in with your email to back up your presentations and use them on your phone, laptop or any other device. No password needed.</p>
      <form class="signin" novalidate>
        <label class="field"><span>Email</span>
          <input type="email" name="email" autocomplete="email" inputmode="email" required placeholder="you@example.com" ${s.busy ? 'disabled' : ''}>
        </label>
        ${s.error ? `<p class="error-text">${esc(s.error)}</p>` : ''}
        <button class="btn primary" type="submit" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Sending…' : 'Email me a sign-in link'}</button>
      </form>
      <p class="muted small">Presentations already on this device are added to your account when you sign in.</p>`;
  }
}
