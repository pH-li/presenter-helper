// Shared view helpers.

/** Replace all delegated handlers on the shared root, so views never stack listeners. */
export function bindRoot(root, { click, input, change, paste, submit, touchstart, touchend, keydown, mousedown } = {}) {
  root.onkeydown = keydown || null;
  root.onmousedown = mousedown || null;
  root.onclick = click || null;
  root.oninput = input || null;
  root.onchange = change || null;
  root.onpaste = paste || null;
  root.onsubmit = submit || null;
  root.ontouchstart = touchstart || null;
  root.ontouchend = touchend || null;
}

/**
 * Horizontal swipe detector for touch screens. Returns { touchstart, touchend }
 * handlers for bindRoot. Vertical drags (scrolling) and slow drags are ignored.
 * @param {(direction: 1 | -1) => void} onSwipe  1 = swiped left (next), -1 = swiped right (prev)
 * @param {string} [ignoreSelector] touches starting inside these elements are ignored
 */
export function swipeHandlers(onSwipe, ignoreSelector = 'button, a, input, textarea') {
  let start = null;
  return {
    touchstart(e) {
      start =
        e.touches.length === 1 && !e.target.closest(ignoreSelector)
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
          : null;
    },
    touchend(e) {
      if (!start) return;
      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      const quick = Date.now() - start.t < 700;
      start = null;
      if (quick && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
    },
  };
}

export const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Two-click confirmation for destructive buttons.
 * First click arms the button (returns false); a second click within `ms` returns true.
 */
export function armConfirm(btn, armedLabel, ms = 3000) {
  if (btn.dataset.confirm) return true;
  const original = btn.textContent;
  btn.dataset.confirm = '1';
  btn.textContent = armedLabel;
  btn.classList.add('danger', 'wide');
  setTimeout(() => {
    if (!btn.isConnected) return;
    delete btn.dataset.confirm;
    btn.textContent = original;
    btn.classList.remove('danger', 'wide');
  }, ms);
  return false;
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3000);
}

export function downloadFile(filename, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
