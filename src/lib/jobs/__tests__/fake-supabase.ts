/**
 * A minimal, in-memory fake of the subset of the Supabase JS query-builder
 * API actually used by the Jobs Explorer server modules under test
 * (list.server.ts, match.server.ts, roadmap-add.server.ts, me.server.ts,
 * jobs.functions.ts). It is NOT a general Supabase mock — it only supports
 * the filter/order/range/terminal combinations that appear in this codebase,
 * kept honest by the fact every test exercises real production code paths
 * against it.
 *
 * Design notes:
 * - Tables are plain arrays of snake_case row objects, held by reference so
 *   inserts/updates/deletes made by the code under test are visible to
 *   subsequent queries and assertions within the same test — this is what
 *   lets the roadmap idempotency tests (Phase 5) actually prove idempotency.
 * - `.select("a, b(c)")` does not parse the column string; it returns full
 *   rows as stored. Tests set up nested join fields (e.g. `job_sources`,
 *   `skills`) directly on the fixture rows to match what real PostgREST
 *   would return for an embedded resource.
 * - The builder is thenable so `await query` and `Promise.all([query, ...])`
 *   both work without an explicit terminal call, mirroring supabase-js.
 */

export type Row = Record<string, unknown>;
export type FakeDb = Record<string, Row[]>;

interface Ctx {
  count?: "exact";
  head?: boolean;
  action: "select" | "insert" | "update" | "delete" | "upsert";
  payload?: Row | Row[];
  upsertOnConflict?: string[] | undefined;
}

/**
 * Columns that are genuinely INTEGER in the production Postgres schema.
 * Mirrors the exact production failure (`22P02 invalid input syntax for
 * type integer: "3.5"`) so a regression in the roadmap allocator that
 * starts generating fractional hours again fails the same way against this
 * fake as it would against real Supabase, instead of silently "succeeding"
 * against an in-memory store that doesn't enforce column types.
 */
const INTEGER_COLUMNS: Record<string, string[]> = {
  roadmap_tasks: ["estimated_hours"],
  roadmap_months: ["estimated_hours"],
};

function integerColumnViolation(table: string, row: Row): string | null {
  const cols = INTEGER_COLUMNS[table];
  if (!cols) return null;
  for (const col of cols) {
    const val = row[col];
    if (typeof val === "number" && !Number.isInteger(val)) {
      return `invalid input syntax for type integer: "${val}"`;
    }
  }
  return null;
}

function likeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

/** Splits a PostgREST `.or()` clause string on top-level commas only,
 * respecting commas nested inside `in.(...)` lists. */
function splitOrClauses(clause: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of clause) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) out.push(current);
  return out;
}

function matchesOrClause(row: Row, clause: string): boolean {
  const [col, op, ...rest] = clause.split(".");
  const arg = rest.join(".");
  if (op === "ilike")
    return typeof row[col!] === "string" && likeToRegExp(arg).test(row[col!] as string);
  if (op === "in") {
    const inner = arg.replace(/^\(/, "").replace(/\)$/, "");
    const ids = inner.length ? inner.split(",") : [];
    return ids.includes(String(row[col!]));
  }
  return false;
}

/** Shape of a Postgres/PostgREST error, as returned in `{ data: null, error }`
 * on a genuine constraint/type violation (e.g. inserting a fraction into an
 * INTEGER column) rather than thrown -- matching how supabase-js reports it. */
export interface FakeDbError {
  code: string;
  message: string;
}

