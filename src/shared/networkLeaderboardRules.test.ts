import {
  calculateValidatedDistance,
  calculateValidatedScore,
  DEFAULT_LEADERBOARD_NAME,
  getTheoreticalMaximumAdditionalRecoveryItems,
  getTheoreticalMaximumRecoveryItems,
  getValidatedStageId,
  isCompletionCheckpointTimingValid,
  MAX_LEADERBOARD_NAME_GRAPHEMES,
  sanitizeLeaderboardName,
  SERVER_START_SKEW_TOLERANCE_MS,
  validateCheckpoint,
  validateFinish,
} from './networkLeaderboardRules';

const ISSUED_AT = 1_700_000_000_000;
const EXPIRES_AT = ISSUED_AT + 15 * 60_000;

describe('network leaderboard score rules', () => {
  it('maps 80 seconds to the official distance and calculates only from elapsed time and items', () => {
    expect(calculateValidatedDistance(80)).toBe(42_195);
    expect(calculateValidatedDistance(500)).toBe(42_195);
    expect(calculateValidatedScore(80, 3)).toBe(Math.floor(42_195 / 25) + 150);
    expect(calculateValidatedScore(Number.NaN, -20)).toBe(0);
  });

  it('derives stage boundaries from the three configured stages', () => {
    expect(getValidatedStageId(24.999)).toBe('base');
    expect(getValidatedStageId(25)).toBe('build');
    expect(getValidatedStageId(54.999)).toBe('build');
    expect(getValidatedStageId(55)).toBe('race');
    expect(getValidatedStageId(80)).toBe('race');
  });

  it('uses a conservative item ceiling that increases with elapsed time', () => {
    expect(getTheoreticalMaximumRecoveryItems(0)).toBe(0);
    expect(getTheoreticalMaximumRecoveryItems(2)).toBeGreaterThanOrEqual(1);
    expect(getTheoreticalMaximumRecoveryItems(80)).toBe(24);
    expect(getTheoreticalMaximumAdditionalRecoveryItems(60, 80)).toBe(7);
  });
});

describe('checkpoint validation', () => {
  it('shares the exact 60–75 second completion checkpoint window with the client', () => {
    expect(isCompletionCheckpointTimingValid(60, 80)).toBe(true);
    expect(isCompletionCheckpointTimingValid(75, 80)).toBe(true);
    expect(isCompletionCheckpointTimingValid(59.999, 80)).toBe(false);
    expect(isCompletionCheckpointTimingValid(75.001, 80)).toBe(false);
    expect(isCompletionCheckpointTimingValid(Number.NaN, 80)).toBe(false);
  });

  it('accepts monotonic progress and an identical retry', () => {
    const first = validateCheckpoint({
      elapsedSeconds: 20,
      collectedRecoveryItems: 3,
      issuedAtMs: ISSUED_AT,
      expiresAtMs: EXPIRES_AT,
      receivedAtMs: ISSUED_AT + 20_000 - SERVER_START_SKEW_TOLERANCE_MS,
      previousCheckpoint: null,
    });
    expect(first).toEqual({
      ok: true,
      value: { elapsedSeconds: 20, collectedRecoveryItems: 3, isReplay: false },
    });

    const retry = validateCheckpoint({
      elapsedSeconds: 20,
      collectedRecoveryItems: 3,
      issuedAtMs: ISSUED_AT,
      expiresAtMs: EXPIRES_AT,
      receivedAtMs: ISSUED_AT + 22_000,
      previousCheckpoint: {
        elapsedSeconds: 20,
        collectedRecoveryItems: 3,
        receivedAtMs: ISSUED_AT + 20_000,
      },
    });
    expect(retry.ok && retry.value.isReplay).toBe(true);
  });

  it('rejects time travel, item rollback, impossible items and premature progress', () => {
    const previousCheckpoint = {
      elapsedSeconds: 20,
      collectedRecoveryItems: 3,
      receivedAtMs: ISSUED_AT + 20_000,
    };
    const base = {
      issuedAtMs: ISSUED_AT,
      expiresAtMs: EXPIRES_AT,
      receivedAtMs: ISSUED_AT + 30_000,
      previousCheckpoint,
    };

    expect(
      validateCheckpoint({ ...base, elapsedSeconds: 19, collectedRecoveryItems: 3 }),
    ).toMatchObject({ ok: false, code: 'CHECKPOINT_NOT_MONOTONIC' });
    expect(
      validateCheckpoint({ ...base, elapsedSeconds: 21, collectedRecoveryItems: 2 }),
    ).toMatchObject({ ok: false, code: 'CHECKPOINT_ITEMS_NOT_MONOTONIC' });
    expect(
      validateCheckpoint({ ...base, elapsedSeconds: 21, collectedRecoveryItems: 99 }),
    ).toMatchObject({ ok: false, code: 'IMPOSSIBLE_ITEM_COUNT' });
    expect(
      validateCheckpoint({
        ...base,
        elapsedSeconds: 40,
        collectedRecoveryItems: 3,
        receivedAtMs: ISSUED_AT + 1_000,
      }),
    ).toMatchObject({ ok: false, code: 'RUN_TOO_FAST' });
  });
});

