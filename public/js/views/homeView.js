import { esc, fmtDate, plural } from '../utils.js';
import { href } from '../router.js';
import { bindRoot, armConfirm } from './ui.js';
import { syncLabel, syncTone } from './syncLabels.js';

export class HomeView {
  constructor(root) {
    this.root = root;
  }

  /** @param {{ onCreate, onDelete, onExport, onImport, onSignOut }} h */
  bind(h) {
    bindRoot(this.root, {
      click: (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        switch (b.dataset.act) {
          case 'new':
            h.onCreate();
            break;
          case 'signout':
            b.disabled = true;
            b.textContent = 'Signing out…';
            h.onSignOut();
            break;
          case 'delete':
            if (armConfirm(b, 'Click again to delete')) h.onDelete(b.dataset.id);
            break;
          case 'export':
            h.onExport();
            break;
        }
      },
      change: (e) => {
        if (e.target.dataset.act === 'import' && e.target.files[0]) h.onImport(e.target.files[0]);
      },
    });
  }

  /** @param {{ enabled: boolean, ready: boolean, email: string|null, status: string }} account */
  render(presentations, account) {
    document.title = 'Presenter Helper';
    this.root.innerHTML = `
      <main class="page">
        <header class="page-head">
          <h1>Presenter Helper</h1>
          <div class="row">
            <a class="sync-chip" id="syncChip" href="${href.account()}" ${account.enabled ? '' : 'hidden'}></a>
            <button class="btn primary" data-act="new">+ New presentation</button>
          </div>
        </header>
        ${presentations.length ? this.#list(presentations) : this.#empty()}
        <footer class="page-foot">
          <p class="muted">${
            account.email
              ? `Synced to <strong>${esc(account.email)}</strong> and saved on this device, so you can present offline.`
              : account.enabled
                ? `Saved in this browser only. <a href="${href.account()}">Sign in</a> to back up and sync across devices.`
                : 'Your notes are saved in this browser only. Export a backup to move them to another device.'
          }</p>
          <div class="row">
            <button class="btn small" data-act="export">Export backup</button>
            <label class="btn small">Import backup<input type="file" accept="application/json,.json" hidden data-act="import"></label>
            ${account.email ? '<button class="btn small ghost danger-text" data-act="signout">Sign out</button>' : ''}
          </div>
          <nav class="legal-links" aria-label="Legal">
            <a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="mailto:lyrwrites@gmail.com">Contact</a>
          </nav>
        </footer>
      </main>`;
  }

  setAccount(account) {
    const chip = this.root.querySelector('#syncChip');
    if (!chip) return;
    chip.hidden = !account.enabled;
    chip.innerHTML = `<span class="dot ${syncTone(account)}"></span>${esc(syncLabel(account) || '')}${
      account.email ? '<span class="chip-caret" aria-hidden="true">›</span>' : ''
    }`;
    chip.title = account.email ? `Signed in as ${account.email}. Account and sign out` : 'Sign in to sync across devices';
    chip.setAttribute('aria-label', account.email ? `Account: ${syncLabel(account)}. Signed in as ${account.email}` : 'Sign in to sync');
  }

  #list(presentations) {
    return `<ul class="deck-list">${presentations
      .map(
        (p) => `
        <li class="deck">
          <div class="deck-info">
            <h2>${esc(p.title)}</h2>
            <p class="muted">${plural(p.slides.length, 'slide')}${p.targetMinutes ? ` · ${p.targetMinutes} min` : ''} · edited ${fmtDate(p.updatedAt)}</p>
          </div>
          <div class="row">
            <a class="btn primary" href="${href.present(p.id)}">Present</a>
            <a class="btn" href="${href.edit(p.id)}">Edit</a>
            <button class="btn ghost danger-text" data-act="delete" data-id="${esc(p.id)}">Delete</button>
          </div>
        </li>`
      )
      .join('')}</ul>`;
  }

  #empty() {
    return `
      <div class="empty">
        <p>No presentations yet.</p>
        <p class="muted">Create one, write your speaking notes slide by slide, then hit Present.</p>
      </div>`;
  }
}
