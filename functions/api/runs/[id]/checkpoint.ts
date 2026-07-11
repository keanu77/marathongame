import { validateCheckpoint } from '../../../../src/shared/networkLeaderboardRules';
import {
  ApiError,
  assertLeaderboardWriteEnabled,
  assertOnlyKeys,
  assertSameOrigin,
  getRouteId,
  jsonResponse,
  readJsonObject,
  withApiErrors,
} from '../../../_lib/http';
import { updateCheckpoint } from '../../../_lib/repository';
import { requireIssuedRun } from '../../../_lib/runAuth';
import type { PagesHandler } from '../../../_lib/types';

const handlePost: PagesHandler = (context) =>
  withApiErrors(async () => {
    assertSameOrigin(context.request);
    assertLeaderboardWriteEnabled(context.env);
    const body = await readJsonObject(context.request);
    assertOnlyKeys(body, ['token', 'elapsedSeconds', 'collectedRecoveryItems']);

    const id = getRouteId(context.params);
    const nowMs = Date.now();
    const run = await requireIssuedRun(context.env.DB, id, body.token, nowMs);
    const validation = validateCheckpoint({
      elapsedSeconds: body.elapsedSeconds,
      collectedRecoveryItems: body.collectedRecoveryItems,
      issuedAtMs: run.issued_at_ms,
      expiresAtMs: run.expires_at_ms,
      receivedAtMs: nowMs,
      previousCheckpoint:
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

    if (!validation.value.isReplay) {
      const updated = await updateCheckpoint(context.env.DB, {
        id,
        elapsedSeconds: validation.value.elapsedSeconds,
        collectedRecoveryItems: validation.value.collectedRecoveryItems,
        receivedAtMs: nowMs,
      });
      if (!updated) {
        throw new ApiError(409, 'CHECKPOINT_CONFLICT', '檢查點已由較新的進度更新。');
      }
    }

    return jsonResponse({ accepted: true });
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
