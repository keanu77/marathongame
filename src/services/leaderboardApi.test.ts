import { LeaderboardApiClient, LeaderboardApiError, type LeaderboardFetch } from './leaderboardApi';

const NOW = '2026-07-11T03:04:05.678Z';
const LATER = '2026-07-11T03:14:05.678Z';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function leaderboardEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'entry-1',
    name: '阿跑',
    score: 4_500,
    distanceMeters: 42_195,
    outcome: 'completed',
    stageId: 'race',
    ...overrides,
  };
}

describe('LeaderboardApiClient 成功流程', () => {
  it('使用 same-origin JSON 設定，正確編碼 run id 並解析四個 API 契約', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
        const path = String(input);
        if (path === '/api/runs') {
          return jsonResponse({
            run: {
              id: 'run/一',
              token: 'signed-token',
              expiresAt: LATER,
              rulesVersion: '2026-07-v1',
            },
          });
        }
        if (path.endsWith('/checkpoint')) return jsonResponse({ accepted: true });
        if (path.endsWith('/finish')) {
          return jsonResponse({ entry: leaderboardEntry(), rank: 1 });
        }
        if (path === '/api/leaderboard') {
          return jsonResponse({ entries: [leaderboardEntry()], updatedAt: NOW });
        }
        return jsonResponse({}, 404);
      },
    );
    const client = new LeaderboardApiClient({ fetch: fetchMock, timeoutMs: 1_000 });

    await expect(client.startRun()).resolves.toEqual({
      run: {
        id: 'run/一',
        token: 'signed-token',
        expiresAt: LATER,
        rulesVersion: '2026-07-v1',
      },
    });
    await expect(
      client.submitCheckpoint('run/一', {
        token: 'signed-token',
        elapsedSeconds: 24.5,
        collectedRecoveryItems: 3,
      }),
    ).resolves.toEqual({ accepted: true });
    await expect(
      client.finishRun('run/一', {
        token: 'signed-token',
        name: '  阿跑  ',
        elapsedSeconds: 80,
        collectedRecoveryItems: 9,
        outcome: 'completed',
        stageId: 'race',
      }),
    ).resolves.toEqual({ entry: leaderboardEntry(), rank: 1 });
    await expect(client.getLeaderboard()).resolves.toEqual({
      entries: [leaderboardEntry()],
      updatedAt: NOW,
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/runs',
      '/api/runs/run%2F%E4%B8%80/checkpoint',
      '/api/runs/run%2F%E4%B8%80/finish',
      '/api/leaderboard',
    ]);

    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({
        credentials: 'omit',
        cache: 'no-store',
        mode: 'same-origin',
      });
      const headers = new Headers(init?.headers);
      expect(headers.get('accept')).toBe('application/json');
      expect(headers.get('content-type')).toBe('application/json');
    }

    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe('{}');
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({
        token: 'signed-token',
        elapsedSeconds: 24.5,
        collectedRecoveryItems: 3,
      }),
    );
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(
      JSON.stringify({
        token: 'signed-token',
        elapsedSeconds: 80,
        collectedRecoveryItems: 9,
        name: '阿跑',
        outcome: 'completed',
        stageId: 'race',
      }),
    );
  });
});

