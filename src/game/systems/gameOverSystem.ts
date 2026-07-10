import { GAME_CONFIG, type GameConfig } from '../config';
import { selectEducationMessage } from '../data';
import type {
  GameOverReason,
  GameOverResult,
  MarathonStageId,
  ObstacleType,
  Vitals,
} from '../types';

export function determineGameOverReason(
  vitals: Vitals,
  config: GameConfig = GAME_CONFIG,
): GameOverReason | null {
  if (vitals.energy <= config.minEnergy) return 'energyDepleted';
  if (vitals.injuryRisk >= config.maxInjuryRisk) return 'injuryRiskMaxed';
  return null;
}

export interface CreateGameOverResultInput {
  reason: GameOverReason | null;
  outcome?: 'completed' | 'stopped';
  stageId?: MarathonStageId;
  stageIndex?: number;
  overallProgress?: number;
  dominantObstacle: ObstacleType | null;
  distanceMeters: number;
  score: number;
  highScore: number;
  isNewHighScore: boolean;
}

function normalizeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function createGameOverResult({
  reason,
  outcome = reason === null ? 'completed' : 'stopped',
  stageId = 'race',
  stageIndex = 2,
  overallProgress = outcome === 'completed' ? 1 : 0,
  dominantObstacle,
  distanceMeters,
  score,
  highScore,
  isNewHighScore,
}: CreateGameOverResultInput): GameOverResult {
  const educationMessage = selectEducationMessage({
    dominantObstacle,
    gameOverReason: reason,
    outcome,
  });

  return {
    outcome,
    reason,
    stageId,
    stageIndex: Math.floor(normalizeNonNegative(stageIndex)),
    overallProgress: Math.min(1, normalizeNonNegative(overallProgress)),
    dominantObstacle,
    distanceMeters: Math.round(normalizeNonNegative(distanceMeters)),
    score: Math.floor(normalizeNonNegative(score)),
    highScore: Math.floor(normalizeNonNegative(highScore)),
    isNewHighScore,
    educationMessage: educationMessage.text,
    educationAction: educationMessage.action,
  };
}
