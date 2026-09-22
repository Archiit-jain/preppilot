import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../../lib/supabase';
import { toIso, type Remote, type RemoteRow, type SyncedTable } from './remote';

/** Rows asked for per request. The server may send fewer; see `pull`. */
export const PAGE_SIZE = 1000;

/**
 * The Supabase implementation of the remote.
 *
 * Every request is made with the signed-in student's own token, so Row Level
 * Security is what actually scopes the data — this code never adds a `user_id`
 * filter of its own and could not widen access if it tried.
 */
export function createSupabaseRemote(client: SupabaseClient = getSupabase()): Remote {
  return {
    async pull(table, since) {
      const rows: RemoteRow[] = [];

      // A page at a time. PostgREST caps how many rows one response carries —
      // Supabase's default is 1000 — and a request over the cap is not an error:
      // it simply stops. Asking once took the first thousand rows of a table and
      // silently dropped the rest, so a full exam syllabus came back to a new
      // device with most of its topics, and their ticks, missing.
      for (let from = 0; ;) {
        let query = client.from(table).select('*');

        // Pulling only what changed keeps a routine sync small; the first sync
        // on a new device passes null and takes everything.
        if (since !== null) query = query.gte('updated_at', toIso(since));

        // Ordered by the primary key so consecutive pages neither overlap nor
        // skip: without an order the database is free to return rows in any
        // sequence, and a different one on each request.
        const { data, error } = await query.order('id').range(from, from + PAGE_SIZE - 1);
        if (error !== null) throw new Error(`pull ${table}: ${error.message}`);

        const page = (data ?? []) as RemoteRow[];
        if (page.length === 0) break;

        rows.push(...page);
        // Advanced by what actually arrived, not by what was asked for: a
        // project whose cap sits below PAGE_SIZE answers with fewer rows, and
        // stepping by PAGE_SIZE would jump straight over the difference.
        from += page.length;
      }

      return rows;
    },

    async push(table, rows) {
      if (rows.length === 0) return;

      // Upsert by primary key: a row created offline and pushed twice must
      // update rather than duplicate (PRD §22).
      const { error } = await client.from(table).upsert(rows as never[], { onConflict: 'id' });
      if (error !== null) throw new Error(`push ${table}: ${error.message}`);
    },
  };
}

export type { Remote, RemoteRow, SyncedTable };
