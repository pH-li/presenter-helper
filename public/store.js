// Storage layer. Everything that reads or writes saved data goes through here,
// so swapping localStorage for a real backend (e.g. Supabase) later only
// means changing this file.
const Store = (() => {
  const KEY = 'presenter-helper:v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (data && Array.isArray(data.presentations)) return data;
    } catch (e) {
      console.warn('Could not read saved data', e);
    }
    return { presentations: [] };
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Could not save data', e);
      return false;
    }
  }

  return { load, save };
})();
