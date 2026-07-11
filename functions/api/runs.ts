import {
  NETWORK_LEADERBOARD_RULES_VERSION,
  RUN_TTL_MS,
  START_RATE_LIMIT,
  START_RATE_WINDOW_MS,
} from '../../src/shared/networkLeaderboardRules';
import {
  ApiError,
  assertLeaderboardWriteEnabled,
  assertOnlyKeys,
  assertSameOrigin,
  jsonResponse,
  readJsonObject,
  withApiErrors,
} from '../_lib/http';
import {
  incrementStartRate,
  insertRun,
  pruneAbandonedRuns,
  pruneOldRateCounters,
} from '../_lib/repository';
import { createDailyRateKey, createRunToken, sha256Hex } from '../_lib/security';
import type { PagesHandler } from '../_lib/types';

const handlePost: PagesHandler = (context) =>
  withApiErrors(async () => {
    assertSameOrigin(context.request);
    assertLeaderboardWriteEnabled(context.env);
    // 明確要求空 JSON 物件，避免不同 Fetch 實作對無 body POST 的空串流行為不一致。
    const body = await readJsonObject(context.request);
    assertOnlyKeys(body, []);

    const nowMs = Date.now();
    const rateKey = await createDailyRateKey(context.request, context.env.RATE_LIMIT_SECRET, nowMs);
    const windowStartMs = Math.floor(nowMs / START_RATE_WINDOW_MS) * START_RATE_WINDOW_MS;
    const requestCount = await incrementStartRate(context.env.DB, rateKey, windowStartMs);
    if (requestCount > START_RATE_LIMIT) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((windowStartMs + START_RATE_WINDOW_MS - nowMs) / 1_000),
      );
      throw new ApiError(429, 'RATE_LIMITED', '建立跑局過於頻繁，請稍後再試。', {
        'Retry-After': String(retryAfterSeconds),
      });
    }

    const id = crypto.randomUUID();
    const token = createRunToken();
    const expiresAtMs = nowMs + RUN_TTL_MS;
    await insertRun(context.env.DB, {
      id,
      tokenHash: await sha256Hex(token),
      rulesVersion: NETWORK_LEADERBOARD_RULES_VERSION,
      issuedAtMs: nowMs,
      expiresAtMs,
    });

    context.waitUntil(
      Promise.all([
        pruneOldRateCounters(context.env.DB, nowMs - 2 * 24 * 60 * 60 * 1_000),
        pruneAbandonedRuns(context.env.DB, nowMs - 24 * 60 * 60 * 1_000),
      ]),
    );

    return jsonResponse(
      {
        run: {
          id,
          token,
          expiresAt: new Date(expiresAtMs).toISOString(),
          rulesVersion: NETWORK_LEADERBOARD_RULES_VERSION,
        },
      },
      201,
    );
  });

export const onRequest: PagesHandler = (context) => {
  if (context.request.method !== 'POST') {
    return jsonResponse(
      { error: { code: 'METHOD_NOT_ALLOWED', message: '此 API 只接受 POST。' } },
      405,
      { headers: { Allow: 'POST' } },
    );
  }
  return handlePost(context);
};
