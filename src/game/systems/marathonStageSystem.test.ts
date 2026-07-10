import { GAME_CONFIG, MARATHON_CONFIG } from '../config';
import {
  advanceMarathonRunState,
  applyMarathonObstacleImpact,
  applyMarathonRecoveryItem,
  applyRecoveryItem,
  createInitialMarathonRunState,
  createInitialStatusEffects,
  determineMarathonOutcome,
  getMarathonEffectiveSpeedMultiplier,
  getMarathonStageSnapshot,
  getMarathonTotalDurationSeconds,
} from './index';

describe('三階段馬拉松設定', () => {
  it('三關合計 80 秒，並集中保存官方距離與終點門提前量', () => {
    expect(MARATHON_CONFIG.stages.map((stage) => stage.durationSeconds)).toEqual([25, 30, 25]);
    expect(getMarathonTotalDurationSeconds()).toBe(80);
    expect(MARATHON_CONFIG.officialDistanceMeters).toBe(42_195);
    expect(MARATHON_CONFIG.finishGateLeadSeconds).toBe(1.6);
    expect(GAME_CONFIG.stageTransitionDurationMs).toBe(1_800);
    expect(GAME_CONFIG.finishGateSpawnOffsetPixels).toBe(100);
  });

  it('難度倍率由友善基礎期逐步提高，恢復資源則逐步收緊', () => {
    const [base, build, race] = MARATHON_CONFIG.stages;

    expect(base.obstacleSpawnDelayMultiplier).toBeGreaterThan(build.obstacleSpawnDelayMultiplier);
    expect(build.obstacleSpawnDelayMultiplier).toBeGreaterThan(race.obstacleSpawnDelayMultiplier);
    expect(base.obstacleDamageMultiplier).toBeLessThan(build.obstacleDamageMultiplier);
    expect(build.obstacleDamageMultiplier).toBeLessThan(race.obstacleDamageMultiplier);
    expect(base.recoverySpawnDelayMultiplier).toBeLessThan(build.recoverySpawnDelayMultiplier);
    expect(build.recoverySpawnDelayMultiplier).toBeLessThan(race.recoverySpawnDelayMultiplier);
    expect(base.recoveryEffectMultiplier).toBeGreaterThan(race.recoveryEffectMultiplier);
  });

  it.each([
    [0, 'base', 0, 0, false, 'build'],
    [24.5, 'base', 0, 24.5 / 80, false, 'build'],
    [25, 'build', 1, 25 / 80, false, 'race'],
    [55, 'race', 2, 55 / 80, false, null],
    [80, 'race', 2, 1, true, null],
  ] as const)(
    '%s 秒可解析正確關卡與總進度',
    (elapsedSeconds, stageId, stageIndex, overallProgress, isComplete, nextStageId) => {
      const snapshot = getMarathonStageSnapshot(elapsedSeconds);

      expect(snapshot.stageId).toBe(stageId);
      expect(snapshot.stageIndex).toBe(stageIndex);
      expect(snapshot.overallProgress).toBeCloseTo(overallProgress);
      expect(snapshot.isComplete).toBe(isComplete);
      expect(snapshot.nextStageId).toBe(nextStageId);
    },
  );

  it('負數與非有限時間不會產生非法進度', () => {
    expect(getMarathonStageSnapshot(-5).overallProgress).toBe(0);
    expect(getMarathonStageSnapshot(Number.NaN).overallProgress).toBe(0);
    expect(getMarathonStageSnapshot(Number.POSITIVE_INFINITY).overallProgress).toBe(0);
  });
});

