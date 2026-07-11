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
import {
  commitFinishedRun,
  getEntry,
  getEntryRank,
  getRun,
  type EntryRow,
  type RunRow,
} from '../../../_lib/repository';
import { requireRun } from '../../../_lib/runAuth';
import { sha256Hex } from '../../../_lib/security';
import type { D1DatabaseLike, PagesHandler } from '../../../_lib/types';

const alreadySubmittedError = () =>
  new ApiError(409, 'RUN_ALREADY_SUBMITTED', '本次跑局已提交過不同的成績。');

function checkpointFor(run: RunRow) {
  return run.checkpoint_elapsed_seconds === null ||
    run.checkpoint_items === null ||
    run.checkpoint_at_ms === null
    ? null
    : {
        elapsedSeconds: run.checkpoint_elapsed_seconds,
        collectedRecoveryItems: run.checkpoint_items,
        receivedAtMs: run.checkpoint_at_ms,
      };
}

function publicEntry(row: EntryRow) {
  return {
    id: row.id,
    name: row.name,
    score: row.score,
    distanceMeters: row.distance_meters,
    outcome: row.outcome,
    stageId: row.stage_id,
  };
}

async function existingEntryResponse(db: D1DatabaseLike, id: string): Promise<Response> {
  const row = await getEntry(db, id);
  if (row === null) {
    throw new Error(`Submitted run ${id} has no leaderboard entry.`);
  }

  const globalRank = await getEntryRank(db, id);
  const rank = globalRank > 0 && globalRank <= LEADERBOARD_LIMIT ? globalRank : null;
  return jsonResponse({ entry: publicEntry(row), rank });
}

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
    const run = await requireRun(context.env.DB, id, body.token);
    const isReplay = run.status === 'submitted';
    if (!isReplay && nowMs > run.expires_at_ms) {
      throw new ApiError(410, 'RUN_EXPIRED', '本次跑局已過期。');
    }

    // A successfully submitted run was validated at submitted_at_ms. Reusing
    // that time lets a client safely recover a lost response even after expiry.
    const validationTimeMs = isReplay
      ? (run.submitted_at_ms ?? Math.min(nowMs, run.expires_at_ms))
      : nowMs;
    const validation = validateFinish({
      elapsedSeconds: body.elapsedSeconds,
      collectedRecoveryItems: body.collectedRecoveryItems,
      outcome: body.outcome,
      stageId: body.stageId,
      issuedAtMs: run.issued_at_ms,
      expiresAtMs: run.expires_at_ms,
      receivedAtMs: validationTimeMs,
      checkpoint: checkpointFor(run),
    });
    if (!validation.ok) {
      if (isReplay) throw alreadySubmittedError();
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

    if (isReplay) {
      if (run.finish_fingerprint !== fingerprint) throw alreadySubmittedError();
      return existingEntryResponse(context.env.DB, id);
    }

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
      // Another identical request may have committed while this request was
      // validating. Treat that race exactly like a normal idempotent replay.
      const latestRun = await getRun(context.env.DB, id);
      if (latestRun?.status === 'submitted' && latestRun.finish_fingerprint === fingerprint) {
        return existingEntryResponse(context.env.DB, id);
      }
      throw alreadySubmittedError();
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
