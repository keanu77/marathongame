import { NETWORK_LEADERBOARD_RULES_VERSION } from '../../src/shared/networkLeaderboardRules';

import { ApiError } from './http';
import { getRun, type RunRow } from './repository';
import { assertRunTokenFormat, sha256Hex, timingSafeEqualHex } from './security';
import type { D1DatabaseLike } from './types';

export async function requireRun(
  db: D1DatabaseLike,
  id: string,
  tokenValue: unknown,
): Promise<RunRow> {
  assertRunTokenFormat(tokenValue);
  const run = await getRun(db, id);
  if (run === null) {
    throw new ApiError(404, 'RUN_NOT_FOUND', '找不到本次跑局。');
  }

  const tokenHash = await sha256Hex(tokenValue);
  if (!timingSafeEqualHex(run.token_hash, tokenHash)) {
    throw new ApiError(401, 'INVALID_RUN_TOKEN', '跑局憑證無效。');
  }
  if (run.rules_version !== NETWORK_LEADERBOARD_RULES_VERSION) {
    throw new ApiError(409, 'RULES_VERSION_MISMATCH', '本次跑局使用的規則版本已不支援。');
  }
  return run;
}

export async function requireIssuedRun(
  db: D1DatabaseLike,
  id: string,
  tokenValue: unknown,
  nowMs: number,
): Promise<RunRow> {
  const run = await requireRun(db, id, tokenValue);
  if (run.status !== 'issued') {
    throw new ApiError(409, 'RUN_ALREADY_SUBMITTED', '本次跑局已提交過成績。');
  }
  if (nowMs > run.expires_at_ms) {
    throw new ApiError(410, 'RUN_EXPIRED', '本次跑局已過期。');
  }
  return run;
}
