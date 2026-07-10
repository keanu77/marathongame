import { GAME_CONFIG, MARATHON_CONFIG, type GameConfig } from '../config';
import { MARATHON_STAGE_IDS } from '../types';
import type {
  GameOverResult,
  LeaderboardAddResult,
  LeaderboardEntry,
  LeaderboardEntryInput,
  MarathonStageId,
  StorageLike,
} from '../types';

export interface LeaderboardEntryFactory {
  /** 測試或匯入流程可注入固定時間；預設使用 Date.now。 */
  now?: () => number;
  /** 測試可注入固定 ID；正式環境優先使用 crypto.randomUUID。 */
  createId?: () => string;
}

type LeaderboardOutcome = GameOverResult['outcome'];

function getBrowserStorage(): StorageLike | null {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return null;
    return globalThis.localStorage as StorageLike;
  } catch {
    return null;
  }
}

function clampInteger(value: number, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Math.floor(value)));
}

function clampDistance(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MARATHON_CONFIG.officialDistanceMeters, Math.max(0, Math.round(value)));
}

function truncateCharacters(value: string, maximumLength: number): string {
  return Array.from(value).slice(0, Math.max(0, maximumLength)).join('');
}

export function normalizeLeaderboardName(name: unknown, config: GameConfig = GAME_CONFIG): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed === '') return config.leaderboardDefaultName;
  return truncateCharacters(trimmed, config.leaderboardNameMaxLength);
}

function normalizeId(value: unknown, config: GameConfig): string | null {
  if (typeof value !== 'string') return null;
  const id = truncateCharacters(value.trim(), config.leaderboardIdMaxLength);
  return id === '' ? null : id;
}

function normalizeOutcome(value: unknown): LeaderboardOutcome | null {
  return value === 'completed' || value === 'stopped' ? value : null;
}

function normalizeStageId(value: unknown): MarathonStageId | null {
  return typeof value === 'string' && MARATHON_STAGE_IDS.includes(value as MarathonStageId)
    ? (value as MarathonStageId)
    : null;
}

function normalizeStoredNumber(value: unknown, maximum?: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return clampInteger(value, maximum);
}

