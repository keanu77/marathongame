import { NETWORK_LEADERBOARD_RULES_VERSION } from '../src/shared/networkLeaderboardRules';
import type { RunRow } from '../functions/_lib/repository';
import { requireIssuedRun, requireRun } from '../functions/_lib/runAuth';
import { sha256Hex } from '../functions/_lib/security';
import type { D1DatabaseLike, D1PreparedStatement, D1Result } from '../functions/_lib/types';

const TOKEN = 'B'.repeat(43);

class RunDatabase implements D1DatabaseLike {
  public constructor(private readonly run: RunRow) {}

  public prepare(): D1PreparedStatement {
    return {
      bind: () => this.prepare(),
      first: async <T>() => this.run as T,
      all: async <T>() => ({ results: [] as T[], success: true }),
      run: async () => ({ success: true }),
    };
  }

  public async batch(): Promise<D1Result[]> {
    return [];
  }
}

async function runRow(overrides: Partial<RunRow> = {}): Promise<RunRow> {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    token_hash: await sha256Hex(TOKEN),
    rules_version: NETWORK_LEADERBOARD_RULES_VERSION,
    issued_at_ms: 1_000,
    expires_at_ms: 2_000,
    status: 'issued',
    checkpoint_elapsed_seconds: null,
    checkpoint_items: null,
    checkpoint_at_ms: null,
    submitted_at_ms: null,
    finish_fingerprint: null,
    ...overrides,
  };
}

describe('run authentication state checks', () => {
  it('lets finish authenticate an already submitted run without weakening checkpoint checks', async () => {
    const submitted = await runRow({
      status: 'submitted',
      submitted_at_ms: 1_500,
      finish_fingerprint: 'f'.repeat(64),
    });
    const db = new RunDatabase(submitted);

    await expect(requireRun(db, submitted.id, TOKEN)).resolves.toEqual(submitted);
    await expect(requireIssuedRun(db, submitted.id, TOKEN, 1_600)).rejects.toMatchObject({
      status: 409,
      code: 'RUN_ALREADY_SUBMITTED',
    });
  });

  it('continues to reject an expired issued run', async () => {
    const issued = await runRow();

    await expect(
      requireIssuedRun(new RunDatabase(issued), issued.id, TOKEN, 2_001),
    ).rejects.toMatchObject({ status: 410, code: 'RUN_EXPIRED' });
  });
});
