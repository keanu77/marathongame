import type {
  EducationContentMetadata,
  EducationReminderCard,
  EducationSafetyAlert,
  EducationTopic,
} from '../../shared/education';
import type { GameOverReason, MarathonStageId, ObstacleType } from '../types';

export const EDUCATION_CONTENT_METADATA = {
  version: '2026.07',
  updatedAt: '2026-07-12',
  maintainedBy: '專案維護者',
  reviewStatus: 'pending',
  scope: '結算提醒、紅旗警訊、訓練、運動傷害與跑步營養一般衛教',
} as const satisfies EducationContentMetadata;

export const EDUCATION_REMINDER_CARDS = [
  {
    id: 'training-gradual-load',
    topic: 'training',
    topicLabel: '馬拉松訓練',
    icon: '📈',
    title: '一次只調整一個變項',
    message: '跑量、頻率與強度都會形成訓練負荷；突然同時增加，身體更難適應。',
    action: '先穩定目前課表，再小幅調整時間、距離或強度其中一項。',
    source: {
      label: 'World Athletics｜跑者傷害預防',
      url: 'https://worldathletics.org/personal-best/performance/injury-prevention-runners',
    },
  },
  {
    id: 'training-recovery-balance',
    topic: 'training',
    topicLabel: '馬拉松訓練',
    icon: '🌙',
    title: '恢復也算課表內容',
    message: '工作壓力、睡眠、旅行與訓練會一起影響總負荷；疲勞與表現變化值得追蹤。',
    action: '記錄睡眠、精神、痠痛與完成感；異常持續時主動降低負荷。',
    source: {
      label: 'IOC 共識｜負荷、疾病與過度訓練',
      url: 'https://bjsm.bmj.com/content/50/17/1043',
    },
  },
  {
    id: 'training-strength-support',
    topic: 'training',
    topicLabel: '馬拉松訓練',
    icon: '🏋️',
    title: '阻力訓練是跑步的好配角',
    message: '合適的阻力訓練可支援耐力跑表現，但仍需要和跑步課表一起循序安排。',
    action: '從能穩定控制動作品質的負荷開始，避免和高強度跑課同時大幅加量。',
    source: {
      label: 'Sports Medicine｜耐力跑者阻力訓練回顧',
      url: 'https://pubmed.ncbi.nlm.nih.gov/38627351/',
    },
  },
  {
    id: 'training-race-pacing',
    topic: 'training',
    topicLabel: '馬拉松訓練',
    icon: '⏱️',
    title: '起跑保守，後段才有選擇',
    message: '馬拉松前段衝太快，常會讓後段配速大幅下滑；穩定比一開始搶快更重要。',
    action: '先在訓練中熟悉目標配速，比賽前段保留餘裕，再依當天狀況調整。',
    source: {
      label: 'World Athletics｜馬拉松配速分析',
      url: 'https://worldathletics.org/spikes/news/barry-smyth-recreational-runner-analysis',
    },
  },
  {
    id: 'injury-pain-function',
    topic: 'injury',
    topicLabel: '運動傷害',
    icon: '🦵',
    title: '看功能，不只看痛不痛',
    message: '疼痛加重、明顯腫脹或跑姿與日常功能改變，不適合只靠意志力撐過去。',
    action: '停止誘發症狀的活動；症狀明顯、持續或惡化時，尋求合格醫療專業人員評估。',
    source: {
      label: 'World Athletics｜新跑者安全建議',
      url: 'https://worldathletics.org/personal-best/performance/advice-runners-beginners',
    },
  },
  {
    id: 'injury-illness',
    topic: 'injury',
    topicLabel: '運動傷害',
    icon: '🤒',
    title: '生病時不要硬跑高強度',
    message: '急性症狀和高訓練負荷疊加，可能增加不良反應並拖慢恢復。',
    action: '有全身不適、發燒或症狀惡化時先停訓；恢復前不要急著補回漏掉的課表。',
    source: {
      label: 'IOC 共識｜運動負荷與疾病風險',
      url: 'https://bjsm.bmj.com/content/50/17/1043',
    },
  },
  {
    id: 'injury-heat',
    topic: 'injury',
    topicLabel: '運動傷害',
    icon: '🌡️',
    title: '頭暈或虛弱，先離開熱環境',
    message: '高溫運動時的頭暈、虛弱、噁心或意識改變，可能是熱傷害警訊。',
    action: '立刻停止、移到陰涼處並降溫；意識混亂、昏倒或症狀惡化時立即求助。',
    source: {
      label: 'CDC｜運動員熱傷害安全',
      url: 'https://www.cdc.gov/heat-health/risk-factors/heat-and-athletes.html',
    },
  },
  {
    id: 'injury-cardiac-red-flags',
    topic: 'injury',
    topicLabel: '運動傷害',
    icon: '🫀',
    title: '胸悶、昏厥或異常喘要停下',
    message: '胸部壓迫感、昏厥、意識混亂、異常呼吸困難或不規則心跳不是一般疲勞。',
    action: '立即停止並尋求醫療協助；嚴重或持續症狀請使用當地緊急醫療服務。',
    source: {
      label: 'American Heart Association｜運動警訊',
      url: 'https://www.heart.org/en/health-topics/cardiac-rehab/getting-physically-active/develop-a-physical-activity-plan-for-you',
    },
  },
  {
    id: 'nutrition-practice-plan',
    topic: 'nutrition',
    topicLabel: '跑步營養',
    icon: '🎒',
    title: '補給策略要先在訓練測試',
    message: '比賽當天才第一次嘗試食物、飲料或補給品，較難預測腸胃耐受與效果。',
    action: '在長跑課逐步測試種類、攜帶方式與補給時機，並記錄腸胃反應。',
    source: {
      label: 'World Athletics｜2019 運動營養共識',
      url: 'https://worldathletics.org/download/download?filename=23fb9de0-6699-4d5b-b075-42f5da5518f5.pdf&urlslug=nutrition%2Bfor%2Bathletics%2B-%2B2019%2Biaaf%2Bconsensus%2Bstatement',
    },
  },
  {
    id: 'nutrition-hydration-individual',
    topic: 'nutrition',
    topicLabel: '跑步營養',
    icon: '💧',
    title: '水分需求沒有單一答案',
    message: '流汗量會隨個人、天氣、速度與運動時間改變，固定套用同一飲水量並不理想。',
    action: '從天氣、口渴、流汗情形與跑前後體重變化了解需求，必要時諮詢專業人員。',
    source: {
      label: 'ACSM｜運動與水分補充立場聲明',
      url: 'https://pubmed.ncbi.nlm.nih.gov/17277604/',
    },
  },
  {
    id: 'nutrition-avoid-overdrinking',
    topic: 'nutrition',
    topicLabel: '跑步營養',
    icon: '⚖️',
    title: '不要為了安心而過量喝水',
    message: '長時間運動時，喝得比流失還多可能造成低血鈉；運動飲料也不能抵消過量飲水。',
    action: '依口渴、流汗與環境調整，不強迫自己在每一站都喝完固定份量。',
    source: {
      label: '國際共識｜運動相關低血鈉',
      url: 'https://bjsm.bmj.com/content/49/22/1432',
    },
  },
  {
    id: 'nutrition-recovery-energy',
    topic: 'nutrition',
    topicLabel: '跑步營養',
    icon: '🍚',
    title: '完賽後也要補回恢復材料',
    message: '充足能量、碳水化合物、蛋白質與水分有助於訓練後恢復與後續表現。',
    action: '預先準備自己吃得下的正餐或點心；需求複雜時，找合格營養專業人員規劃。',
    source: {
      label: 'Academy／ACSM｜運動營養立場聲明',
      url: 'https://pubmed.ncbi.nlm.nih.gov/26891166/',
    },
  },
] as const satisfies readonly EducationReminderCard[];

