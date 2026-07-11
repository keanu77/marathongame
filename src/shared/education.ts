export type EducationTopic = 'training' | 'injury' | 'nutrition';

export interface EducationSource {
  readonly label: string;
  readonly url: string;
}

/** 公開衛教內容的版本與治理狀態；不能取代逐條專業簽核紀錄。 */
export interface EducationContentMetadata {
  readonly version: string;
  /** ISO 8601 日期（YYYY-MM-DD）。 */
  readonly updatedAt: string;
  readonly maintainedBy: string;
  readonly reviewStatus: 'pending' | 'reviewed';
  readonly scope: string;
}

/** 一張可在結算頁快速讀完的非個人化衛教提醒。 */
export interface EducationReminderCard {
  readonly id: string;
  readonly topic: EducationTopic;
  readonly topicLabel: string;
  readonly icon: string;
  readonly title: string;
  readonly message: string;
  readonly action: string;
  readonly source: EducationSource;
}

export interface EducationSafetyAlert {
  readonly title: string;
  readonly message: string;
}

export type RunKnowledgeKind = 'obstacle' | 'recoveryItem';

/**
 * 一局內由玩家實際碰到的障礙或收集的恢復道具所建立的衛教重點。
 * id 是穩定的去重鍵；UI 應將其餘欄位當作純文字顯示。
 */
export interface RunKnowledgeItem {
  readonly id: string;
  readonly kind: RunKnowledgeKind;
  readonly label: string;
  readonly message: string;
  readonly action: string;
}
