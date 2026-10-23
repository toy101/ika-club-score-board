ALTER TABLE leagues ADD COLUMN scoring_mode TEXT NOT NULL DEFAULT 'match_points'
    CHECK(scoring_mode IN ('match_points', 'game_wins'));
ALTER TABLE leagues ADD COLUMN best_of INTEGER NOT NULL DEFAULT 3
    CHECK(best_of IN (3, 5));
ALTER TABLE leagues ADD COLUMN points_per_game_win INTEGER NOT NULL DEFAULT 1
    CHECK(points_per_game_win >= 1);
