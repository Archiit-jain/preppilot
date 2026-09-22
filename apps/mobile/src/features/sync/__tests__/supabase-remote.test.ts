import type { SupabaseClient } from '@supabase/supabase-js';
import { toIso, type RemoteRow } from '../remote';
import { PAGE_SIZE, createSupabaseRemote } from '../supabase-remote';

interface Recorded {
  readonly table: string;
  readonly gte: readonly [string, string][];
  readonly orders: readonly string[];
  readonly ranges: readonly [number, number][];
  readonly upserts: readonly { rows: unknown; options: unknown }[];
}

/**
 * A stand-in for the PostgREST query builder.
 *
 * The real client cannot be exercised without a network and a signed-in
 * session, but what this module is responsible for is the shape of the request
 * it builds — which filter it adds, which conflict target it upserts on, and
 * how it walks a table larger than one response.
 *
 * `maxRows` behaves like the server's own cap: a range asking for more gets at
 * most that many rows back, and no error — which is exactly what made a single
 * unpaged request lose data without anyone noticing.
 */
function fakeClient(
  result: { data?: unknown[] | null; error?: { message: string }; maxRows?: number } = {},
) {
  const recorded: {
    table: string | null;
    gte: [string, string][];
    orders: string[];
    ranges: [number, number][];
    upserts: unknown[][];
  } = { table: null, gte: [], orders: [], ranges: [], upserts: [] };

  const all = result.data === undefined ? [] : result.data;
  const error = result.error ?? null;
  const cap = result.maxRows ?? Number.POSITIVE_INFINITY;

  const builder = {
    select: () => builder,
    gte: (column: string, value: string) => {
      recorded.gte.push([column, value]);
      return builder;
    },
    order: (column: string) => {
      recorded.orders.push(column);
      return builder;
    },
    range: (from: number, to: number) => {
      recorded.ranges.push([from, to]);
      if (error !== null) return Promise.resolve({ data: null, error });
      if (all === null) return Promise.resolve({ data: null, error: null });
      const wanted = to - from + 1;
      return Promise.resolve({ data: all.slice(from, from + Math.min(wanted, cap)), error: null });
    },
    upsert: (rows: unknown, options: unknown) => {
      recorded.upserts.push([rows, options]);
      return Promise.resolve({ error });
    },
  };

  const client = {
    from: (table: string) => {
      recorded.table = table;
      return builder;
    },
  } as unknown as SupabaseClient;

  const seen = (): Recorded => ({
    table: recorded.table ?? '',
    gte: recorded.gte,
    orders: recorded.orders,
    ranges: recorded.ranges,
    upserts: recorded.upserts.map(([rows, options]) => ({ rows, options })),
  });

  return { client, seen };
}

/** `count` rows with ids that sort in the order they are listed. */
const rowsOf = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `row-${String(i).padStart(5, '0')}` }));

describe('pulling', () => {
  it('asks only for what changed since the last sync', async () => {
    const { client, seen } = fakeClient({ data: [{ id: 'a' }] });
    const since = Date.UTC(2026, 7, 20, 9, 30);

    const rows = await createSupabaseRemote(client).pull('subjects', since);

    expect(rows).toEqual([{ id: 'a' }]);
    expect(seen().table).toBe('subjects');
    // Every page carries the filter, or the second page would pull the whole table.
    expect(seen().gte.length).toBeGreaterThan(0);
    for (const filter of seen().gte) expect(filter).toEqual(['updated_at', toIso(since)]);
  });

  it('takes everything on a device that has never synced', async () => {
    const { client, seen } = fakeClient({ data: [] });

    await createSupabaseRemote(client).pull('topics', null);

    expect(seen().gte).toEqual([]);
  });

  it('reports which table failed, without a row of its own', async () => {
    const { client } = fakeClient({ error: { message: 'permission denied' } });

    await expect(createSupabaseRemote(client).pull('topics', null)).rejects.toThrow(
      'pull topics: permission denied',
    );
  });

  it('treats a missing body as no rows rather than a crash', async () => {
    const { client } = fakeClient({ data: null });
    // PostgREST can answer with a null body; that is an empty result, not a fault.
    const remote = createSupabaseRemote(client);

    await expect(remote.pull('chapters', null)).resolves.toEqual([]);
  });

  /**
   * The bug this guards: a reinstalled phone got its courses, flashcards and
   * sessions back but not its topic ticks. Those small tables fit in one
   * response; a full exam syllabus does not, and the server quietly stopped at
   * its row cap instead of failing.
   */
  it('takes every row of a table larger than one response', async () => {
    const all = rowsOf(PAGE_SIZE * 2 + 500);
    const { client } = fakeClient({ data: all, maxRows: PAGE_SIZE });

    const rows = await createSupabaseRemote(client).pull('topics', null);

    expect(rows).toHaveLength(all.length);
    expect(rows).toEqual(all);
  });

  it('still takes everything when the server caps below the page size', async () => {
    // A project configured with a lower cap answers each request with fewer
    // rows than asked for. Stepping by the page size would skip the gap.
    const all = rowsOf(1_250);
    const { client } = fakeClient({ data: all, maxRows: 300 });

    const rows = await createSupabaseRemote(client).pull('topics', null);

    expect(rows.map((row) => row.id)).toEqual(all.map((row) => row.id));
  });

  it('orders by the primary key so pages neither overlap nor skip', async () => {
    const { client, seen } = fakeClient({ data: rowsOf(10) });

    await createSupabaseRemote(client).pull('topics', null);

    expect(new Set(seen().orders)).toEqual(new Set(['id']));
  });

  it('starts each page where the last one ended', async () => {
    const { client, seen } = fakeClient({ data: rowsOf(PAGE_SIZE + 10), maxRows: PAGE_SIZE });

    await createSupabaseRemote(client).pull('topics', null);

    expect(seen().ranges.map(([from]) => from)).toEqual([0, PAGE_SIZE, PAGE_SIZE + 10]);
  });
});

describe('pushing', () => {
  it('upserts on the primary key, so a row pushed twice never duplicates', async () => {
    const { client, seen } = fakeClient();
    const rows: RemoteRow[] = [
      {
        id: 'topic-1',
        user_id: 'user-1',
        updated_at: '2026-08-20T09:30:00.000Z',
        deleted_at: null,
      },
    ];

    await createSupabaseRemote(client).push('topics', rows);

    expect(seen().upserts).toEqual([{ rows, options: { onConflict: 'id' } }]);
  });

  it('makes no request when there is nothing to send', async () => {
    const { client, seen } = fakeClient();

    await createSupabaseRemote(client).push('topics', []);

    expect(seen().upserts).toEqual([]);
    expect(seen().table).toBe('');
  });

  it('reports which table failed', async () => {
    const { client } = fakeClient({ error: { message: 'row violates row-level security' } });

    await expect(
      createSupabaseRemote(client).push('study_sessions', [
        {
          id: 'session-1',
          user_id: 'user-1',
          updated_at: '2026-08-20T09:30:00.000Z',
          deleted_at: null,
        },
      ]),
    ).rejects.toThrow('push study_sessions: row violates row-level security');
  });
});
