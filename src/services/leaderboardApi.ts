export const DEFAULT_LEADERBOARD_API_TIMEOUT_MS = 8_000;

export const RUN_OUTCOMES = ['completed', 'stopped'] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export const MARATHON_STAGE_IDS = ['base', 'build', 'race'] as const;
export type MarathonStageId = (typeof MARATHON_STAGE_IDS)[number];

export interface RunSession {
  id: string;
  token: string;
  /** ISO 8601 UTC timestamp. */
  expiresAt: string;
  rulesVersion: string;
}

export interface StartRunResponse {
  run: RunSession;
}

export interface RunCheckpointInput {
  token: string;
  elapsedSeconds: number;
  collectedRecoveryItems: number;
  /** 0～100；會在送出前正規化為小數點後 3 位。 */
  energy: number;
  /** 0～100；會在送出前正規化為小數點後 3 位。 */
  injuryRisk: number;
}

export interface RunCheckpointResponse {
  accepted: true;
}

export interface FinishRunInput extends RunCheckpointInput {
  name: string;
  outcome: RunOutcome;
  stageId: MarathonStageId;
}

export interface RemoteLeaderboardEntry {
  id: string;
  name: string;
  score: number;
  distanceMeters: number;
  outcome: RunOutcome;
  stageId: MarathonStageId;
  /** 舊制成績沒有健康完賽加分，因此為 null。 */
  healthBonus: number | null;
}

export interface FinishRunResponse {
  entry: RemoteLeaderboardEntry;
  /** 1 起算；未進入伺服器保留的排行榜時為 null。 */
  rank: number | null;
}

export interface LeaderboardResponse {
  entries: RemoteLeaderboardEntry[];
  /** ISO 8601 UTC timestamp. */
  updatedAt: string;
}

export type LeaderboardFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface LeaderboardApiClientOptions {
  fetch?: LeaderboardFetch;
  timeoutMs?: number;
}

export type LeaderboardApiErrorCode =
  | 'invalid_request'
  | 'timeout'
  | 'network_error'
  | 'invalid_response'
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'unprocessable'
  | 'rate_limited'
  | 'server_error'
  | 'http_error';

export class LeaderboardApiError extends Error {
  public readonly code: LeaderboardApiErrorCode;
  public readonly status: number | null;
  /** 伺服器回傳的機器可讀錯誤碼；只供診斷，不直接顯示給玩家。 */
  public readonly serverCode: string | null;

  public constructor(
    code: LeaderboardApiErrorCode,
    message: string,
    options: { status?: number; serverCode?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'LeaderboardApiError';
    this.code = code;
    this.status = options.status ?? null;
    this.serverCode = options.serverCode ?? null;
  }
}

type HttpMethod = 'GET' | 'POST';
type JsonRecord = Record<string, unknown>;

interface RequestOptions {
  method: HttpMethod;
  body?: unknown;
}

const ISO_8601_UTC_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/u;

const RESPONSE_LIMITS = {
  id: 256,
  token: 4_096,
  rulesVersion: 128,
  name: 12,
  leaderboardEntries: 10,
  officialDistanceMeters: 42_195,
  healthBonus: 400,
} as const;

const ERROR_RESPONSE_LIMITS = {
  bodyBytes: 2_048,
  code: 64,
  message: 256,
} as const;

interface ServerErrorPresentation {
  statuses: readonly number[];
  code: LeaderboardApiErrorCode;
  message: string;
}

/**
 * Only these server codes may influence player-facing copy. The API-provided
 * message is deliberately ignored so an upstream HTML/error page cannot be
 * reflected into the UI.
 */
const SERVER_ERROR_PRESENTATIONS: Readonly<Record<string, ServerErrorPresentation>> = {
  ORIGIN_NOT_ALLOWED: {
    statuses: [403],
    code: 'forbidden',
    message: '目前開啟的網址無法連線排行榜，請從正式遊戲網址重新挑戰。',
  },
  PREVIEW_WRITE_DISABLED: {
    statuses: [403],
    code: 'forbidden',
    message: '此預覽版本不會寫入正式排行榜，請從正式遊戲網址重新挑戰。',
  },
  CHECKPOINT_REQUIRED: {
    statuses: [422],
    code: 'unprocessable',
    message: '完賽驗證資料尚未完整同步，請按「重新儲存」再試一次。',
  },
  CHECKPOINT_INSUFFICIENT: {
    statuses: [422],
    code: 'unprocessable',
    message: '完賽驗證資料尚未完整同步，請按「重新儲存」再試一次。',
  },
  RUN_ALREADY_SUBMITTED: {
    statuses: [409],
    code: 'conflict',
    message: '這次成績可能已經儲存，請查看排行榜確認；若未出現再重新挑戰。',
  },
  RUN_NOT_FOUND: {
    statuses: [404],
    code: 'not_found',
    message: '找不到這次遊戲紀錄，請重新開始後再試。',
  },
  INVALID_RUN_TOKEN: {
    statuses: [401],
    code: 'unauthorized',
    message: '這次遊戲驗證已失效，請重新開始後再試。',
  },
  RUN_EXPIRED: {
    statuses: [410],
    code: 'conflict',
    message: '這次遊戲紀錄已逾時，請重新開始後再試。',
  },
  RULES_VERSION_MISMATCH: {
    statuses: [409],
    code: 'conflict',
    message: '遊戲驗證規則已更新，請重新整理頁面再挑戰。',
  },
  CHECKPOINT_CONFLICT: {
    statuses: [409],
    code: 'conflict',
    message: '遊戲進度同步不一致，請重新開始後再試。',
  },
  RATE_LIMITED: {
    statuses: [429],
    code: 'rate_limited',
    message: '提交次數過多，請稍後再試。',
  },
  SERVER_NOT_CONFIGURED: {
    statuses: [500],
    code: 'server_error',
    message: '排行榜服務暫時無法使用，請稍後再試。',
  },
  INTERNAL_ERROR: {
    statuses: [500],
    code: 'server_error',
    message: '排行榜服務暫時忙碌，請稍後再試。',
  },
};

export class LeaderboardApiClient {
  private readonly fetchImplementation: LeaderboardFetch;
  private readonly timeoutMs: number;

