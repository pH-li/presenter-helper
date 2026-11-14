// Lazily loads supabase-js from a CDN, only when cloud sync is configured.
// Offline or blocked CDN → the promise rejects, and the app stays local-only.
import { config } from '../config.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let clientPromise = null;

export function getSupabase() {
  if (!config.cloudEnabled) return Promise.reject(new Error('Cloud sync is not configured'));
  clientPromise ||= import(SUPABASE_JS).then(({ createClient }) =>
    createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        flowType: 'pkce', // magic link returns ?code=… (the hash is used by our router)
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  );
  clientPromise.catch(() => (clientPromise = null)); // allow a retry later
  return clientPromise;
}
