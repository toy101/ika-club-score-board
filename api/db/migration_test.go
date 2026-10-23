package db

import (
	"database/sql"
	_ "embed"
	"testing"

	_ "modernc.org/sqlite"
)

//go:embed migrations/001_add_series_scoring.sql
var addSeriesScoringMigration string

func TestAddSeriesScoringMigrationPreservesLegacyDefaults(t *testing.T) {
	database, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer database.Close()

	if _, err := database.Exec(`
		CREATE TABLE leagues (
			id TEXT NOT NULL PRIMARY KEY,
			name TEXT NOT NULL,
			points_win INTEGER NOT NULL DEFAULT 3,
			points_draw INTEGER NOT NULL DEFAULT 1,
			points_loss INTEGER NOT NULL DEFAULT 0,
			tiebreakers TEXT NOT NULL DEFAULT 'head_to_head'
		);
		INSERT INTO leagues(id, name) VALUES('legacy', 'Legacy League');
	`); err != nil {
		t.Fatalf("create legacy schema: %v", err)
	}
	if _, err := database.Exec(addSeriesScoringMigration); err != nil {
		t.Fatalf("apply migration: %v", err)
	}

	var scoringMode string
	var bestOf, pointsPerGameWin int
	if err := database.QueryRow(
		`SELECT scoring_mode, best_of, points_per_game_win FROM leagues WHERE id='legacy'`,
	).Scan(&scoringMode, &bestOf, &pointsPerGameWin); err != nil {
		t.Fatalf("read migrated league: %v", err)
	}
	if scoringMode != "match_points" || bestOf != 3 || pointsPerGameWin != 1 {
		t.Fatalf("unexpected defaults: %s, %d, %d", scoringMode, bestOf, pointsPerGameWin)
	}
}
