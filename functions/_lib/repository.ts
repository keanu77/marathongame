import type { MarathonStageId } from '../../src/game/types';
import type { NetworkRunOutcome } from '../../src/shared/networkLeaderboardRules';

import type { D1DatabaseLike } from './types';

export interface RunRow {
  id: string;
  token_hash: string;
  rules_version: string;
  issued_at_ms: number;
  expires_at_ms: number;
  status: 'issued' | 'submitted';
  checkpoint_elapsed_seconds: number | null;
  checkpoint_items: number | null;
  checkpoint_at_ms: number | null;
}

export interface EntryRow {
  id: string;
  name: string;
  score: number;
  distance_meters: number;
  outcome: NetworkRunOutcome;
  stage_id: MarathonStageId;
  created_at_ms: number;
}

export interface NewEntry {
  id: string;
  name: string;
  score: number;
  distanceMeters: number;
  elapsedSeconds: number;
  collectedRecoveryItems: number;
  outcome: NetworkRunOutcome;
  stageId: MarathonStageId;
  createdAtMs: number;
}

export async function incrementStartRate(
  db: D1DatabaseLike,
  keyHash: string,
  windowStartMs: number,
): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO rate_limit_counters (key_hash, route, window_start_ms, request_count)
       VALUES (?, 'run-start', ?, 1)
       ON CONFLICT (key_hash, route, window_start_ms)
       DO UPDATE SET request_count = request_count + 1
       RETURNING request_count`,
    )
    .bind(keyHash, windowStartMs)
    .first<{ request_count: number }>();
  return row?.request_count ?? 1;
}

export async function pruneOldRateCounters(db: D1DatabaseLike, olderThanMs: number): Promise<void> {
  await db
    .prepare('DELETE FROM rate_limit_counters WHERE window_start_ms < ?')
    .bind(olderThanMs)
    .run();
}

export async function pruneAbandonedRuns(
  db: D1DatabaseLike,
  expiredBeforeMs: number,
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM leaderboard_runs
       WHERE status = 'issued' AND expires_at_ms < ?`,
    )
    .bind(expiredBeforeMs)
    .run();
}

export async function insertRun(
  db: D1DatabaseLike,
  input: {
    id: string;
    tokenHash: string;
    rulesVersion: string;
    issuedAtMs: number;
    expiresAtMs: number;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO leaderboard_runs
       (id, token_hash, rules_version, issued_at_ms, expires_at_ms, status)
       VALUES (?, ?, ?, ?, ?, 'issued')`,
    )
    .bind(input.id, input.tokenHash, input.rulesVersion, input.issuedAtMs, input.expiresAtMs)
    .run();
}

export function getRun(db: D1DatabaseLike, id: string): Promise<RunRow | null> {
  return db
    .prepare(
      `SELECT id, token_hash, rules_version, issued_at_ms, expires_at_ms, status,
              checkpoint_elapsed_seconds, checkpoint_items, checkpoint_at_ms
       FROM leaderboard_runs WHERE id = ?`,
    )
    .bind(id)
    .first<RunRow>();
}

export async function updateCheckpoint(
  db: D1DatabaseLike,
  input: {
    id: string;
    elapsedSeconds: number;
    collectedRecoveryItems: number;
    receivedAtMs: number;
  },
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE leaderboard_runs
       SET checkpoint_elapsed_seconds = ?, checkpoint_items = ?, checkpoint_at_ms = ?
       WHERE id = ? AND status = 'issued'
         AND (checkpoint_elapsed_seconds IS NULL OR checkpoint_elapsed_seconds < ?)
         AND (checkpoint_items IS NULL OR checkpoint_items <= ?)`,
    )
    .bind(
      input.elapsedSeconds,
      input.collectedRecoveryItems,
      input.receivedAtMs,
      input.id,
      input.elapsedSeconds,
      input.collectedRecoveryItems,
    )
    .run();
  return result.meta?.changes === 1;
}

export async function commitFinishedRun(
  db: D1DatabaseLike,
  entry: NewEntry,
  fingerprint: string,
): Promise<boolean> {
  const statements = [
    db
      .prepare(
        `UPDATE leaderboard_runs
         SET status = 'submitted', submitted_at_ms = ?, finish_fingerprint = ?
         WHERE id = ? AND status = 'issued'`,
      )
      .bind(entry.createdAtMs, fingerprint, entry.id),
    db
      .prepare(
        `INSERT INTO leaderboard_entries
         (run_id, name, score, distance_meters, elapsed_seconds, collected_items,
          outcome, stage_id, created_at_ms)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM leaderboard_runs
           WHERE id = ? AND status = 'submitted' AND finish_fingerprint = ?
         )
           AND NOT EXISTS (
             SELECT 1 FROM leaderboard_entries WHERE run_id = ?
           )`,
      )
      .bind(
        entry.id,
        entry.name,
        entry.score,
        entry.distanceMeters,
        entry.elapsedSeconds,
        entry.collectedRecoveryItems,
        entry.outcome,
        entry.stageId,
        entry.createdAtMs,
        entry.id,
        fingerprint,
        entry.id,
      ),
  ];

  const [updateResult, insertResult] = await db.batch(statements);
  return updateResult?.meta?.changes === 1 && insertResult?.meta?.changes === 1;
}

export async function getEntryRank(db: D1DatabaseLike, id: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT rank FROM (
         SELECT run_id,
                ROW_NUMBER() OVER (
                  ORDER BY score DESC,
                           distance_meters DESC,
                           outcome ASC,
                           created_at_ms ASC,
                           run_id ASC
                ) AS rank
         FROM leaderboard_entries
       ) WHERE run_id = ?`,
    )
    .bind(id)
    .first<{ rank: number }>();
  return row?.rank ?? 0;
}

export async function listLeaderboard(db: D1DatabaseLike, limit: number): Promise<EntryRow[]> {
  const result = await db
    .prepare(
      `SELECT run_id AS id, name, score, distance_meters, outcome, stage_id, created_at_ms
       FROM leaderboard_entries
       ORDER BY score DESC,
                distance_meters DESC,
                outcome ASC,
                created_at_ms ASC,
                run_id ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<EntryRow>();
  return result.results;
}
