import { ApiError } from './http';

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

export function createRunToken(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export function assertRunTokenFormat(token: unknown): asserts token is string {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    throw new ApiError(401, 'INVALID_RUN_TOKEN', '跑局憑證無效。');
  }
}

export function timingSafeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function createDailyRateKey(
  request: Request,
  secret: string | undefined,
  nowMs: number,
): Promise<string> {
  if (!secret || secret.length < 24) {
    throw new ApiError(500, 'SERVER_NOT_CONFIGURED', '排行榜安全設定尚未完成。');
  }

  const rawIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${day}\0${rawIp}`),
  );
  return bytesToHex(new Uint8Array(signature));
}
