import { assertLeaderboardWriteEnabled, assertSameOrigin } from '../functions/_lib/http';
import type { Env } from '../functions/_lib/types';

const env = (overrides: Partial<Env> = {}): Env =>
  ({
    DB: {},
    ...overrides,
  }) as Env;

function request(url: string, origin?: string): Request {
  return new Request(url, {
    headers: origin === undefined ? undefined : { Origin: origin },
  });
}

describe('leaderboard request security', () => {
  describe('same-origin validation', () => {
    it.each([
      'https://marathongame.pages.dev',
      'https://e7f69295.marathongame.pages.dev',
      'https://marathon.sportsmedicine.tw',
      'http://127.0.0.1:8788',
    ])('allows a same-origin request from %s', (origin) => {
      expect(() => assertSameOrigin(request(`${origin}/api/runs`, origin))).not.toThrow();
    });

    it.each([
      ['a missing Origin header', undefined],
      ['an opaque null Origin', 'null'],
      ['a cross-site Origin', 'https://attacker.example'],
      ['a mismatched scheme', 'http://marathongame.pages.dev'],
      ['a mismatched port', 'https://marathongame.pages.dev:444'],
    ])('rejects %s', (_label, origin) => {
      expect(() =>
        assertSameOrigin(request('https://marathongame.pages.dev/api/runs', origin)),
      ).toThrowError(expect.objectContaining({ status: 403, code: 'ORIGIN_NOT_ALLOWED' }));
    });
  });

  describe('production branch write gate', () => {
    it.each([
      env(),
      env({ CF_PAGES_BRANCH: 'main' }),
      env({ CF_PAGES_BRANCH: 'production', LEADERBOARD_PRODUCTION_BRANCH: 'production' }),
    ])('allows local development and the configured production branch', (bindings) => {
      expect(() => assertLeaderboardWriteEnabled(bindings)).not.toThrow();
    });

    it('rejects a Cloudflare preview branch', () => {
      expect(() =>
        assertLeaderboardWriteEnabled(
          env({ CF_PAGES_BRANCH: 'feature/leaderboard', LEADERBOARD_PRODUCTION_BRANCH: 'main' }),
        ),
      ).toThrowError(expect.objectContaining({ status: 403, code: 'PREVIEW_WRITE_DISABLED' }));
    });

    it.each(['', '   '])('rejects a defined but blank branch %j', (branch) => {
      expect(() => assertLeaderboardWriteEnabled(env({ CF_PAGES_BRANCH: branch }))).toThrowError(
        expect.objectContaining({ status: 403, code: 'PREVIEW_WRITE_DISABLED' }),
      );
    });
  });
});