function normalizeStoredDistance(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return clampDistance(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStoredEntry(
  value: unknown,
  config: GameConfig = GAME_CONFIG,
): LeaderboardEntry | null {
  if (!isRecord(value)) return null;

  const id = normalizeId(value.id, config);
  const score = normalizeStoredNumber(value.score);
  const distanceMeters = normalizeStoredDistance(value.distanceMeters);
  const outcome = normalizeOutcome(value.outcome);
  const stageId = normalizeStageId(value.stageId);
  const createdAt = normalizeStoredNumber(value.createdAt);

  if (
    id === null ||
    score === null ||
    distanceMeters === null ||
    outcome === null ||
    stageId === null ||
    createdAt === null
  ) {
    return null;
  }

  return {
    id,
    name: normalizeLeaderboardName(value.name, config),
    score,
    distanceMeters,
    outcome,
    stageId,
    createdAt,
  };
}

function compareDescending(left: number, right: number): number {
  if (left === right) return 0;
  return left > right ? -1 : 1;
}

function compareAscending(left: number, right: number): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * 排序優先序：分數、距離、完賽狀態、建立時間。最後以 ID 穩定破同分，
 * 不會修改傳入陣列。
 */
export function rankLeaderboardEntries(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((left, right) => {
    const scoreOrder = compareDescending(left.score, right.score);
    if (scoreOrder !== 0) return scoreOrder;

    const distanceOrder = compareDescending(left.distanceMeters, right.distanceMeters);
    if (distanceOrder !== 0) return distanceOrder;

    if (left.outcome !== right.outcome) return left.outcome === 'completed' ? -1 : 1;

    const timeOrder = compareAscending(left.createdAt, right.createdAt);
    if (timeOrder !== 0) return timeOrder;

    if (left.id === right.id) return 0;
    return left.id < right.id ? -1 : 1;
  });
}

function removeDuplicateIds(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  const ids = new Set<string>();
  return entries.filter((entry) => {
    if (ids.has(entry.id)) return false;
    ids.add(entry.id);
    return true;
  });
}

function limitLeaderboard(
  entries: readonly LeaderboardEntry[],
  config: GameConfig = GAME_CONFIG,
): LeaderboardEntry[] {
  return removeDuplicateIds(rankLeaderboardEntries(entries)).slice(0, config.leaderboardMaxEntries);
}

/** 損毀 JSON、非陣列資料、無效列與 storage 例外都安全視為空資料。 */
export function readLeaderboard(
  storage: StorageLike | null = getBrowserStorage(),
  config: GameConfig = GAME_CONFIG,
): LeaderboardEntry[] {
  if (storage === null) return [];

  try {
    const serialized = storage.getItem(config.leaderboardStorageKey);
    if (serialized === null || serialized.trim() === '') return [];

    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map((entry) => normalizeStoredEntry(entry, config))
      .filter((entry): entry is LeaderboardEntry => entry !== null);
    return limitLeaderboard(normalized, config);
  } catch {
    return [];
  }
}

function writeLeaderboard(
  entries: readonly LeaderboardEntry[],
  storage: StorageLike | null,
  config: GameConfig,
): boolean {
  if (storage === null) return false;

  try {
    storage.setItem(config.leaderboardStorageKey, JSON.stringify(entries));
    return true;
  } catch {
    // 本機儲存可能因無痕模式、權限或配額限制而失敗；遊戲仍可繼續。
    return false;
  }
}

function defaultId(createdAt: number): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // 部分瀏覽器環境可能禁止 crypto；下方使用非權威的本機 fallback。
  }

  return `${createdAt.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function getUniqueId(
  requestedId: string,
  entries: readonly LeaderboardEntry[],
  config: GameConfig,
): string {
  const normalized = normalizeId(requestedId, config) ?? `entry-${Date.now()}`;
  const usedIds = new Set(entries.map((entry) => entry.id));
  if (!usedIds.has(normalized)) return normalized;

  let suffix = 2;
  while (usedIds.has(`${normalized}-${suffix}`)) suffix += 1;
  const suffixText = `-${suffix}`;
  const base = truncateCharacters(normalized, config.leaderboardIdMaxLength - suffixText.length);
  return `${base}${suffixText}`;
}

/** 回傳 1 起算的名次；未列入傳入排行榜時回傳 null。 */
export function getLeaderboardRank(
  entries: readonly LeaderboardEntry[],
  entryId: string,
): number | null {
  const index = rankLeaderboardEntries(entries).findIndex((entry) => entry.id === entryId);
  return index < 0 ? null : index + 1;
}

/**
 * 加入一筆本機紀錄並只保存前十名。此資料可由使用者自行修改，不能作為
 * 競賽驗證、醫療判斷或權威成績來源。
 */
export function addLeaderboardEntry(
  input: LeaderboardEntryInput,
  storage: StorageLike | null = getBrowserStorage(),
  factory: LeaderboardEntryFactory = {},
  config: GameConfig = GAME_CONFIG,
): LeaderboardAddResult {
  const existing = readLeaderboard(storage, config);
  const createdAt = clampInteger(factory.now?.() ?? Date.now());
  const generatedId = factory.createId?.() ?? defaultId(createdAt);
  const entry: LeaderboardEntry = {
    id: getUniqueId(generatedId, existing, config),
    name: normalizeLeaderboardName(input.name, config),
    score: clampInteger(input.score),
    distanceMeters: clampDistance(input.distanceMeters),
    outcome: normalizeOutcome(input.outcome) ?? 'stopped',
    stageId: normalizeStageId(input.stageId) ?? 'base',
    createdAt,
  };
  const leaderboard = limitLeaderboard([...existing, entry], config);
  const rank = getLeaderboardRank(leaderboard, entry.id);

  const persisted = writeLeaderboard(leaderboard, storage, config);

  return { entry, leaderboard, rank, persisted };
}
