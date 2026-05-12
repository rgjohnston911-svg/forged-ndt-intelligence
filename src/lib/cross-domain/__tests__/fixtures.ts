// Lightweight in-memory Supabase mock — enough surface area to exercise
// the cross-domain library. Returns a thenable query-builder that mirrors
// the supabase-js fluent API used by the engine.

export interface MockTables {
  [table: string]: Record<string, unknown>[];
}

type MaybeSingleRes<T> = { data: T | null; error: { message: string } | null };
type ListRes<T> = { data: T[]; error: { message: string } | null };

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function matchOrExpr(row: Record<string, unknown>, expr: string): boolean {
  return expr.split(",").some((clause) => {
    const m = clause.match(/^([a-zA-Z0-9_]+)\.eq\.(.+)$/);
    if (!m) return false;
    const col = m[1];
    const val = m[2];
    return String(row[col]) === val;
  });
}

class Query {
  private table: string;
  private rows: Record<string, unknown>[];
  private filters: Array<(r: Record<string, unknown>) => boolean> = [];
  private orderBy: { col: string; asc: boolean } | null = null;
  private mode: "list" | "maybeSingle" = "list";
  private inserted: Record<string, unknown>[] = [];
  private isInsert = false;
  private isUpdate = false;
  private updatePayload: Record<string, unknown> | null = null;
  private store: MockTables;

  constructor(store: MockTables, table: string) {
    this.store = store;
    this.table = table;
    this.rows = store[table] ?? [];
  }

  select(_cols: string = "*") {
    return this;
  }

  insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
    this.isInsert = true;
    const arr = Array.isArray(payload) ? payload : [payload];
    this.inserted = arr.map((p) => deepClone(p));
    if (!this.store[this.table]) this.store[this.table] = [];
    for (const row of this.inserted) {
      this.store[this.table].push({
        id: (row.id as string) ?? `mock-${Math.random().toString(36).slice(2)}`,
        created_at: new Date().toISOString(),
        ...row,
      });
    }
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.isUpdate = true;
    this.updatePayload = deepClone(payload);
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

  in(col: string, vals: unknown[]) {
    const set = new Set(vals);
    this.filters.push((r) => set.has(r[col]));
    return this;
  }

  or(expr: string) {
    this.filters.push((r) => matchOrExpr(r, expr));
    return this;
  }

  gte(col: string, val: unknown) {
    this.filters.push((r) => {
      const v = r[col];
      if (v == null) return false;
      return (v as number | string) >= (val as number | string);
    });
    return this;
  }

  lt(col: string, val: unknown) {
    this.filters.push((r) => {
      const v = r[col];
      if (v == null) return false;
      return (v as number | string) < (val as number | string);
    });
    return this;
  }

  like(col: string, pattern: string) {
    // Translate Postgres LIKE pattern to regex: % → .*, _ → .
    const regex = new RegExp(
      "^" +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/%/g, ".*")
          .replace(/_/g, ".") +
        "$"
    );
    this.filters.push((r) => {
      const v = r[col];
      return typeof v === "string" && regex.test(v);
    });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, asc: opts?.ascending !== false };
    return this;
  }

  maybeSingle() {
    this.mode = "maybeSingle";
    return this;
  }

  private applyUpdate(): void {
    const target = this.store[this.table] ?? [];
    for (const row of target) {
      if (this.filters.every((f) => f(row))) {
        Object.assign(row, this.updatePayload ?? {});
      }
    }
  }

  private resolved<T = unknown>(): ListRes<T> | MaybeSingleRes<T> {
    if (this.isInsert) {
      return { data: [] as T[], error: null };
    }
    if (this.isUpdate) {
      this.applyUpdate();
      return { data: [] as T[], error: null };
    }
    let result = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      result = [...result].sort((a, b) => {
        const av = a[col] as string | number;
        const bv = b[col] as string | number;
        if (av === bv) return 0;
        const cmp = av > bv ? 1 : -1;
        return asc ? cmp : -cmp;
      });
    }
    const cloned = result.map((r) => deepClone(r)) as T[];
    if (this.mode === "maybeSingle") {
      return { data: cloned[0] ?? null, error: null };
    }
    return { data: cloned, error: null };
  }

  then<R1, R2 = never>(
    onFulfilled?: ((value: ListRes<unknown> | MaybeSingleRes<unknown>) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.resolved()).then(onFulfilled, onRejected);
  }
}

export interface MockSupabase {
  from(table: string): Query;
  __store: MockTables;
}

export function makeMockSupabase(seed: MockTables = {}): MockSupabase {
  const store: MockTables = {};
  for (const k of Object.keys(seed)) store[k] = deepClone(seed[k]);
  return {
    __store: store,
    from(table: string) {
      return new Query(store, table);
    },
  };
}
