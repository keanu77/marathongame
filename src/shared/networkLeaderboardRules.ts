import { GAME_CONFIG, MARATHON_CONFIG } from '../game/config';
import type { MarathonStageId } from '../game/types';

export const NETWORK_LEADERBOARD_RULES_VERSION = '2026-07-v1';
export const NETWORK_LEADERBOARD_SEASON_ID = '2026-s1';

export const RUN_TTL_MS = 15 * 60 * 1_000;
export const START_RATE_LIMIT = 30;
export const START_RATE_WINDOW_MS = 60 * 1_000;
export const SERVER_START_SKEW_TOLERANCE_MS = 8_000;
export const COMPLETION_CHECKPOINT_MIN_SECONDS = 60;
export const COMPLETION_CHECKPOINT_MIN_GAP_SECONDS = 5;
export const COMPLETION_CHECKPOINT_MAX_GAP_SECONDS = 25;
export const MAX_COMPLETION_ELAPSED_SECONDS = 82;
export const MAX_JSON_BODY_BYTES = 16 * 1_024;
export const MAX_LEADERBOARD_NAME_GRAPHEMES = 12;
export const MAX_LEADERBOARD_NAME_UTF8_BYTES = 48;
export const DEFAULT_LEADERBOARD_NAME = '匿名跑者';
export const LEADERBOARD_LIMIT = 10;
export const MAX_PENDING_RECOVERY_ITEMS_AT_CHECKPOINT = 1;

/**
 * The public marathon distance is a progress metaphor. Dividing it by 25 keeps
 * the validated score close to the existing game's pixel-distance score while
 * making it reproducible from the API contract's elapsed time and item count.
 */
export const VALIDATED_DISTANCE_METERS_PER_SCORE_POINT = 25;

export type NetworkRunOutcome = 'completed' | 'stopped';

export interface CheckpointSnapshot {
  elapsedSeconds: number;
  collectedRecoveryItems: number;
  receivedAtMs: number;
}

export interface CheckpointValidationInput {
  elapsedSeconds: unknown;
  collectedRecoveryItems: unknown;
  issuedAtMs: number;
  expiresAtMs: number;
  receivedAtMs: number;
  previousCheckpoint: CheckpointSnapshot | null;
}

export interface FinishValidationInput {
  elapsedSeconds: unknown;
  collectedRecoveryItems: unknown;
  outcome: unknown;
  stageId: unknown;
  issuedAtMs: number;
  expiresAtMs: number;
  receivedAtMs: number;
  checkpoint: CheckpointSnapshot | null;
}

export type NetworkRuleErrorCode =
  | 'INVALID_ELAPSED_TIME'
  | 'INVALID_ITEM_COUNT'
  | 'IMPOSSIBLE_ITEM_COUNT'
  | 'IMPOSSIBLE_ITEM_DELTA'
  | 'RUN_EXPIRED'
  | 'RUN_TOO_FAST'
  | 'CHECKPOINT_NOT_MONOTONIC'
  | 'CHECKPOINT_ITEMS_NOT_MONOTONIC'
  | 'INVALID_OUTCOME'
  | 'INVALID_STAGE'
  | 'OUTCOME_STAGE_MISMATCH'
  | 'CHECKPOINT_REQUIRED'
  | 'CHECKPOINT_INSUFFICIENT';

export type NetworkRuleResult<T> =
  { ok: true; value: T } | { ok: false; code: NetworkRuleErrorCode; message: string };

export interface ValidatedCheckpoint {
  elapsedSeconds: number;
  collectedRecoveryItems: number;
  isReplay: boolean;
}

export interface ValidatedFinish {
  elapsedSeconds: number;
  collectedRecoveryItems: number;
  outcome: NetworkRunOutcome;
  stageId: MarathonStageId;
  distanceMeters: number;
  score: number;
}

function fail<T>(code: NetworkRuleErrorCode, message: string): NetworkRuleResult<T> {
  return { ok: false, code, message };
}

