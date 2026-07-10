import type { EducationMessage, GameOverReason, ObstacleType, RecoveryItemType } from '../types';

export const EDUCATION_MESSAGES = [
  {
    id: 1,
    text: '身體不適時，恢復通常比完成原定課表更重要。',
    action: '若症狀持續、惡化或影響日常活動，暫停運動並尋求合格醫療專業人員評估。',
  },
  {
    id: 2,
    text: '疼痛、腫脹或功能下降時，不應只靠意志力繼續訓練。',
    action: '先停止造成症狀的活動；若症狀明顯、持續或惡化，尋求合格醫療專業人員評估。',
  },
  {
    id: 3,
    text: '持續疲勞與表現下降可能反映恢復不足，不能只看單次課表。',
    action: '先降低訓練負荷並安排恢復；若狀況持續，尋求合格專業人員協助。',
  },
  {
    id: 4,
    text: '睡眠與休息是訓練適應的一部分。',
    action: '把睡眠與恢復日排進計畫，疲勞明顯時避免勉強完成高強度課表。',
  },
  {
    id: 5,
    text: '阻力訓練可作為跑步訓練的輔助，但仍應循序增加。',
    action: '先重視動作品質與可控制的負荷，再逐步調整訓練量。',
  },
  {
    id: 6,
    text: '營養與補給需求會受運動時間、環境與個人狀況影響。',
    action: '長時間運動前先準備補給，並依實際時間、天氣與身體反應調整。',
  },
  {
    id: 7,
    text: 'Zone 2 在本活動中代表較保守、較省能的遊戲配速。',
    action: '真實訓練強度不應只靠遊戲數值判定；可搭配談話感受或專業建議調整。',
  },
  {
    id: 8,
    text: '長距離慢跑重點在可持續完成，不必每次追求最快速度。',
    action: '先建立能穩定完成的時間與距離，再小幅增加其中一項。',
  },
  {
    id: 9,
    text: '間歇訓練能提高速度刺激，但也會增加當次訓練成本。',
    action: '高強度課表之間保留恢復，身體不適或疼痛加重時不要勉強進行。',
  },
  {
    id: 10,
    text: '本活動只供娛樂與一般衛教，不代表個人化配速或醫療評估。',
    action: '若有持續或惡化的症狀，請尋求合格醫療專業人員評估。',
  },
  {
    id: 11,
    text: '完成三階段不代表每次訓練都要全力；穩定與恢復同樣重要。',
    action: '完成後安排恢復，下一次再依當天狀況循序調整時間、距離或強度。',
  },
] as const satisfies readonly EducationMessage[];

const EDUCATION_BY_OBSTACLE: Record<ObstacleType, number> = {
  illness: 1,
  sportsInjury: 2,
  overtraining: 3,
};

const EDUCATION_BY_RECOVERY_ITEM: Record<RecoveryItemType, number> = {
  sleep: 4,
  strength: 5,
  nutrition: 6,
  zone2: 7,
  lsd: 8,
  interval: 9,
};

const EDUCATION_BY_GAME_OVER_REASON: Record<GameOverReason, number> = {
  energyDepleted: 3,
  injuryRiskMaxed: 2,
};

export interface EducationSelection {
  dominantObstacle: ObstacleType | null;
  gameOverReason: GameOverReason | null;
  outcome?: 'completed' | 'stopped';
}

function getMessageById(id: number): EducationMessage {
  return EDUCATION_MESSAGES.find((message) => message.id === id) ?? EDUCATION_MESSAGES[9];
}

/** 優先依主要障礙選擇；無障礙時再依完賽結果或停止原因選擇。 */
export function selectEducationMessage({
  dominantObstacle,
  gameOverReason,
  outcome,
}: EducationSelection): EducationMessage {
  if (dominantObstacle !== null) {
    return getMessageById(EDUCATION_BY_OBSTACLE[dominantObstacle]);
  }
  if (outcome === 'completed') return getMessageById(11);
  if (gameOverReason !== null) {
    return getMessageById(EDUCATION_BY_GAME_OVER_REASON[gameOverReason]);
  }
  return getMessageById(10);
}

export function getEducationMessageForObstacle(obstacle: ObstacleType): EducationMessage {
  return getMessageById(EDUCATION_BY_OBSTACLE[obstacle]);
}

export function getEducationMessageForRecoveryItem(item: RecoveryItemType): EducationMessage {
  return getMessageById(EDUCATION_BY_RECOVERY_ITEM[item]);
}
