import { MAX_JSON_BODY_BYTES } from '../../src/shared/networkLeaderboardRules';

import type { Env } from './types';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly headers: HeadersInit = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function apiHeaders(cacheControl: string): Headers {
  return new Headers({
    'Cache-Control': cacheControl,
    'Content-Type': 'application/json; charset=utf-8',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
}

export function jsonResponse(
  body: unknown,
  status = 200,
  options: { cacheControl?: string; headers?: HeadersInit } = {},
): Response {
  const headers = apiHeaders(options.cacheControl ?? 'no-store');
  if (options.headers) {
    new Headers(options.headers).forEach((value, key) => headers.set(key, value));
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    const body: ApiErrorBody = { error: { code: error.code, message: error.message } };
    return jsonResponse(body, error.status, { headers: error.headers });
  }

  console.error('Unhandled leaderboard API error', error);
  return jsonResponse(
    { error: { code: 'INTERNAL_ERROR', message: '排行榜服務暫時無法使用，請稍後再試。' } },
    500,
  );
}

export async function withApiErrors(operation: () => Promise<Response>): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    return errorResponse(error);
  }
}

export function assertSameOrigin(request: Request, env: Env): void {
  const origin = request.headers.get('Origin');
  const requestUrl = new URL(request.url);
  const localHostnames = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);
  const expectedOrigin = localHostnames.has(requestUrl.hostname)
    ? requestUrl.origin
    : env.ALLOWED_ORIGIN?.trim() || requestUrl.origin;
  if (origin === null || origin === 'null' || origin !== expectedOrigin) {
    throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', '只接受遊戲網站送出的同源請求。');
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new ApiError(415, 'JSON_REQUIRED', '請以 application/json 傳送資料。');
  }

  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', '請求內容超過允許大小。');
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', '請求內容超過允許大小。');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'JSON 格式不正確。');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ApiError(400, 'INVALID_BODY', '請求內容必須是 JSON 物件。');
  }
  return parsed as Record<string, unknown>;
}

export function assertOnlyKeys(body: Record<string, unknown>, keys: readonly string[]): void {
  const allowed = new Set(keys);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new ApiError(400, 'UNKNOWN_FIELD', '請求包含未支援的欄位。');
  }
}

export function getRouteId(params: PagesContextParams): string {
  const value = params.id;
  const id = Array.isArray(value) ? value[0] : value;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/iu.test(id)) {
    throw new ApiError(400, 'INVALID_RUN_ID', '跑局識別碼格式不正確。');
  }
  return id;
}

type PagesContextParams = Record<string, string | string[]>;
