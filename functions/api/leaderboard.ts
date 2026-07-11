import { LEADERBOARD_LIMIT } from '../../src/shared/networkLeaderboardRules';
import { jsonResponse, withApiErrors } from '../_lib/http';
import { listLeaderboard } from '../_lib/repository';
import type { PagesHandler } from '../_lib/types';

const handleGet: PagesHandler = (context) =>
  withApiErrors(async () => {
    const rows = await listLeaderboard(context.env.DB, LEADERBOARD_LIMIT);
    const entries = rows.map((row) => ({
      id: row.id,
      name: row.name,
      score: row.score,
      distanceMeters: row.distance_meters,
      outcome: row.outcome,
      stageId: row.stage_id,
      healthBonus: row.health_bonus,
    }));

    return jsonResponse({ entries, updatedAt: new Date().toISOString() }, 200, {
      cacheControl: 'public, max-age=10, s-maxage=10',
    });
  });

export const onRequest: PagesHandler = (context) => {
  if (context.request.method !== 'GET') {
    return jsonResponse(
      { error: { code: 'METHOD_NOT_ALLOWED', message: '此 API 只接受 GET。' } },
      405,
      { headers: { Allow: 'GET' } },
    );
  }
  return handleGet(context);
};
