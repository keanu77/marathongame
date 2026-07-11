import { onRequest as checkpointRun } from '../functions/api/runs/[id]/checkpoint';
import { onRequest as finishRun } from '../functions/api/runs/[id]/finish';
import { onRequest as startRun } from '../functions/api/runs';
import type { PagesContext, PagesHandler } from '../functions/_lib/types';

const ORIGIN = 'https://feature.marathongame.pages.dev';
const RUN_ID = '11111111-1111-4111-8111-111111111111';

function context(path: string): PagesContext {
  return {
    request: new Request(`${ORIGIN}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: '{}',
    }),
    env: {
      DB: {},
      CF_PAGES_BRANCH: 'feature/leaderboard',
      LEADERBOARD_PRODUCTION_BRANCH: 'main',
    } as PagesContext['env'],
    params: { id: RUN_ID },
    waitUntil: vi.fn(),
  };
}

describe('leaderboard write route preview protection', () => {
  it.each([
    ['start', startRun, '/api/runs'],
    ['checkpoint', checkpointRun, `/api/runs/${RUN_ID}/checkpoint`],
    ['finish', finishRun, `/api/runs/${RUN_ID}/finish`],
  ] satisfies [string, PagesHandler, string][])(
    'blocks preview %s writes',
    async (_name, route, path) => {
      const response = await route(context(path));

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: {
          code: 'PREVIEW_WRITE_DISABLED',
          message: '此預覽版本不會寫入正式排行榜。',
        },
      });
    },
  );
});
