import type {
  GameOverReason,
  MarathonStageId,
  ObstacleType,
  PaceMode,
  RecoveryItemType,
} from '../types';

export const OBSTACLE_LABELS: Record<ObstacleType, string> = {
  illness: '生病／身體不適',
  sportsInjury: '運動傷害',
  overtraining: '過度訓練',
};

/** 障礙物本體上使用的手機可讀短標籤。 */
export const OBSTACLE_VISUAL_LABELS: Record<ObstacleType, string> = {
  illness: '生病',
  sportsInjury: '受傷',
  overtraining: '過訓',
};

export const RECOVERY_ITEM_LABELS: Record<RecoveryItemType, string> = {
  sleep: '睡眠',
  strength: '阻力訓練',
  nutrition: '營養補給',
  zone2: 'Zone 2',
  lsd: '長距離慢跑',
  interval: '間歇訓練',
};

export const MARATHON_STAGE_LABELS: Record<MarathonStageId, string> = {
  base: '基礎期',
  build: '進階期',
  race: '正式比賽',
};

export const MARATHON_STAGE_ENTRY_COPY: Record<
  MarathonStageId,
  Readonly<{ title: string; subtitle: string }>
> = {
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
};

export const PACE_MODE_LABELS: Record<PaceMode, string> = {
  zone2: 'Zone 2 配速',
  lsd: '長距離慢跑配速',
  interval: '間歇配速',
};

export const GAME_OVER_REASON_LABELS: Record<GameOverReason, string> = {
  energyDepleted: '耐力耗盡',
  injuryRiskMaxed: '受傷風險過高',
};
