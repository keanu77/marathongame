ALTER TABLE leaderboard_runs
  ADD COLUMN checkpoint_energy REAL
    CHECK (checkpoint_energy IS NULL OR checkpoint_energy BETWEEN 0 AND 100);

ALTER TABLE leaderboard_runs
  ADD COLUMN checkpoint_injury_risk REAL
    CHECK (
      checkpoint_injury_risk IS NULL OR checkpoint_injury_risk BETWEEN 0 AND 100
    );

ALTER TABLE leaderboard_entries
  ADD COLUMN final_energy REAL
    CHECK (final_energy IS NULL OR final_energy BETWEEN 0 AND 100);

ALTER TABLE leaderboard_entries
  ADD COLUMN final_injury_risk REAL
    CHECK (final_injury_risk IS NULL OR final_injury_risk BETWEEN 0 AND 100);

ALTER TABLE leaderboard_entries
  ADD COLUMN health_bonus INTEGER
    CHECK (health_bonus IS NULL OR health_bonus >= 0);

-- 新制需要終點體力與受傷風險；舊成績沒有這些資料，無法可靠回推。
-- 先刪除對外榜單，再清除舊規則的未完成 run，讓 2026-s2 公平重新起跑。
DELETE FROM leaderboard_entries;
DELETE FROM leaderboard_runs;
