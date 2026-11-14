// Email magic-link sign-in via Supabase Auth.
import { getSupabase } from './supabaseClient.js';

export class AuthService {
  constructor() {
    this.user = null;
    this.listeners = new Set();
    this.ready = false;
  }

  /** @param {(user: object|null) => void} fn  called whenever the signed-in user changes */
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  #set(user) {
    const changed = (user && user.id) !== (this.user && this.user.id);
    this.user = user;
    if (changed) for (const fn of this.listeners) fn(user);
  }

  /** Restore the session (and finish a magic-link sign-in if the URL has ?code=). */
  async init() {
    const params = new URLSearchParams(location.search);
    const linkError = params.get('error_description');
    const client = await getSupabase();
    const { data } = await client.auth.getSession();
    client.auth.onAuthStateChange((_event, session) => this.#set(session ? session.user : null));
    this.#set(data.session ? data.session.user : null);
    this.ready = true;
    if (params.has('code') || params.has('error')) {
      history.replaceState(null, '', location.pathname + location.hash); // tidy the URL
    }
    return { linkError };
  }

  async sendMagicLink(email) {
    const client = await getSupabase();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw error;
  }

  async signOut() {
    const client = await getSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    this.#set(null);
  }
}
