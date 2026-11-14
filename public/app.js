(() => {
  'use strict';

  const app = document.getElementById('app');
  const FONT_MIN = 16;
  const FONT_MAX = 120;
  const FONT_STEP = 4;

  // ---------- helpers ----------
  const uid = () =>
    crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  function normalize(p, keepId) {
    const slides = Array.isArray(p && p.slides) && p.slides.length ? p.slides : [{ notes: '' }];
    return {
      id: keepId && p.id ? String(p.id) : uid(),
      title: String((p && p.title) || 'Untitled talk'),
      targetMinutes: Math.max(0, Number(p && p.targetMinutes) || 0),
      fontSize: clamp(Number(p && p.fontSize) || 36, FONT_MIN, FONT_MAX),
      slides: slides.map((s) => ({ id: keepId && s && s.id ? String(s.id) : uid(), notes: String((s && s.notes) || '') })),
      updatedAt: Number(p && p.updatedAt) || Date.now(),
    };
  }

  let data = Store.load();
  data.presentations = data.presentations.map((p) => normalize(p, true));

  const find = (id) => data.presentations.find((p) => p.id === id);

  function persist(p) {
    if (p) p.updatedAt = Date.now();
    if (!Store.save(data)) toast('Could not save — browser storage is full or blocked.');
  }

  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3000);
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function setHandlers(h) {
    app.onclick = h.click || null;
    app.oninput = h.input || null;
    app.onchange = h.change || null;
    app.onpaste = h.paste || null;
  }

  // ---------- routing ----------
  let cleanup = null;

  function route() {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    const [view, id] = location.hash.replace(/^#\/?/, '').split('/');
    const p = id && find(decodeURIComponent(id));
    window.scrollTo(0, 0);
    if (view === 'edit' && p) renderEdit(p);
    else if (view === 'present' && p) renderPresent(p);
    else renderHome();
  }
  window.addEventListener('hashchange', route);

  // ---------- home ----------
  function renderHome() {
    document.title = 'Presenter Helper';
    const list = [...data.presentations].sort((a, b) => b.updatedAt - a.updatedAt);
    app.innerHTML = `
      <main class="page">
        <header class="page-head">
          <h1>Presenter Helper</h1>
          <button class="btn primary" data-act="new">+ New presentation</button>
        </header>
        ${
          list.length
            ? `<ul class="deck-list">${list
                .map(
                  (p) => `
              <li class="deck">
                <div class="deck-info">
                  <h2>${esc(p.title || 'Untitled talk')}</h2>
                  <p class="muted">${p.slides.length} slide${p.slides.length === 1 ? '' : 's'}${
                    p.targetMinutes ? ` · ${p.targetMinutes} min` : ''
                  } · edited ${fmtDate(p.updatedAt)}</p>
                </div>
                <div class="row">
                  <a class="btn primary" href="#/present/${encodeURIComponent(p.id)}">Present</a>
                  <a class="btn" href="#/edit/${encodeURIComponent(p.id)}">Edit</a>
                  <button class="btn ghost danger-text" data-act="delete" data-id="${esc(p.id)}">Delete</button>
                </div>
              </li>`
                )
                .join('')}</ul>`
            : `<div class="empty">
                <p>No presentations yet.</p>
                <p class="muted">Create one, write your speaking notes slide by slide, then hit Present.</p>
              </div>`
        }
        <footer class="page-foot">
          <p class="muted">Your notes are saved in this browser only. Export a backup to move them to another device.</p>
          <div class="row">
            <button class="btn small" data-act="export">Export backup</button>
            <label class="btn small">Import backup<input type="file" accept="application/json,.json" hidden data-act="import"></label>
          </div>
        </footer>
      </main>`;

    setHandlers({
      click(e) {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'new') {
          const p = normalize({});
          data.presentations.push(p);
          persist(p);
          location.hash = '#/edit/' + encodeURIComponent(p.id);
        } else if (act === 'delete') {
          if (b.dataset.confirm) {
            data.presentations = data.presentations.filter((x) => x.id !== b.dataset.id);
            persist();
            renderHome();
          } else {
            b.dataset.confirm = '1';
            b.textContent = 'Click again to delete';
            b.classList.add('danger');
            setTimeout(() => {
              if (!b.isConnected) return;
              delete b.dataset.confirm;
              b.textContent = 'Delete';
              b.classList.remove('danger');
            }, 3000);
          }
        } else if (act === 'export') {
          exportData();
        }
      },
      change(e) {
        if (e.target.dataset.act === 'import' && e.target.files[0]) importData(e.target.files[0]);
      },
    });
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `presenter-helper-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importData(file) {
    try {
      const json = JSON.parse(await file.text());
      const arr = Array.isArray(json) ? json : json.presentations;
      if (!Array.isArray(arr)) throw new Error('No presentations found');
      const imported = arr.map((p) => normalize(p, false));
      data.presentations.push(...imported);
      persist();
      renderHome();
      toast(`Imported ${imported.length} presentation${imported.length === 1 ? '' : 's'}.`);
    } catch (e) {
      toast("That file doesn't look like a Presenter Helper backup.");
    }
  }

  // ---------- editor ----------
  function renderEdit(p) {
    document.title = `Edit · ${p.title || 'Untitled talk'}`;
    app.innerHTML = `
      <main class="page">
        <header class="page-head">
          <a class="btn ghost" href="#/">← All presentations</a>
          <a class="btn primary" href="#/present/${encodeURIComponent(p.id)}">Present ▶</a>
        </header>
        <div class="fields">
          <label class="field grow"><span>Title</span>
            <input type="text" data-field="title" value="${esc(p.title)}" placeholder="Untitled talk">
          </label>
          <label class="field"><span>Target length (minutes)</span>
            <input type="number" min="0" max="600" step="1" inputmode="numeric" data-field="targetMinutes"
              value="${p.targetMinutes || ''}" placeholder="None">
          </label>
        </div>
        <p class="muted hint">Tip: to fill several slides at once, paste notes separated by a line containing only <code>---</code>.</p>
        <ol class="slides" id="slides"></ol>
        <button class="btn add" data-act="add">+ Add slide</button>
      </main>`;

    const ol = app.querySelector('#slides');

    const autosize = (t) => {
      t.style.height = 'auto';
      t.style.height = t.scrollHeight + 2 + 'px';
    };

    function renderSlides(focusIndex) {
      const n = p.slides.length;
      ol.innerHTML = p.slides
        .map(
          (s, i) => `
          <li class="slide" data-i="${i}">
            <div class="slide-head">
              <span class="slide-num">Slide ${i + 1}</span>
              <div class="row tight">
                <button class="icon-btn" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move slide up" title="Move up">↑</button>
                <button class="icon-btn" data-act="down" ${i === n - 1 ? 'disabled' : ''} aria-label="Move slide down" title="Move down">↓</button>
                <button class="icon-btn" data-act="remove" ${n === 1 ? 'disabled' : ''} aria-label="Delete slide" title="Delete slide">✕</button>
              </div>
            </div>
            <textarea rows="4" placeholder="What do you want to say on this slide?" aria-label="Notes for slide ${i + 1}"></textarea>
          </li>`
        )
        .join('');
      ol.querySelectorAll('textarea').forEach((t, i) => {
        t.value = p.slides[i].notes;
        autosize(t);
      });
      if (focusIndex != null) {
        const t = ol.querySelectorAll('textarea')[focusIndex];
        if (t) {
          t.focus();
          t.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    }
    renderSlides();

    const slideIndex = (el) => {
      const li = el.closest('.slide');
      return li ? Number(li.dataset.i) : -1;
    };

    setHandlers({
      click(e) {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        const i = slideIndex(b);
        if (act === 'add') {
          p.slides.push({ id: uid(), notes: '' });
          persist(p);
          renderSlides(p.slides.length - 1);
        } else if (act === 'up' && i > 0) {
          [p.slides[i - 1], p.slides[i]] = [p.slides[i], p.slides[i - 1]];
          persist(p);
          renderSlides();
        } else if (act === 'down' && i < p.slides.length - 1) {
          [p.slides[i + 1], p.slides[i]] = [p.slides[i], p.slides[i + 1]];
          persist(p);
          renderSlides();
        } else if (act === 'remove' && p.slides.length > 1) {
          if (p.slides[i].notes.trim() && !b.dataset.confirm) {
            b.dataset.confirm = '1';
            b.textContent = 'Delete?';
            b.classList.add('danger', 'wide');
            setTimeout(() => {
              if (!b.isConnected) return;
              delete b.dataset.confirm;
              b.textContent = '✕';
              b.classList.remove('danger', 'wide');
            }, 3000);
            return;
          }
          p.slides.splice(i, 1);
          persist(p);
          renderSlides();
        }
      },
      input(e) {
        const t = e.target;
        if (t.dataset.field === 'title') {
          p.title = t.value;
          document.title = `Edit · ${p.title || 'Untitled talk'}`;
        } else if (t.dataset.field === 'targetMinutes') {
          p.targetMinutes = Math.max(0, parseFloat(t.value) || 0);
        } else if (t.tagName === 'TEXTAREA') {
          const i = slideIndex(t);
          if (i < 0) return;
          p.slides[i].notes = t.value;
          autosize(t);
        } else return;
        persist(p);
      },
      paste(e) {
        const t = e.target;
        if (t.tagName !== 'TEXTAREA') return;
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const sep = /^[ \t]*---[ \t]*$/m;
        if (!sep.test(text)) return;
        e.preventDefault();
        const parts = text
          .replace(/\r\n?/g, '\n')
          .split(/^[ \t]*---[ \t]*$/m)
          .map((s) => s.replace(/^\n+|\n+$/g, ''));
        const i = slideIndex(t);
        t.setRangeText(parts[0], t.selectionStart, t.selectionEnd, 'end');
        p.slides[i].notes = t.value;
        p.slides.splice(i + 1, 0, ...parts.slice(1).map((notes) => ({ id: uid(), notes })));
        persist(p);
        renderSlides(i + parts.length - 1);
        toast(`Split into ${parts.length} slides.`);
      },
    });
  }

  // ---------- present ----------
  function renderPresent(p) {
    document.title = `Presenting · ${p.title || 'Untitled talk'}`;
    let idx = 0;
    let elapsed = 0; // ms accumulated while paused
    let startedAt = null; // timestamp when running, else null
    let wakeLock = null;

    app.innerHTML = `
      <div class="present">
        <section class="notes" id="notes" aria-live="polite">
          <div class="notes-text" id="notesText"></div>
        </section>
        <nav class="bar" aria-label="Presenter controls">
          <div class="row tight">
            <button class="btn" data-act="prev" aria-label="Previous slide" title="Previous slide (←)">←</button>
            <span class="slide-count" id="count"></span>
            <button class="btn" data-act="next" aria-label="Next slide" title="Next slide (→)">→</button>
          </div>
          <div class="row tight">
            <button class="btn" data-act="smaller" aria-label="Smaller text" title="Smaller text (−)">A−</button>
            <span class="muted font-label" id="fontLabel"></span>
            <button class="btn" data-act="bigger" aria-label="Bigger text" title="Bigger text (+)">A+</button>
          </div>
          <div class="row tight">
            <button class="btn ghost" data-act="fullscreen" title="Fullscreen (F)">Fullscreen</button>
            <a class="btn ghost" href="#/edit/${encodeURIComponent(p.id)}" title="Exit (Esc)">Exit</a>
          </div>
        </nav>
        <section class="timer" id="timer">
          <div class="time" id="time">0:00</div>
          <div class="timer-sub" id="timerSub"></div>
          <div class="row">
            <button class="btn primary big" data-act="toggle" id="toggle">Start</button>
            <button class="btn big" data-act="reset">Reset</button>
          </div>
          <p class="keys muted">← → slides · ↑ ↓ scroll · + − text size · Space start/pause · R reset · F fullscreen · Esc exit</p>
        </section>
      </div>`;

    const $ = (id) => document.getElementById(id);
    const notes = $('notes');
    const notesText = $('notesText');
    const timerEl = $('timer');

    function showSlide() {
      const s = p.slides[idx];
      const text = s.notes.trim() ? s.notes : 'No notes for this slide.';
      notesText.textContent = text;
      notesText.classList.toggle('empty-note', !s.notes.trim());
      $('count').textContent = `Slide ${idx + 1} / ${p.slides.length}`;
      notes.scrollTop = 0;
    }

    function go(delta) {
      const next = clamp(idx + delta, 0, p.slides.length - 1);
      if (next !== idx) {
        idx = next;
        showSlide();
      }
    }

    function applyFont() {
      notesText.style.fontSize = p.fontSize + 'px';
      $('fontLabel').textContent = p.fontSize + 'px';
    }

    function font(delta) {
      const next = clamp(p.fontSize + delta, FONT_MIN, FONT_MAX);
      if (next === p.fontSize) return;
      p.fontSize = next;
      applyFont();
      Store.save(data); // save the preference without bumping "edited" date
    }

    function fmt(ms, roundUp) {
      const total = roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const ss = String(s).padStart(2, '0');
      return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
    }

    function tick() {
      const ms = elapsed + (startedAt ? Date.now() - startedAt : 0);
      $('time').textContent = fmt(ms);
      let state = '';
      if (p.targetMinutes) {
        const target = p.targetMinutes * 60000;
        const remain = target - ms;
        if (remain >= 0) {
          $('timerSub').textContent = `${fmt(remain, true)} left of ${p.targetMinutes} min`;
          if (remain <= Math.max(60000, target * 0.1)) state = 'warn';
        } else {
          $('timerSub').textContent = `${fmt(-remain)} over ${p.targetMinutes} min`;
          state = 'over';
        }
      } else {
        $('timerSub').textContent = startedAt || elapsed ? 'Elapsed' : 'Press Start or Space when you begin';
      }
      timerEl.classList.toggle('warn', state === 'warn');
      timerEl.classList.toggle('over', state === 'over');
      timerEl.classList.toggle('paused', !startedAt && elapsed > 0);
    }

    async function keepAwake(on) {
      try {
        if (on && 'wakeLock' in navigator && !wakeLock) {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLock.addEventListener('release', () => (wakeLock = null));
        } else if (!on && wakeLock) {
          await wakeLock.release();
          wakeLock = null;
        }
      } catch (e) {
        /* not supported or denied — fine */
      }
    }

    function toggle() {
      if (startedAt) {
        elapsed += Date.now() - startedAt;
        startedAt = null;
        keepAwake(false);
      } else {
        startedAt = Date.now();
        keepAwake(true);
      }
      $('toggle').textContent = startedAt ? 'Pause' : elapsed ? 'Resume' : 'Start';
      tick();
    }

    function reset() {
      elapsed = 0;
      startedAt = null;
      keepAwake(false);
      $('toggle').textContent = 'Start';
      tick();
    }

    function fullscreen() {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    }

    function onKey(e) {
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          go(1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
          go(-1);
          break;
        case 'ArrowDown':
          notes.scrollBy({ top: notes.clientHeight * 0.3, behavior: 'smooth' });
          break;
        case 'ArrowUp':
          notes.scrollBy({ top: -notes.clientHeight * 0.3, behavior: 'smooth' });
          break;
        case '+':
        case '=':
          font(FONT_STEP);
          break;
        case '-':
        case '_':
          font(-FONT_STEP);
          break;
        case ' ':
          toggle();
          break;
        case 'r':
        case 'R':
          reset();
          break;
        case 'f':
        case 'F':
          fullscreen();
          break;
        case 'Escape':
          if (document.fullscreenElement) return;
          location.hash = '#/edit/' + encodeURIComponent(p.id);
          break;
        default:
          return;
      }
      e.preventDefault();
    }

    function onVisibility() {
      if (document.visibilityState === 'visible' && startedAt) keepAwake(true);
    }

    setHandlers({
      click(e) {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        b.blur(); // so Space/Enter don't re-trigger the last clicked button
        const act = b.dataset.act;
        if (act === 'prev') go(-1);
        else if (act === 'next') go(1);
        else if (act === 'smaller') font(-FONT_STEP);
        else if (act === 'bigger') font(FONT_STEP);
        else if (act === 'toggle') toggle();
        else if (act === 'reset') reset();
        else if (act === 'fullscreen') fullscreen();
      },
    });

    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = setInterval(tick, 200);

    applyFont();
    showSlide();
    tick();

    cleanup = () => {
      clearInterval(interval);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      keepAwake(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }

  route();
})();
