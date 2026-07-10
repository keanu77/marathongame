import { GAME_CONFIG, MARATHON_CONFIG } from '../config';
import type { LeaderboardEntry, StorageLike } from '../types';
import {
  addLeaderboardEntry,
  getLeaderboardRank,
  normalizeLeaderboardName,
  rankLeaderboardEntries,
  readLeaderboard,
} from './leaderboardStorage';

function createMemoryStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function createEntry(id: string, overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    id,
    name: id,
    score: 100,
    distanceMeters: 1_000,
    outcome: 'stopped',
    stageId: 'build',
    createdAt: 100,
    ...overrides,
  };
}

describe('本機排行榜名稱與新增', () => {
  it('暱稱會 trim、以 Unicode 字元截成 12 字，空白則使用匿名跑者', () => {
    expect(normalizeLeaderboardName('  小明跑者  ')).toBe('小明跑者');
    expect(normalizeLeaderboardName('跑'.repeat(13))).toBe('跑'.repeat(12));
    expect(normalizeLeaderboardName('   ')).toBe('匿名跑者');
    expect(normalizeLeaderboardName(undefined)).toBe('匿名跑者');
  });

  it('新增資料包含完整模型、注入的時間與 ID，並寫入設定檔指定的 key', () => {
    const storage = createMemoryStorage();
    const result = addLeaderboardEntry(
      {
        name: '  阿山  ',
        score: 1_234.9,
        distanceMeters: 12_345.6,
        outcome: 'completed',
        stageId: 'race',
      },
      storage,
      { now: () => 1_700_000_000_000, createId: () => 'run-001' },
    );

    expect(result.entry).toEqual({
      id: 'run-001',
      name: '阿山',
      score: 1_234,
      distanceMeters: 12_346,
      outcome: 'completed',
      stageId: 'race',
      createdAt: 1_700_000_000_000,
    });
    expect(result.rank).toBe(1);
    expect(result.persisted).toBe(true);
    expect(storage.values.has(GAME_CONFIG.leaderboardStorageKey)).toBe(true);
    expect(readLeaderboard(storage)).toEqual([result.entry]);
  });

  it('重複 ID 會產生唯一後綴，不覆蓋既有紀錄', () => {
    const storage = createMemoryStorage();
    const input = {
      name: '跑者',
      score: 100,
      distanceMeters: 1_000,
      outcome: 'stopped' as const,
      stageId: 'base' as const,
    };

    const first = addLeaderboardEntry(input, storage, {
      now: () => 1,
      createId: () => 'same-id',
    });
    const second = addLeaderboardEntry(input, storage, {
      now: () => 2,
      createId: () => 'same-id',
    });

    expect(first.entry.id).toBe('same-id');
    expect(second.entry.id).toBe('same-id-2');
    expect(readLeaderboard(storage)).toHaveLength(2);
  });
});

describe('排行榜排序與前十名', () => {
  it('依分數、距離、completed、較早 createdAt 的順序排名', () => {
    const entries = [
      createEntry('stopped-early'),
      createEntry('completed-late', { outcome: 'completed', createdAt: 200 }),
      createEntry('farther', { distanceMeters: 1_100 }),
      createEntry('completed-early', { outcome: 'completed', createdAt: 50 }),
      createEntry('highest', { score: 200, distanceMeters: 10 }),
    ];
    const originalOrder = entries.map((entry) => entry.id);

    const ranked = rankLeaderboardEntries(entries);

    expect(ranked.map((entry) => entry.id)).toEqual([
      'highest',
      'farther',
      'completed-early',
      'completed-late',
      'stopped-early',
    ]);
    expect(entries.map((entry) => entry.id)).toEqual(originalOrder);
    expect(getLeaderboardRank(entries, 'completed-early')).toBe(3);
    expect(getLeaderboardRank(entries, 'missing')).toBeNull();
  });

  it('只保存前 10 名，未進榜的新紀錄 rank 為 null', () => {
    const storage = createMemoryStorage();

    for (let score = 1; score <= 12; score += 1) {
      addLeaderboardEntry(
        {
          name: `跑者 ${score}`,
          score,
          distanceMeters: score,
          outcome: 'stopped',
          stageId: 'base',
        },
        storage,
        { now: () => score, createId: () => `id-${score}` },
      );
    }

    expect(readLeaderboard(storage).map((entry) => entry.score)).toEqual([
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
    ]);

    const outside = addLeaderboardEntry(
      {
        name: '未進榜',
        score: 0,
        distanceMeters: 0,
        outcome: 'stopped',
        stageId: 'base',
      },
      storage,
      { now: () => 99, createId: () => 'outside' },
    );

    expect(outside.leaderboard).toHaveLength(GAME_CONFIG.leaderboardMaxEntries);
    expect(outside.rank).toBeNull();
    expect(readLeaderboard(storage).some((entry) => entry.id === 'outside')).toBe(false);
  });
});

