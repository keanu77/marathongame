import { GAME_CONFIG, MARATHON_CONFIG } from '../config';
import { MARATHON_STAGE_IDS, OBSTACLE_TYPES, RECOVERY_ITEM_TYPES } from '../types';
import {
  applySpawnDelayMultiplier,
  calculateObstacleSpawnDelayMs,
  getItemSpawnPool,
  getObstacleSpawnPool,
  isSpawnLaneClear,
} from './spawnRules';

describe('生成安全規則', () => {
  it('生成延遲同時遵守時間與最小中心距離', () => {
    const delay = calculateObstacleSpawnDelayMs({
      speed: 1_000,
      sampledDelayMs: 100,
      minimumDelayMs: 200,
      minimumGapPixels: 350,
    });

    expect(delay).toBe(350);
    expect((1_000 * delay) / 1_000).toBeGreaterThanOrEqual(350);
  });

  it('現有隨機延遲較長時不會被安全公式縮短', () => {
    expect(
      calculateObstacleSpawnDelayMs({
        speed: 300,
        sampledDelayMs: 2_400,
        minimumDelayMs: 1_700,
        minimumGapPixels: 290,
      }),
    ).toBe(2_400);
  });

  it('關卡延遲倍率會縮放時間，但最小安全距離仍有最高優先權', () => {
    const stageDelays = MARATHON_STAGE_IDS.map((stageId) => {
      const stage = MARATHON_CONFIG.stages.find((candidate) => candidate.id === stageId);
      if (!stage) throw new Error(`missing stage ${stageId}`);

      const delayMs = calculateObstacleSpawnDelayMs({
        speed: GAME_CONFIG.maximumSpeed,
        sampledDelayMs: 2_400,
        minimumDelayMs: GAME_CONFIG.obstacleSpawnMinSeconds * 1_000,
        minimumGapPixels: GAME_CONFIG.minimumObstacleGapPixels,
        delayMultiplier: stage.obstacleSpawnDelayMultiplier,
      });

      expect((GAME_CONFIG.maximumSpeed * delayMs) / 1_000).toBeGreaterThanOrEqual(
        GAME_CONFIG.minimumObstacleGapPixels,
      );
      return delayMs;
    });

    expect(stageDelays[0]).toBeGreaterThan(stageDelays[1] ?? 0);
    expect(stageDelays[1]).toBeGreaterThan(stageDelays[2] ?? 0);
    expect(applySpawnDelayMultiplier(2_000, 0.5)).toBe(1_000);
    expect(applySpawnDelayMultiplier(2_000, Number.NaN)).toBe(2_000);
    expect(applySpawnDelayMultiplier(2_000, -1)).toBe(2_000);
  });

  it('生成點邊界採保守判定且拒絕非有限座標', () => {
    expect(isSpawnLaneClear([479.9], 630, 150)).toBe(true);
    expect(isSpawnLaneClear([480], 630, 150)).toBe(false);
    expect(isSpawnLaneClear([Number.NaN], 630, 150)).toBe(false);
  });

  it('馬拉松三關提供非空且只含合法型別的生成 pool', () => {
    for (const stageId of MARATHON_STAGE_IDS) {
      const obstaclePool = getObstacleSpawnPool(stageId);
      const itemPool = getItemSpawnPool(stageId);

      expect(obstaclePool.length).toBeGreaterThan(0);
      expect(itemPool.length).toBeGreaterThan(0);
      expect(obstaclePool.every((type) => OBSTACLE_TYPES.includes(type))).toBe(true);
      expect(itemPool.every((type) => RECOVERY_ITEM_TYPES.includes(type))).toBe(true);
    }

    expect(getObstacleSpawnPool('base')).toEqual(['illness']);
    expect(getObstacleSpawnPool('build')).toEqual(['illness', 'overtraining']);
    expect(getObstacleSpawnPool('race')).toEqual(['illness', 'sportsInjury', 'overtraining']);
    expect(getItemSpawnPool('base')).toEqual(['sleep', 'strength', 'nutrition', 'zone2']);
    expect(getItemSpawnPool('build')).toEqual([
      'sleep',
      'strength',
      'nutrition',
      'zone2',
      'lsd',
      'interval',
    ]);
    expect(getItemSpawnPool('race')).toEqual(getItemSpawnPool('build'));
  });

  it('關卡可覆寫 pool，並可以用空 pool 暫停該關生成', () => {
    expect(
      getObstacleSpawnPool('build', {
        build: ['illness'],
      }),
    ).toEqual(['illness']);
    expect(
      getItemSpawnPool('race', {
        race: [],
      }),
    ).toEqual([]);
  });

  it('首個障礙晚於教學提示結束，首個恢復道具更早出現', () => {
    const tutorialEndMs = GAME_CONFIG.tutorialDelayMs + GAME_CONFIG.tutorialFadeDurationMs;
    const firstObstacleMs = GAME_CONFIG.firstObstacleSpawnDelaySeconds * 1_000;
    const firstRecoveryMs = GAME_CONFIG.firstRecoverySpawnDelaySeconds * 1_000;

    expect(firstObstacleMs).toBeGreaterThanOrEqual(tutorialEndMs);
    expect(firstRecoveryMs).toBeLessThan(firstObstacleMs);
  });
});
