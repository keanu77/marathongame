import { GAME_CONFIG } from '../config';
import {
  MARATHON_STAGE_ENTRY_COPY,
  MARATHON_STAGE_LABELS,
  OBSTACLE_LABELS,
  OBSTACLE_VISUAL_LABELS,
  RECOVERY_ITEM_LABELS,
  selectEducationMessage,
} from '../data';
import type { StorageLike } from '../types';
import {
  advanceProgress,
  advanceStatusEffects,
  applyObstacleImpact,
  applyRecoveryItem,
  clampVitals,
  createGameOverResult,
  createInitialProgress,
  createInitialStatusEffects,
  createObstacleImpactCounts,
  determineGameOverReason,
  getDominantObstacle,
  getEnergyDrainMultiplier,
  getPaceSpeedMultiplier,
  readHighScore,
  recordObstacleImpact,
  updateHighScore,
} from './index';

describe('體力與受傷風險', () => {
  it('體力不會超過 100', () => {
    expect(clampVitals({ energy: 140, injuryRisk: 0 }).energy).toBe(100);

    const recovered = applyRecoveryItem(
      { energy: 96, injuryRisk: 0 },
      createInitialStatusEffects(),
      'nutrition',
    );

    expect(recovered.vitals.energy).toBe(100);
    expect(recovered.energyRecovered).toBe(4);
  });

  it('受傷風險不會低於 0 或高於 100', () => {
    expect(clampVitals({ energy: 100, injuryRisk: -20 }).injuryRisk).toBe(0);
    expect(clampVitals({ energy: 100, injuryRisk: 140 }).injuryRisk).toBe(100);

    const recovered = applyRecoveryItem(
      { energy: 100, injuryRisk: 4 },
      createInitialStatusEffects(),
      'sleep',
    );
    const injured = applyObstacleImpact(
      { energy: 100, injuryRisk: 90 },
      createInitialStatusEffects(),
      'sportsInjury',
    );

    expect(recovered.vitals.injuryRisk).toBe(0);
    expect(injured.vitals.injuryRisk).toBe(100);
  });
});

