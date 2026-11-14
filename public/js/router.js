// Hash router: #/  ·  #/edit/<id>  ·  #/present/<id>

export const href = {
  home: () => '#/',
  account: () => '#/account',
  edit: (id) => `#/edit/${encodeURIComponent(id)}`,
  present: (id) => `#/present/${encodeURIComponent(id)}`,
};

export const navigate = (hash) => {
  location.hash = hash;
};

export class Router {
  /**
   * @param {Record<string, (id?: string) => (void | false | (() => void))>} routes
   *   Each handler mounts a view. Return `false` for "not found" (falls back),
   *   or a cleanup function to run when the route is left.
   * @param {() => (void | (() => void))} fallback
   */
  constructor(routes, fallback) {
    this.routes = routes;
    this.fallback = fallback;
    this.cleanup = null;
  }

  start() {
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
  }

  /** Current route name: '' (home), 'edit', 'present', 'account'… */
  get current() {
    return location.hash.replace(/^#\/?/, '').split('/')[0] || '';
  }

  resolve() {
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
    const [name = '', rawId] = location.hash.replace(/^#\/?/, '').split('/');
    const handler = this.routes[name];
    let result = handler ? handler(rawId && decodeURIComponent(rawId)) : false;
    if (result === false) result = this.fallback();
    if (typeof result === 'function') this.cleanup = result;
    window.scrollTo(0, 0);
  }
}