describe('finish validation', () => {
  const checkpoint = {
    elapsedSeconds: 60,
    collectedRecoveryItems: 10,
    receivedAtMs: ISSUED_AT + 60_000,
  };

  it('accepts a recent sufficient checkpoint and recomputes the completed result', () => {
    const result = validateFinish({
      elapsedSeconds: 80,
      collectedRecoveryItems: 14,
      outcome: 'completed',
      stageId: 'race',
      issuedAtMs: ISSUED_AT,
      expiresAtMs: EXPIRES_AT,
      receivedAtMs: ISSUED_AT + 80_000,
      checkpoint,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        elapsedSeconds: 80,
        collectedRecoveryItems: 14,
        outcome: 'completed',
        stageId: 'race',
        distanceMeters: 42_195,
        score: calculateValidatedScore(80, 14),
      },
    });
  });

  it('rejects a fake completion and inconsistent stopped stage', () => {
    expect(
      validateFinish({
        elapsedSeconds: 79,
        collectedRecoveryItems: 10,
        outcome: 'completed',
        stageId: 'race',
        issuedAtMs: ISSUED_AT,
        expiresAtMs: EXPIRES_AT,
        receivedAtMs: ISSUED_AT + 79_000,
        checkpoint,
      }),
    ).toMatchObject({ ok: false, code: 'OUTCOME_STAGE_MISMATCH' });

    expect(
      validateFinish({
        elapsedSeconds: 80,
        collectedRecoveryItems: 24,
        outcome: 'completed',
        stageId: 'race',
        issuedAtMs: ISSUED_AT,
        expiresAtMs: EXPIRES_AT,
        receivedAtMs: ISSUED_AT + 80_000,
        checkpoint: { ...checkpoint, collectedRecoveryItems: 0 },
      }),
    ).toMatchObject({ ok: false, code: 'IMPOSSIBLE_ITEM_DELTA' });

    expect(
      validateFinish({
        elapsedSeconds: 80,
        collectedRecoveryItems: 12,
        outcome: 'completed',
        stageId: 'race',
        issuedAtMs: ISSUED_AT,
        expiresAtMs: EXPIRES_AT,
        receivedAtMs: ISSUED_AT + 80_000,
        checkpoint: {
          elapsedSeconds: 80,
          collectedRecoveryItems: 12,
          receivedAtMs: ISSUED_AT + 80_000,
        },
      }),
    ).toMatchObject({ ok: false, code: 'CHECKPOINT_INSUFFICIENT' });

    expect(
      validateFinish({
        elapsedSeconds: 30,
        collectedRecoveryItems: 5,
        outcome: 'stopped',
        stageId: 'base',
        issuedAtMs: ISSUED_AT,
        expiresAtMs: EXPIRES_AT,
        receivedAtMs: ISSUED_AT + 30_000,
        checkpoint: null,
      }),
    ).toMatchObject({ ok: false, code: 'OUTCOME_STAGE_MISMATCH' });
  });
});

describe('public nickname sanitation', () => {
  it('normalizes Unicode, removes controls, collapses spaces and truncates graphemes', () => {
    expect(sanitizeLeaderboardName('  ＡＢＣ\n 跑者\u202e  ')).toBe('ABC 跑者');
    expect(sanitizeLeaderboardName('跑'.repeat(20))).toBe(
      '跑'.repeat(MAX_LEADERBOARD_NAME_GRAPHEMES),
    );
    expect(sanitizeLeaderboardName('   ')).toBe(DEFAULT_LEADERBOARD_NAME);
    expect(sanitizeLeaderboardName(undefined)).toBe(DEFAULT_LEADERBOARD_NAME);
  });

  it('does not split a grapheme cluster', () => {
    const family = '👨‍👩‍👧‍👦';
    const result = sanitizeLeaderboardName(family.repeat(20));
    expect(
      Array.from(new Intl.Segmenter('zh-Hant', { granularity: 'grapheme' }).segment(result)),
    ).toHaveLength(1);
  });
});