  public constructor(options: LeaderboardApiClientOptions = {}) {
    const fetchImplementation = options.fetch ?? getGlobalFetch();
    const timeoutMs = options.timeoutMs ?? DEFAULT_LEADERBOARD_API_TIMEOUT_MS;

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new LeaderboardApiError(
        'invalid_request',
        '排行榜連線逾時設定必須是大於 0 的有限數值。',
      );
    }

    this.fetchImplementation = fetchImplementation;
    this.timeoutMs = timeoutMs;
  }

  public startRun(): Promise<StartRunResponse> {
    return this.request('/api/runs', { method: 'POST', body: {} }, parseStartRunResponse);
  }

  public submitCheckpoint(
    runId: string,
    input: RunCheckpointInput,
  ): Promise<RunCheckpointResponse> {
    const encodedRunId = encodeRunId(runId);
    const body = normalizeCheckpointInput(input);
    return this.request(
      `/api/runs/${encodedRunId}/checkpoint`,
      { method: 'POST', body },
      parseCheckpointResponse,
    );
  }

  public finishRun(runId: string, input: FinishRunInput): Promise<FinishRunResponse> {
    const encodedRunId = encodeRunId(runId);
    const body = normalizeFinishRunInput(input);
    return this.request(
      `/api/runs/${encodedRunId}/finish`,
      { method: 'POST', body },
      parseFinishRunResponse,
    );
  }

  public getLeaderboard(): Promise<LeaderboardResponse> {
    return this.request('/api/leaderboard', { method: 'GET' }, parseLeaderboardResponse);
  }

  private async request<T>(
    path: string,
    options: RequestOptions,
    parseResponse: (value: unknown) => T,
  ): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutError = new LeaderboardApiError('timeout', '排行榜連線逾時，請稍後再試。');
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(timeoutError);
      }, this.timeoutMs);
    });

    const requestInit: RequestInit = {
      method: options.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'omit',
      cache: 'no-store',
      mode: 'same-origin',
      signal: controller.signal,
    };
    if (options.body !== undefined) requestInit.body = JSON.stringify(options.body);

    let response: Response;
    try {
      response = await Promise.race([this.fetchImplementation(path, requestInit), timeoutPromise]);
    } catch (error) {
      if (error instanceof LeaderboardApiError) throw error;
      if (timedOut || isAbortError(error)) throw timeoutError;
      throw new LeaderboardApiError('network_error', '目前無法連線排行榜，請確認網路後再試。', {
        cause: error,
      });
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const serverCode = await parseServerErrorCode(response);
      throw createHttpError(response.status, serverCode);
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('application/json')) throw invalidResponseError();

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch (error) {
      throw invalidResponseError(error);
    }

    try {
      return parseResponse(payload);
    } catch (error) {
      if (error instanceof LeaderboardApiError) throw error;
      throw invalidResponseError(error);
    }
  }
}

function getGlobalFetch(): LeaderboardFetch {
  if (typeof globalThis.fetch !== 'function') {
    throw new LeaderboardApiError(
      'network_error',
      '此瀏覽器不支援網路排行榜，請更新瀏覽器後再試。',
    );
  }
  return globalThis.fetch.bind(globalThis);
}

