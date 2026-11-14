// Pure merge/diff logic for cloud sync. No DOM, no network, so it can be unit-tested.
//
// Terms:
//   local      presentations cached on this device
//   remote     presentations currently in the cloud
//   lastSynced { [id]: updatedAt } for every presentation as of the last successful
//              sync. It tells "deleted elsewhere" apart from "created here, never uploaded".

/**
 * Three-way merge of local and remote, last-write-wins per presentation (by updatedAt).
 * @returns {{ items: object[], toUpsert: object[], toDelete: string[] }}
 *   items:    the merged list to keep locally
 *   toUpsert: presentations the cloud needs (local is newer, or never uploaded)
 *   toDelete: ids to delete in the cloud (deleted on this device since the last sync)
 */
export function mergeRemote(local, remote, lastSynced = {}) {
  const L = new Map(local.map((p) => [p.id, p]));
  const R = new Map(remote.map((p) => [p.id, p]));
  const items = [];
  const toUpsert = [];
  const toDelete = [];

  for (const [id, r] of R) {
    const l = L.get(id);
    if (l) {
      if (l.updatedAt > r.updatedAt) {
        items.push(l);
        toUpsert.push(l);
      } else {
        items.push(r);
      }
    } else if (id in lastSynced && r.updatedAt <= lastSynced[id]) {
      toDelete.push(id); // deleted here while offline; remote hasn't changed since
    } else {
      items.push(r); // new from another device (or edited there after our delete)
    }
  }

  for (const [id, l] of L) {
    if (R.has(id)) continue;
    if (id in lastSynced && l.updatedAt <= lastSynced[id]) continue; // deleted on another device
    items.push(l); // created here, or edited here after another device deleted it
    toUpsert.push(l);
  }

  return { items, toUpsert, toDelete };
}

/**
 * What changed locally since the last sync.
 * @param {object[]} items current local presentations
 * @param {Map<string, string>} snapshot id → JSON of what the cloud has
 * @returns {{ upserts: object[], deletes: string[] }}
 */
export function diffForPush(items, snapshot) {
  const upserts = items.filter((p) => snapshot.get(p.id) !== JSON.stringify(p));
  const ids = new Set(items.map((p) => p.id));
  const deletes = [...snapshot.keys()].filter((id) => !ids.has(id));
  return { upserts, deletes };
}

/** Build a snapshot (id → JSON) from presentations. */
export const snapshotOf = (items) => new Map(items.map((p) => [p.id, JSON.stringify(p)]));

/** { id: updatedAt } for persisting between sessions. */
export const lastSyncedOf = (items) => Object.fromEntries(items.map((p) => [p.id, p.updatedAt]));