describe('LeaderboardApiClient 錯誤處理', () => {
  it('拒絕惡意或不符合契約的回應，且錯誤訊息不包含遠端內容', async () => {
    const maliciousText = '<img src=x onerror=alert(1)>';
    const fetchMock = vi.fn(async (): Promise<Response> =>
      jsonResponse({
        entries: [
          leaderboardEntry({
            name: maliciousText,
            score: '999999999',
            outcome: 'javascript:alert(1)',
          }),
        ],
        updatedAt: 'javascript:alert(1)',
      }),
    );
    const client = new LeaderboardApiClient({ fetch: fetchMock });

    const error = await client.getLeaderboard().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(LeaderboardApiError);
    expect(error).toMatchObject({ code: 'invalid_response', status: null });
    expect((error as Error).message).toContain('無法辨識');
    expect((error as Error).message).not.toContain(maliciousText);
  });

  it.each([
    [404, 'not_found', '找不到'],
    [409, 'conflict', '已提交或已失效'],
    [429, 'rate_limited', '次數過多'],
    [503, 'server_error', '暫時忙碌'],
  ] as const)('將 HTTP %i 轉成可辨識的繁中 API 錯誤', async (status, code, message) => {
    const fetchMock = vi.fn(async (): Promise<Response> =>
      jsonResponse({ error: { code: 'UNTRUSTED_REMOTE_MESSAGE' } }, status),
    );
    const client = new LeaderboardApiClient({ fetch: fetchMock });

    await expect(
      client.submitCheckpoint('run-1', {
        token: 'signed-token',
        elapsedSeconds: 20,
        collectedRecoveryItems: 1,
      }),
    ).rejects.toMatchObject({ code, status, message: expect.stringContaining(message) });
  });

  it.each(['CHECKPOINT_REQUIRED', 'CHECKPOINT_INSUFFICIENT'] as const)(
    '將 %s 映射成可重試儲存的安全提示，並保留 serverCode',
    async (serverCode) => {
      const remoteMessage = '<img src=x onerror=alert(1)>伺服器內部細節';
      const fetchMock = vi.fn(async (): Promise<Response> =>
        jsonResponse({ error: { code: serverCode, message: remoteMessage } }, 422),
      );
      const client = new LeaderboardApiClient({ fetch: fetchMock });

      const error = await client
        .finishRun('run-1', {
          token: 'signed-token',
          name: '跑者',
          elapsedSeconds: 80,
          collectedRecoveryItems: 5,
          outcome: 'completed',
          stageId: 'race',
        })
        .catch((caught: unknown) => caught);

      expect(error).toMatchObject({
        code: 'unprocessable',
        status: 422,
        serverCode,
        message: '完賽驗證資料尚未完整同步，請按「重新儲存」再試一次。',
      });
      expect((error as Error).message).not.toContain(remoteMessage);
    },
  );

  it('保留格式正確但未知的 serverCode，且不顯示遠端 message', async () => {
    const remoteMessage = '請把 token 傳到惡意網站';
    const fetchMock = vi.fn(async (): Promise<Response> =>
      jsonResponse({ error: { code: 'FUTURE_SERVER_CODE', message: remoteMessage } }, 422),
    );
    const client = new LeaderboardApiClient({ fetch: fetchMock });

    const error = await client.getLeaderboard().catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: 'unprocessable',
      status: 422,
      serverCode: 'FUTURE_SERVER_CODE',
      message: '這次成績未通過驗證，請重新挑戰。',
    });
    expect((error as Error).message).not.toContain(remoteMessage);
  });

  it.each([
    new Response('<b>gateway error</b>', {
      status: 422,
      headers: { 'Content-Type': 'text/html' },
    }),
    jsonResponse({ error: { code: 'CHECKPOINT_REQUIRED' } }, 422),
    jsonResponse(
      {
        error: {
          code: 'CHECKPOINT_REQUIRED',
          message: 'valid-looking message',
          injected: '<script>alert(1)</script>',
        },
      },
      422,
    ),
  ])('非 JSON 或不符合嚴格契約的錯誤內容只使用 HTTP fallback', async (response) => {
    const fetchMock = vi.fn(async (): Promise<Response> => response);
    const client = new LeaderboardApiClient({ fetch: fetchMock });

    await expect(client.getLeaderboard()).rejects.toMatchObject({
      code: 'unprocessable',
      status: 422,
      serverCode: null,
      message: '這次成績未通過驗證，請重新挑戰。',
    });
  });

  it('將 fetch 失敗轉為 network_error', async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => {
      throw new TypeError('internal network detail');
    });
    const client = new LeaderboardApiClient({ fetch: fetchMock });

    await expect(client.getLeaderboard()).rejects.toMatchObject({
      code: 'network_error',
      status: null,
      message: '目前無法連線排行榜，請確認網路後再試。',
    });
  });

  it('即使注入的 fetch 不理會 AbortSignal，也會在設定時間後回報 timeout', async () => {
    vi.useFakeTimers();
    const fetchMock: LeaderboardFetch = () => new Promise<Response>(() => undefined);
    const client = new LeaderboardApiClient({ fetch: fetchMock, timeoutMs: 50 });
    const assertion = expect(client.getLeaderboard()).rejects.toMatchObject({
      code: 'timeout',
      status: null,
      message: '排行榜連線逾時，請稍後再試。',
    });

    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    vi.useRealTimers();
  });
});