function encodeRunId(runId: string): string {
  if (!isNonEmptyTrimmedString(runId, RESPONSE_LIMITS.id)) {
    throw new LeaderboardApiError('invalid_request', '遊戲識別碼格式不正確，請重新開始。');
  }
  return encodeURIComponent(runId);
}

function normalizeCheckpointInput(input: RunCheckpointInput): RunCheckpointInput {
  if (!isNonEmptyTrimmedString(input.token, RESPONSE_LIMITS.token)) {
    throw new LeaderboardApiError('invalid_request', '遊戲驗證資料格式不正確，請重新開始。');
  }
  if (!isFiniteNonNegativeNumber(input.elapsedSeconds)) {
    throw new LeaderboardApiError('invalid_request', '遊戲經過時間格式不正確。');
  }
  if (!isNonNegativeSafeInteger(input.collectedRecoveryItems)) {
    throw new LeaderboardApiError('invalid_request', '恢復道具數量格式不正確。');
  }
  const energy = normalizeVital(input.energy);
  const injuryRisk = normalizeVital(input.injuryRisk);
  if (energy === null || injuryRisk === null) {
    throw new LeaderboardApiError(
      'invalid_request',
      '體力與受傷風險必須是 0～100 之間的有限數值。',
    );
  }

  return {
    token: input.token,
    elapsedSeconds: input.elapsedSeconds,
    collectedRecoveryItems: input.collectedRecoveryItems,
    energy,
    injuryRisk,
  };
}

function normalizeFinishRunInput(input: FinishRunInput): FinishRunInput {
  const checkpoint = normalizeCheckpointInput(input);
  const name = input.name.trim();
  if (name === '' || Array.from(name).length > RESPONSE_LIMITS.name) {
    throw new LeaderboardApiError('invalid_request', '暱稱必須是 1～12 個字。');
  }
  if (!isRunOutcome(input.outcome) || !isMarathonStageId(input.stageId)) {
    throw new LeaderboardApiError('invalid_request', '完賽結果格式不正確。');
  }

  return {
    ...checkpoint,
    name,
    outcome: input.outcome,
    stageId: input.stageId,
  };
}

function parseStartRunResponse(value: unknown): StartRunResponse {
  const root = exactRecord(value, ['run']);
  const run = exactRecord(root.run, ['id', 'token', 'expiresAt', 'rulesVersion']);

  return {
    run: {
      id: responseString(run.id, RESPONSE_LIMITS.id),
      token: responseString(run.token, RESPONSE_LIMITS.token),
      expiresAt: responseIsoTimestamp(run.expiresAt),
      rulesVersion: responseString(run.rulesVersion, RESPONSE_LIMITS.rulesVersion),
    },
  };
}

function parseCheckpointResponse(value: unknown): RunCheckpointResponse {
  const root = exactRecord(value, ['accepted']);
  if (root.accepted !== true) throw invalidResponseError();
  return { accepted: true };
}

function parseFinishRunResponse(value: unknown): FinishRunResponse {
  const root = exactRecord(value, ['entry', 'rank']);
  return {
    entry: parseLeaderboardEntry(root.entry),
    rank: responseNullableRank(root.rank),
  };
}

function parseLeaderboardResponse(value: unknown): LeaderboardResponse {
  const root = exactRecord(value, ['entries', 'updatedAt']);
  if (!Array.isArray(root.entries) || root.entries.length > RESPONSE_LIMITS.leaderboardEntries) {
    throw invalidResponseError();
  }

  const entries = root.entries.map((entry) => parseLeaderboardEntry(entry));
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw invalidResponseError();
  }

  return {
    entries,
    updatedAt: responseIsoTimestamp(root.updatedAt),
  };
}

function parseLeaderboardEntry(value: unknown): RemoteLeaderboardEntry {
  const entry = exactRecord(value, [
    'id',
    'name',
    'score',
    'distanceMeters',
    'outcome',
    'stageId',
    'healthBonus',
  ]);
  const outcome = entry.outcome;
  const stageId = entry.stageId;
  if (!isRunOutcome(outcome) || !isMarathonStageId(stageId)) throw invalidResponseError();

  return {
    id: responseString(entry.id, RESPONSE_LIMITS.id),
    name: responseString(entry.name, RESPONSE_LIMITS.name, true),
    score: responseNonNegativeInteger(entry.score),
    distanceMeters: responseNonNegativeInteger(
      entry.distanceMeters,
      RESPONSE_LIMITS.officialDistanceMeters,
    ),
    outcome,
    stageId,
    healthBonus: responseNullableNonNegativeInteger(entry.healthBonus, RESPONSE_LIMITS.healthBonus),
  };
}

