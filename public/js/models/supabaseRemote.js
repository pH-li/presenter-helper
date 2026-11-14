// Remote adapter for the `presentations` table (see supabase/migrations).
// Each row holds one presentation as JSON; row-level security limits rows to their owner.
import { normalize } from './presentation.js';

const TABLE = 'presentations';

export class SupabaseRemote {
  /** @param {import('@supabase/supabase-js').SupabaseClient} client */
  constructor(client, userId) {
    this.client = client;
    this.userId = userId;
  }

  async fetchAll() {
    const { data, error } = await this.client.from(TABLE).select('id, data');
    if (error) throw error;
    return data.map((row) => normalize({ ...row.data, id: row.id }, true));
  }

  async upsert(presentations) {
    if (!presentations.length) return;
    const rows = presentations.map((p) => ({
      user_id: this.userId,
      id: p.id,
      data: p,
      updated_at: new Date(p.updatedAt).toISOString(),
    }));
    const { error } = await this.client.from(TABLE).upsert(rows, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  async remove(ids) {
    if (!ids.length) return;
    const { error } = await this.client.from(TABLE).delete().eq('user_id', this.userId).in('id', ids);
    if (error) throw error;
  }
}
