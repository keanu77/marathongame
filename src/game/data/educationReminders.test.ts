import { describe, expect, it } from 'vitest';

import {
  countEducationRemindersByTopic,
  EDUCATION_REMINDER_CARDS,
  EDUCATION_SAFETY_ALERT,
  selectEducationFocusTopic,
  selectEducationReminders,
} from './educationReminders';

describe('結算頁延伸衛教提醒', () => {
  it('提供訓練、傷害與營養的獨立卡片，且所有來源皆為 HTTPS', () => {
    const ids = EDUCATION_REMINDER_CARDS.map((card) => card.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(countEducationRemindersByTopic('training')).toBeGreaterThanOrEqual(3);
    expect(countEducationRemindersByTopic('injury')).toBeGreaterThanOrEqual(3);
    expect(countEducationRemindersByTopic('nutrition')).toBeGreaterThanOrEqual(3);
    for (const card of EDUCATION_REMINDER_CARDS) {
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.message.length).toBeGreaterThan(0);
      expect(card.action.length).toBeGreaterThan(0);
      expect(new URL(card.source.url).protocol).toBe('https:');
    }
  });

  it('每局固定選出三個不重複主題，並依實際障礙優先選擇傷害內容', () => {
    const cards = selectEducationReminders({
      dominantObstacle: 'sportsInjury',
      gameOverReason: 'injuryRiskMaxed',
      outcome: 'stopped',
      stageId: 'build',
      collectedRecoveryItems: 3,
    });

    expect(cards.map((card) => card.topic)).toEqual(['training', 'injury', 'nutrition']);
    expect(cards.map((card) => card.id)).toEqual([
      'training-strength-support',
      'injury-pain-function',
      'nutrition-hydration-individual',
    ]);
    expect(
      selectEducationFocusTopic({
        dominantObstacle: 'sportsInjury',
        gameOverReason: 'injuryRiskMaxed',
        outcome: 'stopped',
        stageId: 'build',
        collectedRecoveryItems: 3,
      }),
    ).toBe('injury');
  });

  it('體力耗盡時先提醒補給測試，過度訓練時先提醒訓練恢復', () => {
    const energySelection = {
      dominantObstacle: null,
      gameOverReason: 'energyDepleted',
      outcome: 'stopped',
      stageId: 'base',
      collectedRecoveryItems: 0,
    } as const;
    const overtrainingSelection = {
      dominantObstacle: 'overtraining',
      gameOverReason: 'injuryRiskMaxed',
      outcome: 'stopped',
      stageId: 'build',
      collectedRecoveryItems: 2,
    } as const;

    expect(selectEducationReminders(energySelection)[2]?.id).toBe('nutrition-practice-plan');
    expect(selectEducationFocusTopic(energySelection)).toBe('nutrition');
    expect(selectEducationReminders(overtrainingSelection)[0]?.id).toBe(
      'training-recovery-balance',
    );
    expect(selectEducationFocusTopic(overtrainingSelection)).toBe('training');
  });

  it('固定紅旗提醒包含停止運動與緊急醫療指引', () => {
    expect(EDUCATION_SAFETY_ALERT.title).toContain('立即停下');
    expect(EDUCATION_SAFETY_ALERT.message).toContain('胸痛');
    expect(EDUCATION_SAFETY_ALERT.message).toContain('緊急醫療');
  });
});
