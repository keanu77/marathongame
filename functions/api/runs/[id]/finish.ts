import {
  LEADERBOARD_LIMIT,
  sanitizeLeaderboardName,
  validateFinish,
} from '../../../../src/shared/networkLeaderboardRules';
import {
  ApiError,
  assertOnlyKeys,
  assertSameOrigin,
  getRouteId,
  jsonResponse,
  readJsonObject,
  withApiErrors,
} from '../../../_lib/http';
import { commitFinishedRun, getEntryRank } from '../../../_lib/repository';
import { requireIssuedRun } from '../../../_lib/runAuth';
import { sha256Hex } from '../../../_lib/security';
import type { PagesHandler } from '../../../_lib/types';

const handlePost: PagesHandler = (context) =>
  withApiErrors(async () => {
    assertSameOrigin(context.request, context.env);
    const body = await readJsonObject(context.request);
    assertOnlyKeys(body, [
      'token',
      'name',
      'elapsedSeconds',
      'collectedRecoveryItems',
      'outcome',
      'stageId',
    ]);

    const id = getRouteId(context.params);
    const nowMs = Date.now();
    const run = await requireIssuedRun(context.env.DB, id, body.token, nowMs);
    const validation = validateFinish({
      elapsedSeconds: body.elapsedSeconds,
      collectedRecoveryItems: body.collectedRecoveryItems,
      outcome: body.outcome,
      stageId: body.stageId,
      issuedAtMs: run.issued_at_ms,
      expiresAtMs: run.expires_at_ms,
      receivedAtMs: nowMs,
      checkpoint:
        run.checkpoint_elapsed_seconds === null ||
        run.checkpoint_items === null ||
        run.checkpoint_at_ms === null
          ? null
          : {
              elapsedSeconds: run.checkpoint_elapsed_seconds,
              collectedRecoveryItems: run.checkpoint_items,
              receivedAtMs: run.checkpoint_at_ms,
            },
    });
    if (!validation.ok) {
      const status = validation.code === 'RUN_EXPIRED' ? 410 : 422;
      throw new ApiError(status, validation.code, validation.message);
    }

    const name = sanitizeLeaderboardName(body.name);
    const entry = {
      id,
      name,
      score: validation.value.score,
      distanceMeters: validation.value.distanceMeters,
      outcome: validation.value.outcome,
      stageId: validation.value.stageId,
    };
    const fingerprint = await sha256Hex(
      JSON.stringify({
        id,
        name,
        elapsedSeconds: validation.value.elapsedSeconds,
        collectedRecoveryItems: validation.value.collectedRecoveryItems,
        outcome: validation.value.outcome,
        stageId: validation.value.stageId,
      }),
    );

    const committed = await commitFinishedRun(
      context.env.DB,
      {
        ...entry,
        elapsedSeconds: validation.value.elapsedSeconds,
        collectedRecoveryItems: validation.value.collectedRecoveryItems,
        createdAtMs: nowMs,
      },
      fingerprint,
    );
    if (!committed) {
      throw new ApiError(409, 'RUN_ALREADY_SUBMITTED', '本次跑局已提交過成績。');
    }

    const globalRank = await getEntryRank(context.env.DB, id);
    const rank = globalRank > 0 && globalRank <= LEADERBOARD_LIMIT ? globalRank : null;
    return jsonResponse({ entry, rank }, 201);
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
