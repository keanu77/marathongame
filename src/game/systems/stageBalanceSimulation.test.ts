import { GAME_CONFIG, MARATHON_CONFIG } from '../config';
import type { MarathonRunState, MarathonStageId } from '../types';
import {
  advanceMarathonRunState,
  applyMarathonObstacleImpact,
  applyMarathonRecoveryItem,
  createInitialMarathonRunState,
  determineMarathonOutcome,
  getItemSpawnPool,
  getMarathonStageConfig,
  getObstacleSpawnPool,
} from './index';

interface PlayerModel {
  missRate: number;
  collectionRate: number;
}

interface SimulatedRun {
  reachedBuild: boolean;
  reachedRace: boolean;
  completed: boolean;
}

const MODEL = {
  players: 2_000,
  stepSeconds: 0.25,
  // 以單一「操作挑戰度」建立相關分布：較常漏跳者也較常漏接道具。
  minimumMissRate: 0.15,
  missRateRange: 0.4,
  maximumCollectionRate: 0.8,
  collectionRateRange: 0.4,
  stageMissMultipliers: { base: 0.75, build: 1, race: 1.2 },
  stageCollectionMultipliers: { base: 1.05, build: 1, race: 0.9 },
} as const satisfies {
  players: number;
  stepSeconds: number;
  minimumMissRate: number;
  missRateRange: number;
  maximumCollectionRate: number;
  collectionRateRange: number;
  stageMissMultipliers: Readonly<Record<MarathonStageId, number>>;
  stageCollectionMultipliers: Readonly<Record<MarathonStageId, number>>;
};

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function clampProbability(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function sampleBetween(random: () => number, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * random();
}

function samplePlayer(random: () => number): PlayerModel {
  const challenge = random();
  return {
    missRate: MODEL.minimumMissRate + MODEL.missRateRange * challenge,
    collectionRate: MODEL.maximumCollectionRate - MODEL.collectionRateRange * challenge,
  };
}

function getFirstObstacleDelay(stageId: MarathonStageId): number {
  return (
    GAME_CONFIG.firstObstacleSpawnDelaySeconds *
    getMarathonStageConfig(stageId).obstacleSpawnDelayMultiplier
  );
}

function getFirstItemDelay(stageId: MarathonStageId): number {
  return (
    GAME_CONFIG.firstRecoverySpawnDelaySeconds *
    getMarathonStageConfig(stageId).recoverySpawnDelayMultiplier
  );
}

function sampleObstacleDelay(random: () => number, stageId: MarathonStageId): number {
  return (
    sampleBetween(
      random,
      GAME_CONFIG.obstacleSpawnMinSeconds,
      GAME_CONFIG.obstacleSpawnMaxSeconds,
    ) * getMarathonStageConfig(stageId).obstacleSpawnDelayMultiplier
  );
}

function sampleItemDelay(random: () => number, stageId: MarathonStageId): number {
  return (
    sampleBetween(
      random,
      GAME_CONFIG.recoverySpawnMinSeconds,
      GAME_CONFIG.recoverySpawnMaxSeconds,
    ) * getMarathonStageConfig(stageId).recoverySpawnDelayMultiplier
  );
}

function refreshOutcome(state: MarathonRunState): MarathonRunState {
  return {
    ...state,
    outcome: determineMarathonOutcome(state.vitals, state.elapsedSeconds),
  };
}

/**
 * 簡化模型假設每個生成機會直接成為一次反應／收集判定，未模擬像素路徑、
 * 手機延遲或真人學習。這是固定 seed 的遊戲平衡煙霧測試，不是真實玩家數據、
 * 醫療風險模型或對玩家成功率的承諾。
 */
function simulateRun(random: () => number, player: PlayerModel): SimulatedRun {
  let state = createInitialMarathonRunState();
  let stageId = state.stage.stageId;
  let nextObstacleSeconds = getFirstObstacleDelay(stageId);
  let nextItemSeconds = getFirstItemDelay(stageId);
  let isFirstItemInStage = true;
  let reachedBuild = false;
  let reachedRace = false;

  while (state.outcome.status === 'inProgress') {
    const previousStageId = stageId;
    state = advanceMarathonRunState(state, MODEL.stepSeconds);
    stageId = state.stage.stageId;

    if (stageId !== previousStageId) {
      reachedBuild ||= state.stage.stageIndex >= 1;
      reachedRace ||= state.stage.stageIndex >= 2;
      nextObstacleSeconds = getFirstObstacleDelay(stageId);
      nextItemSeconds = getFirstItemDelay(stageId);
      isFirstItemInStage = true;
      continue;
    }

    if (state.outcome.status !== 'inProgress') break;

    nextObstacleSeconds -= MODEL.stepSeconds;
    nextItemSeconds -= MODEL.stepSeconds;

    // 正式遊戲在終點門出現後停止生成，模擬採用同一提前量。
    const finishApproach =
      stageId === 'race' &&
      state.stage.totalRemainingSeconds <= MARATHON_CONFIG.finishGateLeadSeconds;

    if (!finishApproach && nextObstacleSeconds <= 0) {
      nextObstacleSeconds = sampleObstacleDelay(random, stageId);
      const missProbability = clampProbability(
        player.missRate * MODEL.stageMissMultipliers[stageId],
      );

      if (random() < missProbability) {
        const pool = getObstacleSpawnPool(stageId);
        const type = pool[Math.floor(random() * pool.length)];
        if (!type) throw new Error(`empty obstacle pool for ${stageId}`);

        const impact = applyMarathonObstacleImpact(
          state.vitals,
          state.statusEffects,
          type,
          stageId,
        );
        state = refreshOutcome({
          ...state,
          vitals: impact.vitals,
          statusEffects: impact.statusEffects,
        });
      }
    }

    if (!finishApproach && state.outcome.status === 'inProgress' && nextItemSeconds <= 0) {
      nextItemSeconds = sampleItemDelay(random, stageId);
      const collectionProbability = clampProbability(
        player.collectionRate * MODEL.stageCollectionMultipliers[stageId],
      );

      if (random() < collectionProbability) {
        const pool = getItemSpawnPool(stageId);
        const type = isFirstItemInStage
          ? GAME_CONFIG.firstRecoveryItemType
          : pool[Math.floor(random() * pool.length)];
        if (!type || !pool.includes(type)) throw new Error(`empty item pool for ${stageId}`);

        const recovery = applyMarathonRecoveryItem(
          state.vitals,
          state.statusEffects,
          type,
          stageId,
        );
        state = {
          ...state,
          vitals: recovery.vitals,
          statusEffects: recovery.statusEffects,
        };
      }

      isFirstItemInStage = false;
    }
  }

  return {
    reachedBuild,
    reachedRace,
    completed: state.outcome.status === 'finished',
  };
}

describe('固定 seed 的三關平衡假設模型', () => {
  it('友善基礎期讓多數模型玩家進入進階期，且約三至五成完成正式比賽', () => {
    const random = createSeededRandom(0x5eed2026);
    let reachedBuildCount = 0;
    let reachedRaceCount = 0;
    let completedCount = 0;

    for (let index = 0; index < MODEL.players; index += 1) {
      const result = simulateRun(random, samplePlayer(random));
      if (result.reachedBuild) reachedBuildCount += 1;
      if (result.reachedRace) reachedRaceCount += 1;
      if (result.completed) completedCount += 1;
    }

    const reachedBuildRate = reachedBuildCount / MODEL.players;
    const reachedRaceRate = reachedRaceCount / MODEL.players;
    const completionRate = completedCount / MODEL.players;

    expect(reachedBuildRate).toBeGreaterThan(0.7);
    expect(reachedRaceRate).toBeGreaterThan(completionRate);
    expect(completionRate).toBeGreaterThanOrEqual(0.3);
    expect(completionRate).toBeLessThanOrEqual(0.5);
  }, 15_000);
});
