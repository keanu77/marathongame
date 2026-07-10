import type { RunKnowledgeItem } from '../../shared/education';
import {
  getEducationMessageForObstacle,
  getEducationMessageForRecoveryItem,
  OBSTACLE_LABELS,
  RECOVERY_ITEM_LABELS,
} from '../data';
import type { ObstacleType, RecoveryItemType } from '../types';

export const MAX_RUN_KNOWLEDGE_ITEMS = 5;

export function getRunKnowledgeItemForObstacle(obstacle: ObstacleType): RunKnowledgeItem {
  const education = getEducationMessageForObstacle(obstacle);

  return {
    id: `obstacle:${obstacle}`,
    kind: 'obstacle',
    label: OBSTACLE_LABELS[obstacle],
    message: education.text,
    action: education.action,
  };
}

export function getRunKnowledgeItemForRecoveryItem(
  recoveryItem: RecoveryItemType,
): RunKnowledgeItem {
  const education = getEducationMessageForRecoveryItem(recoveryItem);

  return {
    id: `recoveryItem:${recoveryItem}`,
    kind: 'recoveryItem',
    label: RECOVERY_ITEM_LABELS[recoveryItem],
    message: education.text,
    action: education.action,
  };
}

/**
 * 以第一次遇到的順序保留衛教重點，相同 id 不重複、也不會被後來的資料覆蓋。
 */
export function normalizeRunKnowledgeReview(
  items: readonly RunKnowledgeItem[] | undefined,
): readonly RunKnowledgeItem[] {
  if (!items || items.length === 0) return [];

  const seenIds = new Set<string>();
  const review: RunKnowledgeItem[] = [];

  for (const item of items) {
    if (review.length >= MAX_RUN_KNOWLEDGE_ITEMS) break;
    if (seenIds.has(item.id)) continue;

    seenIds.add(item.id);
    review.push({ ...item });
  }

  return review;
}

/** 新遇到的重點會加在尾端；重複或已達上限時回傳等值的新陣列。 */
export function appendRunKnowledgeItem(
  currentReview: readonly RunKnowledgeItem[],
  item: RunKnowledgeItem,
): readonly RunKnowledgeItem[] {
  return normalizeRunKnowledgeReview([...currentReview, item]);
}