function exactRecord(value: unknown, expectedKeys: readonly string[]): JsonRecord {
  if (!isRecord(value)) throw invalidResponseError();
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw invalidResponseError();
  }
  return value;
}

function responseString(value: unknown, maximumLength: number, countCharacters = false): string {
  if (typeof value !== 'string' || value.trim() === '') throw invalidResponseError();
  const length = countCharacters ? Array.from(value).length : value.length;
  if (length > maximumLength) throw invalidResponseError();
  return value;
}

function responseIsoTimestamp(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !ISO_8601_UTC_PATTERN.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw invalidResponseError();
  }
  return value;
}

function responseNonNegativeInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!isNonNegativeSafeInteger(value) || value > maximum) throw invalidResponseError();
  return value;
}

function responseNullableRank(value: unknown): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || typeof value !== 'number' || value < 1) {
    throw invalidResponseError();
  }
  return value;
}

function responseNullableNonNegativeInteger(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER,
): number | null {
  if (value === null) return null;
  return responseNonNegativeInteger(value, maximum);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyTrimmedString(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length > 0 &&
    value.length <= maximumLength
  );
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normalizeVital(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    return null;
  }
  return Math.round(value * 1_000) / 1_000;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRunOutcome(value: unknown): value is RunOutcome {
  return typeof value === 'string' && RUN_OUTCOMES.includes(value as RunOutcome);
}

function isMarathonStageId(value: unknown): value is MarathonStageId {
  return typeof value === 'string' && MARATHON_STAGE_IDS.includes(value as MarathonStageId);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function invalidResponseError(cause?: unknown): LeaderboardApiError {
  return new LeaderboardApiError(
    'invalid_response',
    '排行榜服務回傳了無法辨識的資料，請稍後再試。',
    { cause },
  );
}

async function parseServerErrorCode(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) return null;

  let text: string;
  try {
    text = await response.text();
  } catch {
    return null;
  }
  if (new TextEncoder().encode(text).byteLength > ERROR_RESPONSE_LIMITS.bodyBytes) return null;

  try {
    const root = JSON.parse(text) as unknown;
    if (!hasExactKeys(root, ['error'])) return null;
    const error = root.error;
    if (!hasExactKeys(error, ['code', 'message'])) return null;
    if (
      typeof error.code !== 'string' ||
      error.code.length > ERROR_RESPONSE_LIMITS.code ||
      !/^[A-Z][A-Z0-9_]*$/u.test(error.code) ||
      typeof error.message !== 'string' ||
      error.message.trim() === '' ||
      error.message.length > ERROR_RESPONSE_LIMITS.message
    ) {
      return null;
    }
    return error.code;
  } catch {
    return null;
  }
}

function hasExactKeys(value: unknown, expectedKeys: readonly string[]): value is JsonRecord {
  if (!isRecord(value)) return false;
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function createHttpError(status: number, serverCode: string | null): LeaderboardApiError {
  const presentation = serverCode === null ? undefined : SERVER_ERROR_PRESENTATIONS[serverCode];
  if (serverCode !== null && presentation?.statuses.includes(status)) {
    return new LeaderboardApiError(presentation.code, presentation.message, {
      status,
      serverCode,
    });
  }

  const options = { status, ...(serverCode === null ? {} : { serverCode }) };
  if (status === 400) {
    return new LeaderboardApiError(
      'bad_request',
      '排行榜收到的資料格式不正確，請重新開始後再試。',
      options,
    );
  }
  if (status === 401) {
    return new LeaderboardApiError('unauthorized', '這次遊戲驗證已失效，請重新開始後再試。', {
      ...options,
    });
  }
  if (status === 403) {
    return new LeaderboardApiError('forbidden', '這次成績無法提交，請重新挑戰。', options);
  }
  if (status === 404) {
    return new LeaderboardApiError('not_found', '找不到這次遊戲紀錄，請重新開始後再試。', {
      ...options,
    });
  }
  if (status === 408) {
    return new LeaderboardApiError('timeout', '排行榜連線逾時，請稍後再試。', options);
  }
  if (status === 409) {
    return new LeaderboardApiError('conflict', '這次遊戲已提交或已失效，請重新開始後再試。', {
      ...options,
    });
  }
  if (status === 422) {
    return new LeaderboardApiError('unprocessable', '這次成績未通過驗證，請重新挑戰。', options);
  }
  if (status === 429) {
    return new LeaderboardApiError('rate_limited', '提交次數過多，請稍後再試。', options);
  }
  if (status >= 500) {
    return new LeaderboardApiError('server_error', '排行榜服務暫時忙碌，請稍後再試。', {
      ...options,
    });
  }
  return new LeaderboardApiError('http_error', '排行榜請求失敗，請稍後再試。', {
    ...options,
  });
}
