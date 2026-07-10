export {
  advanceStatusEffects,
  applyObstacleImpact,
  applyPassiveEnergyDrain,
  applyRecoveryItem,
  clampVitals,
  createInitialStatusEffects,
  createInitialVitals,
  getEnergyDrainMultiplier,
  getPaceSpeedMultiplier,
  normalizeStatusEffects,
} from './vitalsSystem';
export {
  createObstacleImpactCounts,
  getDominantObstacle,
  recordObstacleImpact,
} from './obstacleImpactSystem';
export {
  advanceProgress,
  calculateScore,
  createInitialProgress,
  getDifficultyLevel,
  getSpeedForElapsedSeconds,
} from './progressSystem';
export { createGameOverResult, determineGameOverReason } from './gameOverSystem';
export type { CreateGameOverResultInput } from './gameOverSystem';
export { readHighScore, updateHighScore, writeHighScore } from './highScoreStorage';
export {
  addLeaderboardEntry,
  getLeaderboardRank,
  normalizeLeaderboardName,
  rankLeaderboardEntries,
  readLeaderboard,
} from './leaderboardStorage';
export type { LeaderboardEntryFactory } from './leaderboardStorage';
export {
  calculateObstacleSpawnDelayMs,
  applySpawnDelayMultiplier,
  getItemSpawnPool,
  getObstacleSpawnPool,
  isSpawnLaneClear,
  MARATHON_ITEM_POOLS,
  MARATHON_OBSTACLE_POOLS,
  resolveStageSpawnPool,
} from './spawnRules';
export type { SpawnDelayInput, StageSpawnPoolOverrides, StageSpawnPools } from './spawnRules';
export {
  advanceMarathonRunState,
  applyMarathonObstacleImpact,
  applyMarathonRecoveryItem,
  createInitialMarathonRunState,
  determineMarathonOutcome,
  getMarathonEffectiveSpeedMultiplier,
  getMarathonStageConfig,
  getMarathonStageSnapshot,
  getMarathonStageSpeedMultiplier,
  getMarathonTotalDurationSeconds,
} from './marathonStageSystem';
