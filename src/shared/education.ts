export type EducationTopic = 'training' | 'injury' | 'nutrition';

export interface EducationSource {
  readonly label: string;
  readonly url: string;
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
