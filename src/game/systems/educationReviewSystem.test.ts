import type { RunKnowledgeItem } from '../../shared/education';
import { OBSTACLE_TYPES, RECOVERY_ITEM_TYPES } from '../types';
import { createGameOverResult } from './gameOverSystem';
import {
  appendRunKnowledgeItem,
  getRunKnowledgeItemForObstacle,
  getRunKnowledgeItemForRecoveryItem,
  MAX_RUN_KNOWLEDGE_ITEMS,
  normalizeRunKnowledgeReview,
} from './educationReviewSystem';

describe('本局衛教回顧', () => {
  it('將障礙與恢復道具轉成有穩定識別碼的衛教重點', () => {
    const allItems = [
      ...OBSTACLE_TYPES.map(getRunKnowledgeItemForObstacle),
      ...RECOVERY_ITEM_TYPES.map(getRunKnowledgeItemForRecoveryItem),
    ];
    const obstacle = getRunKnowledgeItemForObstacle('sportsInjury');
    const recoveryItem = getRunKnowledgeItemForRecoveryItem('interval');

    expect(allItems).toHaveLength(OBSTACLE_TYPES.length + RECOVERY_ITEM_TYPES.length);
    expect(new Set(allItems.map((item) => item.id)).size).toBe(allItems.length);
    for (const item of allItems) {
      expect(item.label).not.toBe('');
      expect(item.message).not.toBe('');
      expect(item.action).not.toBe('');
    }
    expect(obstacle).toMatchObject({
      id: 'obstacle:sportsInjury',
      kind: 'obstacle',
      label: '運動傷害',
    });
    expect(obstacle.message).toContain('疼痛');
    expect(obstacle.action).toContain('停止');
    expect(recoveryItem).toMatchObject({
      id: 'recoveryItem:interval',
      kind: 'recoveryItem',
      label: '間歇訓練',
    });
    expect(recoveryItem.message).toContain('間歇訓練');
    expect(recoveryItem.action).toContain('恢復');
  });

  it('依第一次遇到的順序去重，並限制最多五則', () => {
    const encounters = [
      getRunKnowledgeItemForRecoveryItem('nutrition'),
      getRunKnowledgeItemForObstacle('illness'),
      getRunKnowledgeItemForRecoveryItem('nutrition'),
      getRunKnowledgeItemForRecoveryItem('sleep'),
      getRunKnowledgeItemForRecoveryItem('strength'),
      getRunKnowledgeItemForRecoveryItem('zone2'),
      getRunKnowledgeItemForRecoveryItem('lsd'),
    ];

    const review = normalizeRunKnowledgeReview(encounters);

    expect(review).toHaveLength(MAX_RUN_KNOWLEDGE_ITEMS);
    expect(review.map((item) => item.id)).toEqual([
      'recoveryItem:nutrition',
      'obstacle:illness',
      'recoveryItem:sleep',
      'recoveryItem:strength',
      'recoveryItem:zone2',
    ]);
    expect(review[0]).not.toBe(encounters[0]);
  });

  it('逐筆追加時不會因重複遇到而改變原始順序', () => {
    const sleep = getRunKnowledgeItemForRecoveryItem('sleep');
    const illness = getRunKnowledgeItemForObstacle('illness');
    let review: readonly RunKnowledgeItem[] = [];

    review = appendRunKnowledgeItem(review, sleep);
    review = appendRunKnowledgeItem(review, illness);
    review = appendRunKnowledgeItem(review, sleep);

    expect(review.map((item) => item.id)).toEqual(['recoveryItem:sleep', 'obstacle:illness']);
  });

  it('結算結果會複製、去重並限制外部傳入的回顧內容', () => {
    const first = getRunKnowledgeItemForRecoveryItem('nutrition');
    const inputs: RunKnowledgeItem[] = [
      first,
      { ...first, message: '不應覆蓋第一次訊息' },
      getRunKnowledgeItemForObstacle('illness'),
      getRunKnowledgeItemForRecoveryItem('sleep'),
      getRunKnowledgeItemForRecoveryItem('strength'),
      getRunKnowledgeItemForRecoveryItem('zone2'),
      getRunKnowledgeItemForRecoveryItem('lsd'),
    ];
    const result = createGameOverResult({
      reason: 'energyDepleted',
      dominantObstacle: 'illness',
      distanceMeters: 1_000,
      score: 100,
      highScore: 100,
      isNewHighScore: true,
      knowledgeReview: inputs,
    });

    expect(result.knowledgeReview).toHaveLength(MAX_RUN_KNOWLEDGE_ITEMS);
    expect(result.knowledgeReview[0]).toEqual(first);
    expect(result.knowledgeReview[0]).not.toBe(first);
    expect(result.knowledgeReview.map((item) => item.id)).toEqual([
      'recoveryItem:nutrition',
      'obstacle:illness',
      'recoveryItem:sleep',
      'recoveryItem:strength',
      'recoveryItem:zone2',
    ]);

    inputs[0] = getRunKnowledgeItemForObstacle('sportsInjury');
    expect(result.knowledgeReview[0]?.id).toBe('recoveryItem:nutrition');
  });
});
