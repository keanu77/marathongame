import { GAME_CONFIG, type GameConfig } from '../config';
import type { RunKnowledgeItem } from '../../shared/education';
import {
  EDUCATION_SAFETY_ALERT,
  selectEducationFocusTopic,
  selectEducationMessage,
  selectEducationReminders,
} from '../data';
import type {
  GameOverReason,
  GameOverResult,
  MarathonStageId,
  ObstacleType,
  Vitals,
} from '../types';
import { normalizeRunKnowledgeReview } from './educationReviewSystem';

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
  finalEnergy?: number;
  finalInjuryRisk?: number;
  healthBonus?: number;
  finishQualityIndex?: number;
  elapsedSeconds?: number;
  collectedRecoveryItems?: number;
  knowledgeReview?: readonly RunKnowledgeItem[];
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
  finalEnergy,
  finalInjuryRisk,
  healthBonus = 0,
  finishQualityIndex = 0,
  elapsedSeconds = 0,
  collectedRecoveryItems = 0,
  knowledgeReview = [],
  highScore,
  isNewHighScore,
}: CreateGameOverResultInput): GameOverResult {
  const normalizedFinalEnergy = Math.min(
    GAME_CONFIG.maxEnergy,
    normalizeNonNegative(finalEnergy ?? (outcome === 'completed' ? GAME_CONFIG.maxEnergy : 0)),
  );
  const normalizedFinalInjuryRisk = Math.min(
    GAME_CONFIG.maxInjuryRisk,
    normalizeNonNegative(
      finalInjuryRisk ?? (outcome === 'completed' ? GAME_CONFIG.minInjuryRisk : 100),
    ),
  );
  const educationMessage = selectEducationMessage({
    dominantObstacle,
    gameOverReason: reason,
    outcome,
  });
  const reminderSelection = {
    dominantObstacle,
    gameOverReason: reason,
    outcome,
    stageId,
    collectedRecoveryItems: Math.floor(normalizeNonNegative(collectedRecoveryItems)),
  } as const;
  const educationReminders = selectEducationReminders(reminderSelection);

  return {
    outcome,
    reason,
    stageId,
    stageIndex: Math.floor(normalizeNonNegative(stageIndex)),
    overallProgress: Math.min(1, normalizeNonNegative(overallProgress)),
    dominantObstacle,
    distanceMeters: Math.round(normalizeNonNegative(distanceMeters)),
    score: Math.floor(normalizeNonNegative(score)),
    finalEnergy: normalizedFinalEnergy,
    finalInjuryRisk: normalizedFinalInjuryRisk,
    healthBonus: Math.floor(normalizeNonNegative(healthBonus)),
    finishQualityIndex: Math.min(100, Math.round(normalizeNonNegative(finishQualityIndex))),
    elapsedSeconds: normalizeNonNegative(elapsedSeconds),
    collectedRecoveryItems: Math.floor(normalizeNonNegative(collectedRecoveryItems)),
    highScore: Math.floor(normalizeNonNegative(highScore)),
    isNewHighScore,
    educationMessage: educationMessage.text,
    educationAction: educationMessage.action,
    educationReminders,
    educationFocusTopic: selectEducationFocusTopic(reminderSelection),
    educationSafetyAlert: EDUCATION_SAFETY_ALERT,
    knowledgeReview: normalizeRunKnowledgeReview(knowledgeReview),
  };
}