class FakeQuery implements PromiseLike<{
  data: Row[] | Row | null;
  error: FakeDbError | null;
  count: number | null;
}> {
  private filters: ((row: Row) => boolean)[] = [];
  private orderCol: string | null = null;
  private orderAscending = true;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private limitN: number | null = null;
  private singleMode: "maybe" | "single" | null = null;
  private ctx: Ctx = { action: "select" };

  constructor(
    private db: FakeDb,
    private table: string,
  ) {}

  private rows(): Row[] {
    return this.db[this.table] ?? (this.db[this.table] = []);
  }

  select(_cols?: string, opts?: { count?: "exact"; head?: boolean }) {
    if (opts?.count) this.ctx.count = opts.count;
    if (opts?.head) this.ctx.head = true;
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }

  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }

  ilike(col: string, pattern: string) {
    const re = likeToRegExp(pattern);
    this.filters.push((r) => typeof r[col] === "string" && re.test(r[col] as string));
    return this;
  }

  in(col: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[col]));
    return this;
  }

  gte(col: string, val: number) {
    this.filters.push((r) => r[col] !== null && r[col] !== undefined && (r[col] as number) >= val);
    return this;
  }

  lte(col: string, val: number) {
    this.filters.push((r) => r[col] !== null && r[col] !== undefined && (r[col] as number) <= val);
    return this;
  }

  lt(col: string, val: number) {
    this.filters.push((r) => r[col] !== null && r[col] !== undefined && (r[col] as number) < val);
    return this;
  }

  /** Minimal support for the one shape this codebase uses:
   * `.not(col, "is", null)` — "column is not null". */
  not(col: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) {
      this.filters.push((r) => r[col] !== null && r[col] !== undefined);
    }
    return this;
  }

  or(clauseString: string) {
    const clauses = splitOrClauses(clauseString);
    this.filters.push((r) => clauses.some((c) => matchesOrClause(r, c)));
    return this;
  }

  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderCol = col;
    this.orderAscending = opts?.ascending ?? true;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this.execute();
  }

  single() {
    this.singleMode = "single";
    return this.execute();
  }

  insert(payload: Row | Row[]) {
    this.ctx = { ...this.ctx, action: "insert", payload };
    return this;
  }

  update(payload: Row) {
    this.ctx = { ...this.ctx, action: "update", payload };
    return this;
  }

  delete() {
    this.ctx = { ...this.ctx, action: "delete" };
    return this;
  }

  upsert(payload: Row | Row[], opts?: { onConflict?: string }) {
    this.ctx = {
      ...this.ctx,
      action: "upsert",
      payload,
      upsertOnConflict: opts?.onConflict?.split(","),
    };
    return this;
  }

  private applyFilters(rows: Row[]): Row[] {
    return rows.filter((r) => this.filters.every((f) => f(r)));
  }

  private async execute(): Promise<{
    data: Row[] | Row | null;
    error: FakeDbError | null;
    count: number | null;
  }> {
    const table = this.rows();

    if (this.ctx.action === "insert") {
      const payloadRows = Array.isArray(this.ctx.payload) ? this.ctx.payload : [this.ctx.payload!];
      for (const r of payloadRows) {
        const violation = integerColumnViolation(this.table, r);
        if (violation) {
          return {
            data: null,
            error: { code: "22P02", message: violation },
            count: null,
          };
        }
      }
      const items = payloadRows.map((r) => ({
        id: r["id"] ?? `generated-${table.length}-${Math.random()}`,
        // Real Postgres tables in this schema default `created_at` to
        // `now()` -- mirror that here so time-window queries (rate
        // limiting, "recent activity", etc.) behave the same against
        // the fake as they do against the real database.
        created_at: r["created_at"] ?? new Date().toISOString(),
        ...r,
      }));
      table.push(...items);
      if (this.singleMode) return { data: items[0] ?? null, error: null, count: items.length };
      return { data: items, error: null, count: items.length };
    }

    if (this.ctx.action === "upsert") {
      const items = Array.isArray(this.ctx.payload) ? this.ctx.payload : [this.ctx.payload!];
      const conflictCols = this.ctx.upsertOnConflict ?? ["id"];
      const upserted: Row[] = [];
      for (const item of items) {
        const existingIdx = table.findIndex((r) => conflictCols.every((c) => r[c] === item[c]));
        if (existingIdx >= 0) {
          table[existingIdx] = { ...table[existingIdx], ...item };
          upserted.push(table[existingIdx]!);
        } else {
          const created = {
            id: item["id"] ?? `generated-${table.length}-${Math.random()}`,
            ...item,
          };
          table.push(created);
          upserted.push(created);
        }
      }
      if (this.singleMode)
        return { data: upserted[0] ?? null, error: null, count: upserted.length };
      return { data: upserted, error: null, count: upserted.length };
    }

    if (this.ctx.action === "update") {
      const targets = this.applyFilters(table);
      for (const t of targets) Object.assign(t, this.ctx.payload);
      return { data: targets, error: null, count: targets.length };
    }

    if (this.ctx.action === "delete") {
      const targets = this.applyFilters(table);
      for (const t of targets) {
        const idx = table.indexOf(t);
        if (idx >= 0) table.splice(idx, 1);
      }
      return { data: targets, error: null, count: targets.length };
    }

    // select
    let result = this.applyFilters(table);
    const totalCount = result.length;

    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAscending;
      result = [...result].sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return asc ? cmp : -cmp;
      });
    }

    if (this.rangeFrom !== null && this.rangeTo !== null) {
      result = result.slice(this.rangeFrom, this.rangeTo + 1);
    } else if (this.limitN !== null) {
      result = result.slice(0, this.limitN);
    }

    if (this.singleMode) {
      const row = result[0] ?? null;
      return { data: this.ctx.head ? null : row, error: null, count: totalCount };
    }

    return { data: this.ctx.head ? null : result, error: null, count: totalCount };
  }

  then<
    TResult1 = { data: Row[] | Row | null; error: FakeDbError | null; count: number | null },
    TResult2 = never,
  >(
    onfulfilled?:
      | ((value: {
          data: Row[] | Row | null;
          error: FakeDbError | null;
          count: number | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export class FakeSupabase {
  constructor(public db: FakeDb = {}) {}

  from(table: string) {
    return new FakeQuery(this.db, table);
  }

  seed(table: string, rows: Row[]) {
    this.db[table] = [...rows];
    return this;
  }

  table(table: string): Row[] {
    return this.db[table] ?? (this.db[table] = []);
  }
}

export function createFakeSupabase(db: FakeDb = {}): FakeSupabase {
  return new FakeSupabase(db);
}

/**
 * Minimal in-memory fake of the Supabase Storage API surface used by
 * task-evidence.server.ts: `upload`, `remove`, `createSignedUrl`, and
 * `createSignedUrls`. Bolted onto a FakeSupabase instance as `.storage` so
 * server code that does `supabase.storage.from(bucket)...` works unchanged
 * against it. Bucket name is accepted but not enforced (tests only ever
 * use one bucket).
 */
export function attachFakeStorage(fake: FakeSupabase): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  (fake as unknown as { storage: unknown }).storage = {
    from: (_bucket: string) => ({
      upload: async (path: string, data: Buffer) => {
        if (files.has(path)) return { data: null, error: { message: "Object already exists" } };
        files.set(path, data);
        return { data: { path }, error: null };
      },
      remove: async (paths: string[]) => {
        for (const p of paths) files.delete(p);
        return { data: paths.map((p) => ({ name: p })), error: null };
      },
      createSignedUrl: async (path: string, _expiresIn: number) => {
        if (!files.has(path)) return { data: null, error: { message: "Object not found" } };
        return { data: { signedUrl: `https://fake.local/${path}` }, error: null };
      },
      createSignedUrls: async (paths: string[], _expiresIn: number) => ({
        data: paths.map((p) => ({
          path: p,
          signedUrl: files.has(p) ? `https://fake.local/${p}` : null,
          error: files.has(p) ? null : { message: "Object not found" },
        })),
        error: null,
      }),
    }),
  };
  return files;
}
