package handler

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"testing"

	_ "modernc.org/sqlite"
)

// newTestDB opens an in-memory SQLite DB, enables foreign keys, and applies the schema.
// Go tests run with cwd = package directory, so ../db/schema.sql resolves correctly at runtime.
func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("newTestDB: sql.Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		t.Fatalf("newTestDB: PRAGMA foreign_keys: %v", err)
	}

	schemaBytes, err := os.ReadFile("../db/schema.sql")
	if err != nil {
		t.Fatalf("newTestDB: read schema.sql: %v", err)
	}
	if _, err := db.Exec(string(schemaBytes)); err != nil {
		t.Fatalf("newTestDB: apply schema: %v", err)
	}
	return db
}

// newTestHandler creates a Handler backed by a fresh in-memory DB.
func newTestHandler(t *testing.T) (*Handler, *sql.DB) {
	t.Helper()
	db := newTestDB(t)
	return New(db), db
}

// seedLeague inserts a league + N teams (each with 4 members) into db.
// teamIDs must be provided; leagueID is the league's fixed ID.
func seedLeague(t *testing.T, db *sql.DB, leagueID string, teamIDs []string) {
	t.Helper()
	ctx := context.Background()

	_, err := db.ExecContext(ctx,
		`INSERT INTO leagues(id, name, points_win, points_draw, points_loss, tiebreakers)
		 VALUES(?,?,?,?,?,?)`,
		leagueID, "Test League", 3, 1, 0, `["head_to_head","goal_difference","goals_scored"]`,
	)
	if err != nil {
		t.Fatalf("seedLeague: insert league %s: %v", leagueID, err)
	}

	for i, teamID := range teamIDs {
		_, err = db.ExecContext(ctx,
			`INSERT INTO teams(id, league_id, name, color, sort_order) VALUES(?,?,?,?,?)`,
			teamID, leagueID, fmt.Sprintf("Team%d", i+1), "#ff0000", i+1,
		)
		if err != nil {
			t.Fatalf("seedLeague: insert team %s: %v", teamID, err)
		}
		for j := 1; j <= 4; j++ {
			_, err = db.ExecContext(ctx,
				`INSERT INTO members(team_id, name, sort_order) VALUES(?,?,?)`,
				teamID, fmt.Sprintf("Member%d-%d", i+1, j), j,
			)
			if err != nil {
				t.Fatalf("seedLeague: insert member team=%s seq=%d: %v", teamID, j, err)
			}
		}
	}
}

// ptr returns a pointer to v.
func ptr[T any](v T) *T {
	return &v
}
