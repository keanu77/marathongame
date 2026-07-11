import {
  getEntry,
  getEntryRank,
  getRun,
  listLeaderboard,
  type EntryRow,
} from '../functions/_lib/repository';
import type { D1DatabaseLike, D1PreparedStatement, D1Result } from '../functions/_lib/types';

class CapturingStatement implements D1PreparedStatement {
  public readonly bindings: unknown[][] = [];

  public constructor(
    public readonly query: string,
    private readonly firstResult: unknown,
    private readonly allResults: readonly unknown[],
  ) {}

  public bind(...values: unknown[]): D1PreparedStatement {
    this.bindings.push(values);
    return this;
  }

  public async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (this.firstResult as T | null) ?? null;
  }

  public async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
    return { results: [...this.allResults] as T[], success: true };
  }

  public async run(): Promise<D1Result> {
    return { success: true };
  }
}

class CapturingDatabase implements D1DatabaseLike {
  public readonly statements: CapturingStatement[] = [];

  public constructor(
    private readonly firstResult: unknown = null,
    private readonly allResults: readonly unknown[] = [],
  ) {}

  public prepare(query: string): D1PreparedStatement {
    const statement = new CapturingStatement(query, this.firstResult, this.allResults);
    this.statements.push(statement);
    return statement;
  }

  public async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    return statements.map(() => ({ success: true }));
  }
}

function normalizedSql(query: string): string {
  return query.replace(/\s+/gu, ' ').trim();
}

describe('D1 leaderboard ranking queries', () => {
  it('prioritizes completed outcomes and gives identical results the same competition rank', async () => {
    const db = new CapturingDatabase({ rank: 3 });

    await expect(getEntryRank(db, 'run-3')).resolves.toBe(3);

    const statement = db.statements[0];
    expect(statement).toBeDefined();
    const query = normalizedSql(statement?.query ?? '');
    expect(query).toContain(
      'RANK() OVER ( ORDER BY outcome ASC, score DESC, distance_meters DESC ) AS rank',
    );
    expect(query).not.toContain('ROW_NUMBER()');
    expect(statement?.bindings).toEqual([['run-3']]);
  });

  it('lists completed outcomes before stopped outcomes with deterministic tie ordering', async () => {
    const rows: EntryRow[] = [
      {
        id: 'completed-1',
        name: '完賽跑者',
        score: 2_000,
        distance_meters: 42_195,
        outcome: 'completed',
        stage_id: 'race',
        created_at_ms: 1,
      },
    ];
    const db = new CapturingDatabase(null, rows);

    await expect(listLeaderboard(db, 10)).resolves.toEqual(rows);

    const statement = db.statements[0];
    expect(statement).toBeDefined();
    const query = normalizedSql(statement?.query ?? '');
    const outcomeOrder = query.indexOf('ORDER BY outcome ASC');
    const scoreOrder = query.indexOf('score DESC', outcomeOrder);
    const distanceOrder = query.indexOf('distance_meters DESC', scoreOrder);
    const createdOrder = query.indexOf('created_at_ms ASC', distanceOrder);
    const idOrder = query.indexOf('run_id ASC', createdOrder);
    expect(outcomeOrder).toBeGreaterThanOrEqual(0);
    expect(scoreOrder).toBeGreaterThan(outcomeOrder);
    expect(distanceOrder).toBeGreaterThan(scoreOrder);
    expect(createdOrder).toBeGreaterThan(distanceOrder);
    expect(idOrder).toBeGreaterThan(createdOrder);
    expect(statement?.bindings).toEqual([[10]]);
  });
});

describe('D1 idempotent finish reads', () => {
  it('loads the stored fingerprint and submission time with a run', async () => {
    const db = new CapturingDatabase(null);

    await getRun(db, 'run-1');

    const statement = db.statements[0];
    const query = normalizedSql(statement?.query ?? '');
    expect(query).toContain('submitted_at_ms, finish_fingerprint');
    expect(statement?.bindings).toEqual([['run-1']]);
  });

  it('loads one existing entry by run id for replay responses', async () => {
    const row: EntryRow = {
      id: 'run-1',
      name: '跑者',
      score: 1_000,
      distance_meters: 25_000,
      outcome: 'stopped',
      stage_id: 'build',
      created_at_ms: 123,
    };
    const db = new CapturingDatabase(row);

    await expect(getEntry(db, 'run-1')).resolves.toEqual(row);

    const statement = db.statements[0];
    expect(normalizedSql(statement?.query ?? '')).toContain(
      'FROM leaderboard_entries WHERE run_id = ?',
    );
    expect(statement?.bindings).toEqual([['run-1']]);
  });
});
