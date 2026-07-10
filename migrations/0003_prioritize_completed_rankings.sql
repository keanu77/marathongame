DROP INDEX IF EXISTS leaderboard_entries_ranking;

CREATE INDEX leaderboard_entries_ranking
  ON leaderboard_entries (
    outcome ASC,
    score DESC,
    distance_meters DESC,
    created_at_ms ASC,
    run_id ASC
  );