function normalizeElapsedSeconds(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 1_000) / 1_000;
}

function normalizeItemCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

function isServerTimePlausible(
  elapsedSeconds: number,
  issuedAtMs: number,
  receivedAtMs: number,
): boolean {
  return receivedAtMs - issuedAtMs + SERVER_START_SKEW_TOLERANCE_MS >= elapsedSeconds * 1_000;
}

function getStageActiveSeconds(elapsedSeconds: number, stageIndex: number): number {
  let stageStart = 0;

  for (let index = 0; index < MARATHON_CONFIG.stages.length; index += 1) {
    const stage = MARATHON_CONFIG.stages[index];
    if (!stage) continue;
    const active = Math.min(stage.durationSeconds, Math.max(0, elapsedSeconds - stageStart));
    if (index === stageIndex) return active;
    stageStart += stage.durationSeconds;
  }

  return 0;
}

function getStageTheoreticalItemMaximum(activeSeconds: number, delayMultiplier: number): number {
  const firstDelay = GAME_CONFIG.firstRecoverySpawnDelaySeconds * delayMultiplier;
  if (activeSeconds + Number.EPSILON < firstDelay) return 0;

  const fastestFollowingDelay = GAME_CONFIG.recoverySpawnMinSeconds * delayMultiplier;
  return 1 + Math.floor((activeSeconds - firstDelay + Number.EPSILON) / fastestFollowingDelay);
}

/**
 * Conservative upper bound derived from each stage's shortest configured item
 * delay. Obstacles and the finish approach can only reduce the actual count.
 */
export function getTheoreticalMaximumRecoveryItems(elapsedSeconds: number): number {
  const safeElapsed = Math.min(
    getTotalMarathonDurationSeconds(),
    Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0),
  );

  return MARATHON_CONFIG.stages.reduce((total, stage, index) => {
    const activeSeconds = getStageActiveSeconds(safeElapsed, index);
    return (
      total + getStageTheoreticalItemMaximum(activeSeconds, stage.recoverySpawnDelayMultiplier)
    );
  }, 0);
}

/**
 * A checkpoint can have one already-spawned item that is collected after the
 * checkpoint, so the interval ceiling includes one conservative carry-over.
 */
export function getTheoreticalMaximumAdditionalRecoveryItems(
  fromElapsedSeconds: number,
  toElapsedSeconds: number,
): number {
  if (toElapsedSeconds <= fromElapsedSeconds) return 0;
  return (
    Math.max(
      0,
      getTheoreticalMaximumRecoveryItems(toElapsedSeconds) -
        getTheoreticalMaximumRecoveryItems(fromElapsedSeconds),
    ) + MAX_PENDING_RECOVERY_ITEMS_AT_CHECKPOINT
  );
}

export function getTotalMarathonDurationSeconds(): number {
  return MARATHON_CONFIG.stages.reduce((total, stage) => total + stage.durationSeconds, 0);
}

export function getValidatedStageId(elapsedSeconds: number): MarathonStageId {
  const safeElapsed = Math.max(0, elapsedSeconds);
  let stageStart = 0;

  for (let index = 0; index < MARATHON_CONFIG.stages.length; index += 1) {
    const stage = MARATHON_CONFIG.stages[index];
    if (!stage) continue;
    const stageEnd = stageStart + stage.durationSeconds;
    if (safeElapsed < stageEnd || index === MARATHON_CONFIG.stages.length - 1) {
      return stage.id;
    }
    stageStart = stageEnd;
  }

  return 'race';
}

export function calculateValidatedDistance(elapsedSeconds: number): number {
  const totalDuration = getTotalMarathonDurationSeconds();
  const safeElapsed = Math.min(
    totalDuration,
    Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0),
  );
  return Math.round((safeElapsed / totalDuration) * MARATHON_CONFIG.officialDistanceMeters);
}