describe('配速與階段推進', () => {
  it('關卡包裝函式會套用傷害與數值恢復倍率', () => {
    const effects = createInitialStatusEffects();
    const baseHit = applyMarathonObstacleImpact(
      { energy: 100, injuryRisk: 0 },
      effects,
      'illness',
      'base',
    );
    const raceHit = applyMarathonObstacleImpact(
      { energy: 100, injuryRisk: 0 },
      effects,
      'illness',
      'race',
    );
    const baseRecovery = applyMarathonRecoveryItem(
      { energy: 50, injuryRisk: 20 },
      effects,
      'nutrition',
      'base',
    );
    const raceRecovery = applyMarathonRecoveryItem(
      { energy: 50, injuryRisk: 20 },
      effects,
      'nutrition',
      'race',
    );

    expect(baseHit.energyDamage).toBeCloseTo(
      GAME_CONFIG.illnessEnergyDamage * MARATHON_CONFIG.stages[0].obstacleDamageMultiplier,
    );
    expect(raceHit.energyDamage).toBeCloseTo(
      GAME_CONFIG.illnessEnergyDamage * MARATHON_CONFIG.stages[2].obstacleDamageMultiplier,
    );
    expect(baseRecovery.energyRecovered).toBeCloseTo(
      GAME_CONFIG.nutritionEnergyRecovery * MARATHON_CONFIG.stages[0].recoveryEffectMultiplier,
    );
    expect(raceRecovery.energyRecovered).toBeCloseTo(
      GAME_CONFIG.nutritionEnergyRecovery * MARATHON_CONFIG.stages[2].recoveryEffectMultiplier,
    );
  });

  it('有效速度倍率會合併關卡與互斥配速模式', () => {
    const zone2 = applyRecoveryItem(
      { energy: 100, injuryRisk: 0 },
      createInitialStatusEffects(),
      'zone2',
    );
    const interval = applyRecoveryItem(zone2.vitals, zone2.statusEffects, 'interval');

    expect(getMarathonEffectiveSpeedMultiplier('base', zone2.statusEffects)).toBeCloseTo(
      MARATHON_CONFIG.stages[0].speedMultiplier * GAME_CONFIG.paceModes.zone2.speedMultiplier,
    );
    expect(getMarathonEffectiveSpeedMultiplier('race', interval.statusEffects)).toBeCloseTo(
      MARATHON_CONFIG.stages[2].speedMultiplier * GAME_CONFIG.paceModes.interval.speedMultiplier,
    );
    expect(interval.statusEffects.paceMode).toBe('interval');
  });

  it('一次跨越三關時依各關耗能率分段計算並完成賽事', () => {
    const result = advanceMarathonRunState(createInitialMarathonRunState(), 80);
    const expectedEnergy =
      GAME_CONFIG.initialEnergy -
      MARATHON_CONFIG.stages.reduce(
        (total, stage) => total + stage.durationSeconds * stage.energyDrainPerSecond,
        0,
      );

    expect(result.elapsedSeconds).toBe(80);
    expect(result.vitals.energy).toBeCloseTo(expectedEnergy);
    expect(result.stage.stageId).toBe('race');
    expect(result.stage.isComplete).toBe(true);
    expect(result.outcome).toEqual({ status: 'finished', reason: 'completedAllStages' });
  });

  it('配速到期前後會使用不同耗能倍率', () => {
    const initial = createInitialMarathonRunState();
    const zone2 = applyRecoveryItem(initial.vitals, initial.statusEffects, 'zone2');
    const state = {
      ...initial,
      vitals: zone2.vitals,
      statusEffects: zone2.statusEffects,
    };
    const result = advanceMarathonRunState(state, 10);
    const baseDrain = MARATHON_CONFIG.stages[0].energyDrainPerSecond;
    const expectedDrain =
      baseDrain *
      (GAME_CONFIG.paceModes.zone2.durationSeconds *
        GAME_CONFIG.paceModes.zone2.energyDrainMultiplier +
        (10 - GAME_CONFIG.paceModes.zone2.durationSeconds));

    expect(result.vitals.energy).toBeCloseTo(GAME_CONFIG.initialEnergy - expectedDrain);
    expect(result.statusEffects.paceMode).toBeNull();
    expect(result.statusEffects.paceRemainingSeconds).toBe(0);
  });
});

describe('完賽與中途停止', () => {
  it('體力先耗盡時停在實際耗盡秒數，不會繼續推進', () => {
    const initial = createInitialMarathonRunState();
    const state = {
      ...initial,
      vitals: { ...initial.vitals, energy: 1 },
    };
    const result = advanceMarathonRunState(state, 20);

    expect(result.elapsedSeconds).toBeCloseTo(1 / MARATHON_CONFIG.stages[0].energyDrainPerSecond);
    expect(result.vitals.energy).toBe(0);
    expect(result.outcome).toEqual({ status: 'didNotFinish', reason: 'energyDepleted' });
  });

  it('受傷風險達上限時判定中途停止', () => {
    expect(determineMarathonOutcome({ energy: 80, injuryRisk: 100 }, 10)).toEqual({
      status: 'didNotFinish',
      reason: 'injuryRiskMaxed',
    });
  });

  it('已完賽或中途停止的狀態不會再次被推進', () => {
    const finished = advanceMarathonRunState(createInitialMarathonRunState(), 80);
    expect(advanceMarathonRunState(finished, 10)).toBe(finished);

    const stopped = {
      ...createInitialMarathonRunState(),
      outcome: { status: 'didNotFinish', reason: 'injuryRiskMaxed' } as const,
    };
    expect(advanceMarathonRunState(stopped, 10)).toBe(stopped);
  });

  it('若同時到達終點與耗盡門檻，安全停止條件優先', () => {
    expect(determineMarathonOutcome({ energy: 0, injuryRisk: 0 }, 80)).toEqual({
      status: 'didNotFinish',
      reason: 'energyDepleted',
    });
  });
});