export const EDUCATION_SAFETY_ALERT = {
  title: '需要立即停下的警訊',
  message:
    '胸痛或胸悶、運動中昏倒、嚴重或持續呼吸困難、意識混亂或抽搐：立即停止運動並呼叫當地緊急醫療服務。',
} as const satisfies EducationSafetyAlert;

type EducationReminderId = (typeof EDUCATION_REMINDER_CARDS)[number]['id'];

const CARD_BY_ID = new Map(EDUCATION_REMINDER_CARDS.map((card) => [card.id, card] as const));

export interface EducationReminderSelection {
  readonly dominantObstacle: ObstacleType | null;
  readonly gameOverReason: GameOverReason | null;
  readonly outcome: 'completed' | 'stopped';
  readonly stageId: MarathonStageId;
  readonly collectedRecoveryItems: number;
}

function getCard(id: EducationReminderId): EducationReminderCard {
  const card = CARD_BY_ID.get(id);
  if (!card) throw new Error(`Unknown education reminder: ${id}`);
  return card;
}

function selectTrainingCard(selection: EducationReminderSelection): EducationReminderId {
  if (selection.outcome === 'completed' || selection.stageId === 'race') {
    return 'training-race-pacing';
  }
  if (
    selection.dominantObstacle === 'overtraining' ||
    selection.gameOverReason === 'energyDepleted'
  ) {
    return 'training-recovery-balance';
  }
  return selection.stageId === 'build' ? 'training-strength-support' : 'training-gradual-load';
}

function selectInjuryCard(selection: EducationReminderSelection): EducationReminderId {
  switch (selection.dominantObstacle) {
    case 'illness':
      return 'injury-illness';
    case 'sportsInjury':
      return 'injury-pain-function';
    case 'overtraining':
      return 'injury-pain-function';
    default:
      return selection.outcome === 'completed' || selection.stageId === 'race'
        ? 'injury-pain-function'
        : 'injury-heat';
  }
}

function selectNutritionCard(selection: EducationReminderSelection): EducationReminderId {
  if (selection.gameOverReason === 'energyDepleted' || selection.collectedRecoveryItems <= 1) {
    return 'nutrition-practice-plan';
  }
  if (selection.outcome === 'completed') return 'nutrition-recovery-energy';
  return selection.stageId === 'race'
    ? 'nutrition-avoid-overdrinking'
    : 'nutrition-hydration-individual';
}

/** 每局固定挑選訓練、傷害、營養各一張，避免單一主題過度集中。 */
export function selectEducationReminders(
  selection: EducationReminderSelection,
): readonly EducationReminderCard[] {
  return [
    getCard(selectTrainingCard(selection)),
    getCard(selectInjuryCard(selection)),
    getCard(selectNutritionCard(selection)),
  ];
}

export function selectEducationFocusTopic(selection: EducationReminderSelection): EducationTopic {
  if (selection.dominantObstacle === 'overtraining') return 'training';
  if (
    selection.dominantObstacle === 'illness' ||
    selection.dominantObstacle === 'sportsInjury' ||
    selection.gameOverReason === 'injuryRiskMaxed'
  ) {
    return 'injury';
  }
  if (selection.gameOverReason === 'energyDepleted' || selection.outcome === 'completed') {
    return 'nutrition';
  }
  return 'training';
}

export function countEducationRemindersByTopic(topic: EducationTopic): number {
  return EDUCATION_REMINDER_CARDS.filter((card) => card.topic === topic).length;
}
