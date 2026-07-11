import { NETWORK_LEADERBOARD_RULES_VERSION } from '../src/shared/networkLeaderboardRules';
import { onRequest as finishRun } from '../functions/api/runs/[id]/finish';
import type { EntryRow, RunRow } from '../functions/_lib/repository';
import { sha256Hex } from '../functions/_lib/security';
import type {
  D1DatabaseLike,
  D1PreparedStatement,
  D1Result,
  PagesContext,
} from '../functions/_lib/types';

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const RUN_TOKEN = 'A'.repeat(43);
const ORIGIN = 'https://marathongame.example';
const ISSUED_AT_MS = Date.UTC(2026, 6, 11, 1, 0, 0);

function normalizedSql(query: string): string {
  return query.replace(/\s+/gu, ' ').trim();
}

class StatefulStatement implements D1PreparedStatement {
  private bindings: unknown[] = [];

  public constructor(
    private readonly db: StatefulDatabase,
    public readonly query: string,
  ) {}

  public bind(...values: unknown[]): D1PreparedStatement {
    this.bindings = values;
    return this;
  }

  public async first<T = Record<string, unknown>>(): Promise<T | null> {
    const query = normalizedSql(this.query);
    if (query.includes('FROM leaderboard_runs WHERE id = ?')) {
      return (this.db.run?.id === this.bindings[0] ? { ...this.db.run } : null) as T | null;
    }
    if (query.includes('FROM leaderboard_entries WHERE run_id = ?')) {
      return (this.db.entry?.id === this.bindings[0] ? { ...this.db.entry } : null) as T | null;
    }
    if (query.startsWith('SELECT rank FROM')) {
      return (this.db.entry?.id === this.bindings[0] ? { rank: this.db.rank } : null) as T | null;
    }
    throw new Error(`Unexpected first() query: ${query}`);
  }

  public async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
    return { results: [], success: true };
  }

  public async run(): Promise<D1Result> {
    const query = normalizedSql(this.query);
    if (query.startsWith("UPDATE leaderboard_runs SET status = 'submitted'")) {
      const [submittedAtMs, finishFingerprint, id] = this.bindings;
      if (this.db.run?.id !== id || this.db.run.status !== 'issued') {
        return { success: true, meta: { changes: 0 } };
      }
      this.db.run = {
        ...this.db.run,
        status: 'submitted',
        submitted_at_ms: submittedAtMs as number,
        finish_fingerprint: finishFingerprint as string,
      };
      return { success: true, meta: { changes: 1 } };
    }
    if (query.startsWith('INSERT INTO leaderboard_entries')) {
      const [
        id,
        name,
        score,
        distanceMeters,
        ,
        ,
        outcome,
        stageId,
        ,
        ,
        healthBonus,
        createdAtMs,
        runId,
        finishFingerprint,
      ] = this.bindings;
      if (
        this.db.entry !== null ||
        this.db.run?.id !== runId ||
        this.db.run.status !== 'submitted' ||
        this.db.run.finish_fingerprint !== finishFingerprint
      ) {
        return { success: true, meta: { changes: 0 } };
      }
      this.db.entry = {
        id: id as string,
        name: name as string,
        score: score as number,
        distance_meters: distanceMeters as number,
        outcome: outcome as EntryRow['outcome'],
        stage_id: stageId as EntryRow['stage_id'],
        health_bonus: healthBonus as number,
        created_at_ms: createdAtMs as number,
      };
      this.db.insertCount += 1;
      return { success: true, meta: { changes: 1 } };
    }
    throw new Error(`Unexpected run() query: ${query}`);
  }
}

class StatefulDatabase implements D1DatabaseLike {
  public entry: EntryRow | null = null;
  public insertCount = 0;
  public readonly rank = 3;

  public constructor(public run: RunRow | null) {}

  public prepare(query: string): D1PreparedStatement {
    return new StatefulStatement(this, query);
  }

  public async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    const results: D1Result[] = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

function finishRequest(body: Record<string, unknown>): Request {
  return new Request(`${ORIGIN}/api/runs/${RUN_ID}/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(body),
  });
}

async function callFinish(db: D1DatabaseLike, body: Record<string, unknown>): Promise<Response> {
  const context: PagesContext = {
    request: finishRequest(body),
    env: { DB: db },
    params: { id: RUN_ID },
    waitUntil: vi.fn(),
  };
  return finishRun(context);
}

async function createIssuedDatabase(): Promise<StatefulDatabase> {
  return new StatefulDatabase({
    id: RUN_ID,
    token_hash: await sha256Hex(RUN_TOKEN),
    rules_version: NETWORK_LEADERBOARD_RULES_VERSION,
    issued_at_ms: ISSUED_AT_MS,
    expires_at_ms: ISSUED_AT_MS + 15 * 60_000,
    status: 'issued',
    checkpoint_elapsed_seconds: null,
    checkpoint_items: null,
    checkpoint_energy: null,
    checkpoint_injury_risk: null,
    checkpoint_at_ms: null,
    submitted_at_ms: null,
    finish_fingerprint: null,
  });
}

const validPayload = {
  token: RUN_TOKEN,
  name: '測試跑者',
  elapsedSeconds: 10,
  collectedRecoveryItems: 0,
  energy: 0,
  injuryRisk: 0,
  outcome: 'stopped',
  stageId: 'base',
};

describe('finish route idempotency', () => {
  it('returns the existing entry for an identical replay without inserting twice', async () => {
    const db = await createIssuedDatabase();
    vi.spyOn(Date, 'now').mockReturnValue(ISSUED_AT_MS + 10_000);

    const initial = await callFinish(db, validPayload);
    const initialBody = await initial.json();
    expect(initial.status).toBe(201);
    expect(initialBody).toMatchObject({
      entry: { id: RUN_ID, name: '測試跑者', outcome: 'stopped', stageId: 'base' },
      rank: 3,
    });
    expect(db.insertCount).toBe(1);

    // A retry remains recoverable after the run TTL, as long as its authenticated
    // payload hashes to the fingerprint that was already committed.
    vi.spyOn(Date, 'now').mockReturnValue(ISSUED_AT_MS + 16 * 60_000);
    const replay = await callFinish(db, validPayload);

    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(initialBody);
    expect(db.insertCount).toBe(1);
  });

  it('rejects a different payload after submission and preserves the original entry', async () => {
    const db = await createIssuedDatabase();
    vi.spyOn(Date, 'now').mockReturnValue(ISSUED_AT_MS + 10_000);
    expect((await callFinish(db, validPayload)).status).toBe(201);

    const replay = await callFinish(db, { ...validPayload, name: '另一位跑者' });

    expect(replay.status).toBe(409);
    expect(await replay.json()).toEqual({
      error: { code: 'RUN_ALREADY_SUBMITTED', message: '本次跑局已提交過不同的成績。' },
    });
    expect(db.entry?.name).toBe('測試跑者');
    expect(db.insertCount).toBe(1);
  });
});