/** Authoritative network score; never accepts a client-provided score. */
export function calculateValidatedScore(
  elapsedSeconds: number,
  collectedRecoveryItems: number,
): number {
  const distanceScore = Math.floor(
    calculateValidatedDistance(elapsedSeconds) / VALIDATED_DISTANCE_METERS_PER_SCORE_POINT,
  );
  const safeItems = Number.isSafeInteger(collectedRecoveryItems)
    ? Math.max(0, collectedRecoveryItems)
    : 0;
  return distanceScore + safeItems * GAME_CONFIG.recoveryItemScoreBonus;
}

function validateCommonProgress(
  elapsedSecondsValue: unknown,
  collectedRecoveryItemsValue: unknown,
  maximumElapsedSeconds: number,
): NetworkRuleResult<{ elapsedSeconds: number; collectedRecoveryItems: number }> {
  const elapsedSeconds = normalizeElapsedSeconds(elapsedSecondsValue);
  if (elapsedSeconds === null || elapsedSeconds > maximumElapsedSeconds) {
    return fail('INVALID_ELAPSED_TIME', '遊戲時間格式不正確。');
  }

  const collectedRecoveryItems = normalizeItemCount(collectedRecoveryItemsValue);
  if (collectedRecoveryItems === null) {
    return fail('INVALID_ITEM_COUNT', '道具數量格式不正確。');
  }

  if (collectedRecoveryItems > getTheoreticalMaximumRecoveryItems(elapsedSeconds)) {
    return fail('IMPOSSIBLE_ITEM_COUNT', '道具數量超過本局時間內的理論上限。');
  }

  return { ok: true, value: { elapsedSeconds, collectedRecoveryItems } };
}

export function validateCheckpoint(
  input: CheckpointValidationInput,
): NetworkRuleResult<ValidatedCheckpoint> {
  if (input.receivedAtMs > input.expiresAtMs) {
    return fail('RUN_EXPIRED', '本次跑局已過期。');
  }

  const progress = validateCommonProgress(
    input.elapsedSeconds,
    input.collectedRecoveryItems,
    getTotalMarathonDurationSeconds(),
  );
  if (!progress.ok) return progress;

  const { elapsedSeconds, collectedRecoveryItems } = progress.value;
  if (!isServerTimePlausible(elapsedSeconds, input.issuedAtMs, input.receivedAtMs)) {
    return fail('RUN_TOO_FAST', '本次進度快於伺服器可接受的時間。');
  }

  const previous = input.previousCheckpoint;
  if (previous !== null) {
    if (elapsedSeconds < previous.elapsedSeconds) {
      return fail('CHECKPOINT_NOT_MONOTONIC', '檢查點時間不可倒退。');
    }
    if (collectedRecoveryItems < previous.collectedRecoveryItems) {
      return fail('CHECKPOINT_ITEMS_NOT_MONOTONIC', '檢查點道具數不可減少。');
    }
    if (
      elapsedSeconds === previous.elapsedSeconds &&
      collectedRecoveryItems !== previous.collectedRecoveryItems
    ) {
      return fail('CHECKPOINT_NOT_MONOTONIC', '相同時間的重送必須具有相同進度。');
    }
  }

  return {
    ok: true,
    value: {
      elapsedSeconds,
      collectedRecoveryItems,
      isReplay:
        previous !== null &&
        elapsedSeconds === previous.elapsedSeconds &&
        collectedRecoveryItems === previous.collectedRecoveryItems,
    },
  };
}

