// Browser screen APIs used while presenting. All calls fail silently where unsupported.

export class ScreenWakeLock {
  constructor() {
    this.lock = null;
  }

  async acquire() {
    try {
      if ('wakeLock' in navigator && !this.lock) {
        this.lock = await navigator.wakeLock.request('screen');
        this.lock.addEventListener('release', () => (this.lock = null));
      }
    } catch {
      /* unsupported or denied */
    }
  }

  async release() {
    try {
      if (this.lock) await this.lock.release();
    } catch {
      /* already released */
    }
    this.lock = null;
  }
}

export const isFullscreen = () => Boolean(document.fullscreenElement);

export function toggleFullscreen() {
  if (isFullscreen()) exitFullscreen();
  else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
}

export function exitFullscreen() {
  if (isFullscreen()) document.exitFullscreen().catch(() => {});
}