describe('障礙與狀態效果', () => {
  it('肌力防護可將所有障礙的數值傷害減半', () => {
    const protectedStatus = {
      ...createInitialStatusEffects(),
      strengthProtectionRemainingSeconds: 5,
    };

    const illness = applyObstacleImpact({ energy: 100, injuryRisk: 0 }, protectedStatus, 'illness');
    const injury = applyObstacleImpact(
      { energy: 100, injuryRisk: 0 },
      protectedStatus,
      'sportsInjury',
    );
    const overtraining = applyObstacleImpact(
      { energy: 100, injuryRisk: 0 },
      protectedStatus,
      'overtraining',
    );

    expect(illness.energyDamage).toBe(GAME_CONFIG.illnessEnergyDamage / 2);
    expect(illness.injuryRiskDamage).toBe(GAME_CONFIG.illnessRiskDamage / 2);
    expect(injury.energyDamage).toBe(GAME_CONFIG.sportsInjuryEnergyDamage / 2);
    expect(injury.injuryRiskDamage).toBe(GAME_CONFIG.sportsInjuryRiskDamage / 2);
    expect(overtraining.energyDamage).toBe(GAME_CONFIG.overtrainingEnergyDamage / 2);
    expect(overtraining.injuryRiskDamage).toBe(GAME_CONFIG.overtrainingRiskDamage / 2);
  });

  it('生病與過度訓練會啟用恢復不足，較長的新狀態會覆蓋剩餘時間', () => {
    const illness = applyObstacleImpact(
      { energy: 100, injuryRisk: 0 },
      createInitialStatusEffects(),
      'illness',
    );
    const overtraining = applyObstacleImpact(illness.vitals, illness.statusEffects, 'overtraining');

    expect(illness.statusEffects.recoveryDeficitRemainingSeconds).toBe(
      GAME_CONFIG.illnessRecoveryDeficitSeconds,
    );
    expect(overtraining.statusEffects.recoveryDeficitRemainingSeconds).toBe(
      GAME_CONFIG.overtrainingRecoveryDeficitSeconds,
    );
  });

  it('恢復不足可降低數值恢復效果，睡眠道具同時解除狀態', () => {
    const recoveryDeficit = {
      ...createInitialStatusEffects(),
      recoveryDeficitRemainingSeconds: 8,
    };
    const nutrition = applyRecoveryItem(
      { energy: 50, injuryRisk: 40 },
      recoveryDeficit,
      'nutrition',
    );
    const lsd = applyRecoveryItem({ energy: 50, injuryRisk: 40 }, recoveryDeficit, 'lsd');
    const sleep = applyRecoveryItem({ energy: 50, injuryRisk: 40 }, recoveryDeficit, 'sleep');

    expect(nutrition.energyRecovered).toBe(
      GAME_CONFIG.nutritionEnergyRecovery * GAME_CONFIG.recoveryDeficitRecoveryMultiplier,
    );
    expect(lsd.energyRecovered).toBe(
      GAME_CONFIG.paceModes.lsd.immediateEnergyRecovery *
        GAME_CONFIG.recoveryDeficitRecoveryMultiplier,
    );
    expect(sleep.energyRecovered).toBe(
      GAME_CONFIG.sleepEnergyRecovery * GAME_CONFIG.recoveryDeficitRecoveryMultiplier,
    );
    expect(sleep.injuryRiskReduced).toBe(
      GAME_CONFIG.sleepRiskReduction * GAME_CONFIG.recoveryDeficitRecoveryMultiplier,
    );
    expect(sleep.statusEffects.recoveryDeficitRemainingSeconds).toBe(0);
  });

  it('後取得的配速模式覆蓋舊模式，並套用各自速度與耗能倍率', () => {
    const zone2 = applyRecoveryItem(
      { energy: 50, injuryRisk: 0 },
      createInitialStatusEffects(),
      'zone2',
    );
    expect(zone2.statusEffects.paceMode).toBe('zone2');
    expect(zone2.statusEffects.paceRemainingSeconds).toBe(
      GAME_CONFIG.paceModes.zone2.durationSeconds,
    );
    expect(getPaceSpeedMultiplier(zone2.statusEffects)).toBe(
      GAME_CONFIG.paceModes.zone2.speedMultiplier,
    );
    expect(getEnergyDrainMultiplier(zone2.statusEffects)).toBe(
      GAME_CONFIG.paceModes.zone2.energyDrainMultiplier,
    );

    const interval = applyRecoveryItem(zone2.vitals, zone2.statusEffects, 'interval');
    expect(interval.statusEffects.paceMode).toBe('interval');
    expect(interval.statusEffects.paceRemainingSeconds).toBe(
      GAME_CONFIG.paceModes.interval.durationSeconds,
    );
    expect(getPaceSpeedMultiplier(interval.statusEffects)).toBe(
      GAME_CONFIG.paceModes.interval.speedMultiplier,
    );
    expect(getEnergyDrainMultiplier(interval.statusEffects)).toBeGreaterThan(1);

    const lsd = applyRecoveryItem(interval.vitals, interval.statusEffects, 'lsd');
    expect(lsd.statusEffects.paceMode).toBe('lsd');
    expect(lsd.statusEffects.paceRemainingSeconds).toBe(GAME_CONFIG.paceModes.lsd.durationSeconds);
    expect(lsd.energyRecovered).toBe(GAME_CONFIG.paceModes.lsd.immediateEnergyRecovery);
    expect(getPaceSpeedMultiplier(lsd.statusEffects)).toBe(
      GAME_CONFIG.paceModes.lsd.speedMultiplier,
    );
    expect(getEnergyDrainMultiplier(lsd.statusEffects)).toBeLessThan(1);
  });

  it('狀態時間歸零時會正確回報並清除配速模式', () => {
    const result = advanceStatusEffects(
      { energy: 100, injuryRisk: 10 },
      {
        recoveryDeficitRemainingSeconds: 4,
        strengthProtectionRemainingSeconds: 3,
        paceMode: 'zone2',
        paceRemainingSeconds: 2,
      },
      3,
    );

    expect(result.statusEffects).toEqual({
      recoveryDeficitRemainingSeconds: 1,
      strengthProtectionRemainingSeconds: 0,
      paceMode: null,
      paceRemainingSeconds: 0,
    });
    expect(result.paceModeExpired).toBe(true);
    expect(result.recoveryDeficitExpired).toBe(false);
  });
});

