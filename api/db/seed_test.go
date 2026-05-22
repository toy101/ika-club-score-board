package db

import (
	"context"
	"database/sql"
	_ "embed"
	"testing"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var testSchemaDB string

// newTestDB opens an in-memory SQLite DB, enables foreign keys, and applies the schema.
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
	if _, err := db.Exec(testSchemaDB); err != nil {
		t.Fatalf("newTestDB: apply schema: %v", err)
	}
	return db
}

// ---------- ParseSeedMode ----------

func TestParseSeedMode(t *testing.T) {
	tests := []struct {
		input string
		want  SeedMode
	}{
		{"", SeedIfEmpty},
		{"if-empty", SeedIfEmpty},
		{"off", SeedOff},
		{"force", SeedForce},
		{"weird", SeedIfEmpty}, // unknown falls back to SeedIfEmpty
	}
	for _, tc := range tests {
		got := ParseSeedMode(tc.input)
		if got != tc.want {
			t.Errorf("ParseSeedMode(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

// ---------- Seed: Off ----------

func TestSeed_Off(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	if err := Seed(ctx, db, SeedOff); err != nil {
		t.Fatalf("Seed(SeedOff) error: %v", err)
	}

	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM leagues`).Scan(&count); err != nil {
		t.Fatalf("count leagues: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected 0 leagues after SeedOff, got %d", count)
	}
}

// ---------- Seed: IfEmpty on empty DB ----------

func TestSeed_IfEmpty_OnEmptyDB(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	if err := Seed(ctx, db, SeedIfEmpty); err != nil {
		t.Fatalf("Seed(SeedIfEmpty) error: %v", err)
	}

	var leagueCount, teamCount, memberCount, matchCount int

	if err := db.QueryRow(`SELECT COUNT(*) FROM leagues`).Scan(&leagueCount); err != nil {
		t.Fatalf("count leagues: %v", err)
	}
	if leagueCount != 1 {
		t.Fatalf("expected 1 league, got %d", leagueCount)
	}

	if err := db.QueryRow(`SELECT COUNT(*) FROM teams`).Scan(&teamCount); err != nil {
		t.Fatalf("count teams: %v", err)
	}
	if teamCount != 4 {
		t.Fatalf("expected 4 teams, got %d", teamCount)
	}

	if err := db.QueryRow(`SELECT COUNT(*) FROM members`).Scan(&memberCount); err != nil {
		t.Fatalf("count members: %v", err)
	}
	if memberCount != 16 {
		t.Fatalf("expected 16 members, got %d", memberCount)
	}

	if err := db.QueryRow(`SELECT COUNT(*) FROM matches`).Scan(&matchCount); err != nil {
		t.Fatalf("count matches: %v", err)
	}
	if matchCount != 8 {
		t.Fatalf("expected 8 matches, got %d", matchCount)
	}
}

// ---------- Seed: IfEmpty on non-empty DB ----------

func TestSeed_IfEmpty_OnNonEmptyDB(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	// Pre-insert a stub league so the DB is non-empty
	_, err := db.Exec(
		`INSERT INTO leagues(id, name, points_win, points_draw, points_loss, tiebreakers) VALUES(?,?,?,?,?,?)`,
		"stub-league-id", "Stub League", 3, 1, 0, `["head_to_head"]`,
	)
	if err != nil {
		t.Fatalf("insert stub league: %v", err)
	}

	if err := Seed(ctx, db, SeedIfEmpty); err != nil {
		t.Fatalf("Seed(SeedIfEmpty) on non-empty error: %v", err)
	}

	// The fixed test-league row must NOT have been added
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM leagues WHERE id=?`, seedLeagueID).Scan(&count); err != nil {
		t.Fatalf("count test league: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected 0 rows for test league ID (no-op), got %d", count)
	}

	// Total leagues = just the stub
	if err := db.QueryRow(`SELECT COUNT(*) FROM leagues`).Scan(&count); err != nil {
		t.Fatalf("count all leagues: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 league total, got %d", count)
	}
}

// ---------- Seed: Force ----------

func TestSeed_Force_ReplacesExisting(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	// Seed once with Force
	if err := Seed(ctx, db, SeedForce); err != nil {
		t.Fatalf("first Seed(SeedForce) error: %v", err)
	}

	var count1 int
	if err := db.QueryRow(`SELECT COUNT(*) FROM leagues`).Scan(&count1); err != nil {
		t.Fatalf("count leagues after first seed: %v", err)
	}

	// Seed again with Force — should delete and reinsert; no duplication
	if err := Seed(ctx, db, SeedForce); err != nil {
		t.Fatalf("second Seed(SeedForce) error: %v", err)
	}

	var leagueCount, teamCount, memberCount, matchCount int

	if err := db.QueryRow(`SELECT COUNT(*) FROM leagues`).Scan(&leagueCount); err != nil {
		t.Fatalf("count leagues: %v", err)
	}
	if leagueCount != 1 {
		t.Fatalf("expected 1 league after double SeedForce, got %d", leagueCount)
	}

	if err := db.QueryRow(`SELECT COUNT(*) FROM teams`).Scan(&teamCount); err != nil {
		t.Fatalf("count teams: %v", err)
	}
	if teamCount != 4 {
		t.Fatalf("expected 4 teams, got %d", teamCount)
	}

	if err := db.QueryRow(`SELECT COUNT(*) FROM members`).Scan(&memberCount); err != nil {
		t.Fatalf("count members: %v", err)
	}
	if memberCount != 16 {
		t.Fatalf("expected 16 members, got %d", memberCount)
	}

	if err := db.QueryRow(`SELECT COUNT(*) FROM matches`).Scan(&matchCount); err != nil {
		t.Fatalf("count matches: %v", err)
	}
	if matchCount != 8 {
		t.Fatalf("expected 8 matches, got %d", matchCount)
	}
}
