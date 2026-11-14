// Shared view helpers.

/** Replace all delegated handlers on the shared root, so views never stack listeners. */
export function bindRoot(root, { click, input, change, paste, submit } = {}) {
  root.onclick = click || null;
  root.oninput = input || null;
  root.onchange = change || null;
  root.onpaste = paste || null;
  root.onsubmit = submit || null;
}

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