describe('結束原因與衛教', () => {
  it('能正確判斷體力耗盡、受傷風險過高與未結束', () => {
    expect(determineGameOverReason({ energy: 0, injuryRisk: 40 })).toBe('energyDepleted');
    expect(determineGameOverReason({ energy: 30, injuryRisk: 100 })).toBe('injuryRiskMaxed');
    expect(determineGameOverReason({ energy: 30, injuryRisk: 99 })).toBeNull();
  });

  it('可依主要障礙選擇對應衛教訊息', () => {
    let impactCounts = createObstacleImpactCounts();
    impactCounts = recordObstacleImpact(impactCounts, 'illness');
    impactCounts = recordObstacleImpact(impactCounts, 'sportsInjury');
    impactCounts = recordObstacleImpact(impactCounts, 'sportsInjury');

    const dominantObstacle = getDominantObstacle(impactCounts);
    const educationMessage = selectEducationMessage({
      dominantObstacle,
      gameOverReason: 'injuryRiskMaxed',
    });

    expect(dominantObstacle).toBe('sportsInjury');
    expect(educationMessage.id).toBe(2);
    expect(educationMessage.text).toContain('疼痛');
    expect(educationMessage.action).toContain('停止');
  });

  it('完賽結果允許空的停止原因，並選擇完賽衛教', () => {
    const result = createGameOverResult({
      reason: null,
      outcome: 'completed',
      stageId: 'race',
      stageIndex: 2,
      overallProgress: 1,
      dominantObstacle: null,
      distanceMeters: 42_195,
      score: 42_195,
      highScore: 42_195,
      isNewHighScore: true,
    });

    expect(result.outcome).toBe('completed');
    expect(result.reason).toBeNull();
    expect(result.stageId).toBe('race');
    expect(result.overallProgress).toBe(1);
    expect(result.educationMessage).toContain('完成三階段');
    expect(result.educationReminders.map((card) => card.topic)).toEqual([
      'training',
      'injury',
      'nutrition',
    ]);
    expect(result.educationFocusTopic).toBe('nutrition');
    expect(result.educationSafetyAlert.message).toContain('緊急醫療');
  });
});

describe('進度與本機最高分', () => {
  it('每 10 秒提升難度與基礎速度', () => {
    const progress = advanceProgress(createInitialProgress(), 10);

    expect(progress.difficultyLevel).toBe(2);
    expect(progress.speed).toBeCloseTo(315);
    expect(progress.distanceMeters).toBeCloseTo(180);
  });

  it('速度倍率會一致影響即時速度、距離與距離分數', () => {
    const baseline = advanceProgress(createInitialProgress(), 5);
    const interval = advanceProgress(
      createInitialProgress(),
      5,
      0,
      GAME_CONFIG,
      GAME_CONFIG.paceModes.interval.speedMultiplier,
    );

    expect(interval.speed).toBeCloseTo(
      baseline.speed * GAME_CONFIG.paceModes.interval.speedMultiplier,
    );
    expect(interval.distanceMeters).toBeCloseTo(
      baseline.distanceMeters * GAME_CONFIG.paceModes.interval.speedMultiplier,
    );
    expect(interval.score).toBe(Math.floor(interval.distanceMeters * GAME_CONFIG.scorePerMeter));
  });

  it('只保留較高的分數', () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    };

    expect(updateHighScore(120, storage)).toBe(120);
    expect(updateHighScore(80, storage)).toBe(120);
    expect(readHighScore(storage)).toBe(120);
  });
});

describe('繁體中文標籤', () => {
  it('使用指定的三關、阻力訓練與身體不適標籤', () => {
    expect(MARATHON_STAGE_LABELS).toEqual({
      base: '基礎期',
      build: '進階期',
      race: '正式比賽',
    });
    expect(MARATHON_STAGE_ENTRY_COPY).toEqual({
      base: {
        title: '基礎期',
        subtitle: '建立穩定跑量與訓練習慣',
      },
      build: {
        title: '進階期',
        subtitle: '提升訓練刺激，也顧好恢復',
      },
      race: {
        title: '開始比賽',
        subtitle: '穩住配速，向終點前進',
      },
    });
    expect(RECOVERY_ITEM_LABELS.strength).toBe('阻力訓練');
    expect(OBSTACLE_LABELS.illness).toBe('生病／身體不適');
    expect(OBSTACLE_VISUAL_LABELS).toEqual({
      illness: '生病',
      sportsInjury: '受傷',
      overtraining: '過訓',
    });
  });
});