export function validateFinish(input: FinishValidationInput): NetworkRuleResult<ValidatedFinish> {
  if (input.receivedAtMs > input.expiresAtMs) {
    return fail('RUN_EXPIRED', '本次跑局已過期。');
  }

  const progress = validateCommonProgress(
    input.elapsedSeconds,
    input.collectedRecoveryItems,
    MAX_COMPLETION_ELAPSED_SECONDS,
  );
  if (!progress.ok) return progress;

  const { elapsedSeconds, collectedRecoveryItems } = progress.value;
  if (!isServerTimePlausible(elapsedSeconds, input.issuedAtMs, input.receivedAtMs)) {
    return fail('RUN_TOO_FAST', '本次結算快於伺服器可接受的時間。');
  }

  if (input.outcome !== 'completed' && input.outcome !== 'stopped') {
    return fail('INVALID_OUTCOME', '結算狀態格式不正確。');
  }
  if (input.stageId !== 'base' && input.stageId !== 'build' && input.stageId !== 'race') {
    return fail('INVALID_STAGE', '關卡格式不正確。');
  }

  const totalDuration = getTotalMarathonDurationSeconds();
  const expectedStage = getValidatedStageId(elapsedSeconds);

  if (input.outcome === 'completed') {
    if (elapsedSeconds < totalDuration || input.stageId !== 'race') {
      return fail('OUTCOME_STAGE_MISMATCH', '只有完成 80 秒並抵達正式比賽才可登記完賽。');
    }

    const checkpoint = input.checkpoint;
    if (checkpoint === null) {
      return fail('CHECKPOINT_REQUIRED', '完賽成績需要有效檢查點。');
    }
    if (
      checkpoint.elapsedSeconds < COMPLETION_CHECKPOINT_MIN_SECONDS ||
      elapsedSeconds - checkpoint.elapsedSeconds < COMPLETION_CHECKPOINT_MIN_GAP_SECONDS ||
      elapsedSeconds - checkpoint.elapsedSeconds > COMPLETION_CHECKPOINT_MAX_GAP_SECONDS ||
      checkpoint.collectedRecoveryItems > collectedRecoveryItems
    ) {
      return fail('CHECKPOINT_INSUFFICIENT', '最後檢查點不足以驗證本次完賽。');
    }
    if (
      collectedRecoveryItems - checkpoint.collectedRecoveryItems >
      getTheoreticalMaximumAdditionalRecoveryItems(checkpoint.elapsedSeconds, elapsedSeconds)
    ) {
      return fail('IMPOSSIBLE_ITEM_DELTA', '最後區間的道具增加量超過理論上限。');
    }
  } else if (elapsedSeconds >= totalDuration || input.stageId !== expectedStage) {
    return fail('OUTCOME_STAGE_MISMATCH', '中途停止狀態與遊戲時間或關卡不一致。');
  }

  return {
    ok: true,
    value: {
      elapsedSeconds,
      collectedRecoveryItems,
      outcome: input.outcome,
      stageId: input.stageId,
      distanceMeters: calculateValidatedDistance(elapsedSeconds),
      score: calculateValidatedScore(elapsedSeconds, collectedRecoveryItems),
    },
  };
}

function segmentGraphemes(value: string): string[] {
  if (typeof Intl.Segmenter !== 'function') return Array.from(value);
  return Array.from(
    new Intl.Segmenter('zh-Hant', { granularity: 'grapheme' }).segment(value),
    (part) => part.segment,
  );
}

/** Normalizes public names while retaining ordinary Traditional Chinese and emoji. */
export function sanitizeLeaderboardName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_LEADERBOARD_NAME;

  const normalized = value
    .normalize('NFKC')
    // Keep U+200D so an emoji ZWJ sequence remains one grapheme; remove other
    // invisible controls and all bidirectional override/isolate characters.
    .replace(
      /[\p{Cc}\p{Cs}\u061c\u200b\u200c\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/gu,
      '',
    )
    .replace(/\s+/gu, ' ')
    .trim();
  if (normalized === '') return DEFAULT_LEADERBOARD_NAME;

  const encoder = new TextEncoder();
  const graphemes = segmentGraphemes(normalized).slice(0, MAX_LEADERBOARD_NAME_GRAPHEMES);
  while (
    graphemes.length > 0 &&
    (encoder.encode(graphemes.join('')).byteLength > MAX_LEADERBOARD_NAME_UTF8_BYTES ||
      Array.from(graphemes.join('')).length > MAX_LEADERBOARD_NAME_GRAPHEMES)
  ) {
    graphemes.pop();
  }

  return graphemes.join('') || DEFAULT_LEADERBOARD_NAME;
}
