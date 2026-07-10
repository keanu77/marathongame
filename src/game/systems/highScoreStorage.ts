import { GAME_CONFIG } from '../config';
import type { StorageLike } from '../types';

function normalizeScore(score: number): number {
  return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
}

function getBrowserStorage(): StorageLike | null {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return null;
    }

    return globalThis.localStorage as StorageLike;
  } catch {
    return null;
  }
}

export function readHighScore(storage: StorageLike | null = getBrowserStorage()): number {
  if (storage === null) return 0;

  try {
    const storedValue = storage.getItem(GAME_CONFIG.highScoreStorageKey);
    if (storedValue === null || storedValue.trim() === '') return 0;
    return normalizeScore(Number(storedValue));
  } catch {
    return 0;
  }
}

export function writeHighScore(
  score: number,
  storage: StorageLike | null = getBrowserStorage(),
): number {
  const normalizedScore = normalizeScore(score);
  if (storage === null) return normalizedScore;

  try {
    storage.setItem(GAME_CONFIG.highScoreStorageKey, String(normalizedScore));
  } catch {
    // localStorage 可能因無痕模式或儲存配額被瀏覽器拒絕。
  }

  return normalizedScore;
}

/** 只在新分數較高時更新，並回傳最後的歷史最高分。 */
export function updateHighScore(
  score: number,
  storage: StorageLike | null = getBrowserStorage(),
): number {
  const nextHighScore = Math.max(readHighScore(storage), normalizeScore(score));
  return writeHighScore(nextHighScore, storage);
}
