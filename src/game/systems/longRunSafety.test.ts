import { GAME_CONFIG } from '../config';
import type { GameStatusEffects, Vitals } from '../types';
import {
  advanceProgress,
  advanceStatusEffects,
  applyObstacleImpact,
  applyPassiveEnergyDrain,
  applyRecoveryItem,
  createInitialProgress,
  createInitialStatusEffects,
  createInitialVitals,
  getSpeedForElapsedSeconds,
} from './index';

describe('長局穩定性', () => {
  it('15 分鐘分段推進保持有限、單調且不產生距離漂移', () => {
    const durationSeconds = 15 * 60;
    const stepSeconds = 0.25;
    let stepped = createInitialProgress();

    for (let elapsed = 0; elapsed < durationSeconds; elapsed += stepSeconds) {
      const next = advanceProgress(stepped, stepSeconds);
      expect(next.speed).toBeGreaterThanOrEqual(stepped.speed);
      expect(next.speed).toBeLessThanOrEqual(GAME_CONFIG.maximumSpeed);
      expect(Number.isFinite(next.speed)).toBe(true);
      expect(Number.isFinite(next.distanceMeters)).toBe(true);
      stepped = next;
    }

    const singleStep = advanceProgress(createInitialProgress(), durationSeconds);
    expect(stepped.difficultyLevel).toBe(GAME_CONFIG.maximumDifficultyLevel);
    expect(stepped.speed).toBeCloseTo(singleStep.speed, 8);
    expect(stepped.distanceMeters).toBeCloseTo(singleStep.distanceMeters, 5);
  });

  it('所有難度下的最小生成時間都保留完整跳躍窗口', () => {
    const nominalJumpSeconds = (2 * Math.abs(GAME_CONFIG.jumpVelocity)) / GAME_CONFIG.gravityY;
    expect(GAME_CONFIG.obstacleSpawnMinSeconds).toBeGreaterThan(nominalJumpSeconds);

    for (let elapsed = 0; elapsed <= 15 * 60; elapsed += 1) {
      const speed = getSpeedForElapsedSeconds(elapsed);
      const minimumDistance = speed * GAME_CONFIG.obstacleSpawnMinSeconds;
      expect(minimumDistance).toBeGreaterThanOrEqual(GAME_CONFIG.minimumObstacleGapPixels);
    }
  });

  it('最高速度在低更新率下仍小於玩家與最窄障礙的碰撞寬度', () => {
    const targetMinimumFps = 20;
    const narrowestObstacleWidth = GAME_CONFIG.roadSignWidth;
    const overlapWindow = (GAME_CONFIG.playerWidth + narrowestObstacleWidth) / 2;
    const maximumTravelPerStep = GAME_CONFIG.maximumSpeed / targetMinimumFps;

    expect(maximumTravelPerStep).toBeLessThan(overlapWindow);
    expect(getSpeedForElapsedSeconds(60 * 60)).toBe(GAME_CONFIG.maximumSpeed);
  });

  it('路標高度保留明確跳躍淨空', () => {
    const maximumJumpHeight =
      Math.pow(Math.abs(GAME_CONFIG.jumpVelocity), 2) / (2 * GAME_CONFIG.gravityY);

    expect(maximumJumpHeight - GAME_CONFIG.roadSignHeight).toBeGreaterThanOrEqual(40);
  });

  it('反覆套用傷害、恢復與狀態後仍維持有限且合法的上下限', () => {
    let vitals: Vitals = createInitialVitals();
    let effects: GameStatusEffects = createInitialStatusEffects();
    const obstacleSequence = ['illness', 'sportsInjury', 'overtraining'] as const;
    const recoverySequence = [
      'sleep',
      'strength',
      'nutrition',
      'zone2',
      'lsd',
      'interval',
    ] as const;

    for (let step = 0; step < 3_600; step += 1) {
      const obstacle = applyObstacleImpact(
        vitals,
        effects,
        obstacleSequence[step % obstacleSequence.length],
      );
      vitals = obstacle.vitals;
      effects = obstacle.statusEffects;

      const recovery = applyRecoveryItem(
        vitals,
        effects,
        recoverySequence[step % recoverySequence.length],
      );
      vitals = applyPassiveEnergyDrain(recovery.vitals, 0.25, recovery.statusEffects);
      effects = recovery.statusEffects;

      const advanced = advanceStatusEffects(vitals, effects, 0.25);
      vitals = advanced.vitals;
      effects = advanced.statusEffects;

      expect(Number.isFinite(vitals.energy)).toBe(true);
      expect(Number.isFinite(vitals.injuryRisk)).toBe(true);
      expect(vitals.energy).toBeGreaterThanOrEqual(GAME_CONFIG.minEnergy);
      expect(vitals.energy).toBeLessThanOrEqual(GAME_CONFIG.maxEnergy);
      expect(vitals.injuryRisk).toBeGreaterThanOrEqual(GAME_CONFIG.minInjuryRisk);
      expect(vitals.injuryRisk).toBeLessThanOrEqual(GAME_CONFIG.maxInjuryRisk);
      expect(Number.isFinite(effects.recoveryDeficitRemainingSeconds)).toBe(true);
      expect(effects.recoveryDeficitRemainingSeconds).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(effects.strengthProtectionRemainingSeconds)).toBe(true);
      expect(effects.strengthProtectionRemainingSeconds).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(effects.paceRemainingSeconds)).toBe(true);
      expect(effects.paceRemainingSeconds).toBeGreaterThanOrEqual(0);
      expect([null, 'zone2', 'lsd', 'interval']).toContain(effects.paceMode);
    }
  }, 15_000);
});
