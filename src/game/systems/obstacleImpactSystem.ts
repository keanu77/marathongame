import { OBSTACLE_TYPES } from '../types';
import type { ObstacleImpactCounts, ObstacleType } from '../types';

export function createObstacleImpactCounts(): ObstacleImpactCounts {
  return Object.fromEntries(OBSTACLE_TYPES.map((type) => [type, 0])) as ObstacleImpactCounts;
}

export function recordObstacleImpact(
  impactCounts: ObstacleImpactCounts,
  obstacleType: ObstacleType,
  amount = 1,
): ObstacleImpactCounts {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;

  return {
    ...impactCounts,
    [obstacleType]: impactCounts[obstacleType] + safeAmount,
  };
}

/**
 * 數值相同時依 OBSTACLE_TYPES 的固定順序選擇，讓結果可重現。
 */
export function getDominantObstacle(impactCounts: ObstacleImpactCounts): ObstacleType | null {
  let dominantObstacle: ObstacleType | null = null;
  let highestCount = 0;

  for (const obstacleType of OBSTACLE_TYPES) {
    const count = Number.isFinite(impactCounts[obstacleType])
      ? Math.max(0, impactCounts[obstacleType])
      : 0;

    if (count > highestCount) {
      dominantObstacle = obstacleType;
      highestCount = count;
    }
  }

  return dominantObstacle;
}