describe('損毀與惡意 localStorage 資料', () => {
  it('JSON 損毀、非陣列資料與讀取例外皆安全回傳空陣列', () => {
    const storage = createMemoryStorage();

    storage.values.set(GAME_CONFIG.leaderboardStorageKey, '{broken');
    expect(readLeaderboard(storage)).toEqual([]);

    storage.values.set(GAME_CONFIG.leaderboardStorageKey, JSON.stringify({ entries: [] }));
    expect(readLeaderboard(storage)).toEqual([]);

    const throwingStorage: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
    };
    expect(readLeaderboard(throwingStorage)).toEqual([]);
  });

  it('忽略無效列，並 clamp 數值、距離、時間與名稱', () => {
    const storage = createMemoryStorage();
    storage.values.set(
      GAME_CONFIG.leaderboardStorageKey,
      JSON.stringify([
        {
          id: 'clamped',
          name: '   ',
          score: -50,
          distanceMeters: -10,
          outcome: 'stopped',
          stageId: 'base',
          createdAt: -20,
        },
        {
          id: 'huge',
          name: '超'.repeat(30),
          score: 1e100,
          distanceMeters: 1e100,
          outcome: 'completed',
          stageId: 'race',
          createdAt: 1e100,
        },
        {
          id: 'invalid-stage',
          name: 'X',
          score: 10,
          distanceMeters: 10,
          outcome: 'stopped',
          stageId: 'unknown',
          createdAt: 10,
        },
        {
          id: 'invalid-score',
          name: 'X',
          score: '999',
          distanceMeters: 10,
          outcome: 'stopped',
          stageId: 'base',
          createdAt: 10,
        },
      ]),
    );

    const entries = readLeaderboard(storage);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      id: 'huge',
      name: '超'.repeat(12),
      score: Number.MAX_SAFE_INTEGER,
      distanceMeters: MARATHON_CONFIG.officialDistanceMeters,
      outcome: 'completed',
      stageId: 'race',
      createdAt: Number.MAX_SAFE_INTEGER,
    });
    expect(entries[1]).toEqual({
      id: 'clamped',
      name: GAME_CONFIG.leaderboardDefaultName,
      score: 0,
      distanceMeters: 0,
      outcome: 'stopped',
      stageId: 'base',
      createdAt: 0,
    });
  });

  it('重複 ID 只保留排序較佳的安全紀錄', () => {
    const storage = createMemoryStorage();
    storage.values.set(
      GAME_CONFIG.leaderboardStorageKey,
      JSON.stringify([
        createEntry('duplicate', { score: 10 }),
        createEntry('duplicate', { score: 20 }),
      ]),
    );

    expect(readLeaderboard(storage)).toEqual([createEntry('duplicate', { score: 20 })]);
  });
});

describe('儲存失敗狀態', () => {
  const input = {
    name: '本機跑者',
    score: 100,
    distanceMeters: 1_000,
    outcome: 'stopped' as const,
    stageId: 'base' as const,
  };

  it('storage 為 null 時仍回傳記憶體結果，但 persisted 為 false', () => {
    const result = addLeaderboardEntry(input, null, {
      now: () => 1,
      createId: () => 'memory-only',
    });

    expect(result.leaderboard).toEqual([result.entry]);
    expect(result.rank).toBe(1);
    expect(result.persisted).toBe(false);
  });

  it('setItem 例外不會中斷遊戲，且 persisted 為 false', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };

    const result = addLeaderboardEntry(input, storage, {
      now: () => 1,
      createId: () => 'not-written',
    });

    expect(result.entry.id).toBe('not-written');
    expect(result.persisted).toBe(false);
  });
});
