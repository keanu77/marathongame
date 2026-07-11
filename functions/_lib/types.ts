export interface D1Result {
  success: boolean;
  results?: unknown[];
  meta?: {
    changes?: number;
  };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>;
  run(): Promise<D1Result>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

export interface Env {
  DB: D1DatabaseLike;
  /** Required Cloudflare Pages secret; never commit its value. */
  RATE_LIMIT_SECRET?: string;
  /** Cloudflare Pages supplies the branch for production and preview deployments. */
  CF_PAGES_BRANCH?: string;
  /** Branch allowed to write the production leaderboard; defaults to main. */
  LEADERBOARD_PRODUCTION_BRANCH?: string;
}

export interface PagesContext {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  waitUntil(promise: Promise<unknown>): void;
}

export type PagesHandler = (context: PagesContext) => Response | Promise<Response>;
