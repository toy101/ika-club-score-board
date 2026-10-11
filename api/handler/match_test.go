package handler

import (
	"context"
	"testing"

	"ika-club-score-board/api/gen"
)

// ---------- ListMatches ----------

func TestListMatches_UnknownLeague(t *testing.T) {
	h, _ := newTestHandler(t)
	ctx := context.Background()

	resp, err := h.ListMatches(ctx, gen.ListMatchesRequestObject{LeagueId: "nonexistent"})
	if err != nil {
		t.Fatalf("ListMatches error: %v", err)
	}
	if _, ok := resp.(gen.ListMatches404JSONResponse); !ok {
		t.Fatalf("expected ListMatches404JSONResponse, got %T", resp)
	}
}

func TestListMatches_Empty(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.ListMatches(ctx, gen.ListMatchesRequestObject{LeagueId: testLeagueID})
	if err != nil {
		t.Fatalf("ListMatches error: %v", err)
	}
	r, ok := resp.(gen.ListMatches200JSONResponse)
	if !ok {
		t.Fatalf("expected ListMatches200JSONResponse, got %T", resp)
	}
	if len(r) != 0 {
		t.Fatalf("expected 0 matches, got %d", len(r))
	}
}

func TestListMatches_OrderedByRowid(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	// Insert two matches in order
	_, err := db.Exec(
		`INSERT INTO matches(id, league_id, home_team_id, away_team_id, home_score, away_score) VALUES(?,?,?,?,?,?)`,
		"match-first", testLeagueID, testTeamID1, testTeamID2, 2, 1,
	)
	if err != nil {
		t.Fatalf("insert first match: %v", err)
	}
	_, err = db.Exec(
		`INSERT INTO matches(id, league_id, home_team_id, away_team_id, home_score, away_score) VALUES(?,?,?,?,?,?)`,
		"match-second", testLeagueID, testTeamID2, testTeamID1, 0, 0,
	)
	if err != nil {
		t.Fatalf("insert second match: %v", err)
	}

	resp, err := h.ListMatches(ctx, gen.ListMatchesRequestObject{LeagueId: testLeagueID})
	if err != nil {
		t.Fatalf("ListMatches error: %v", err)
	}
	r, ok := resp.(gen.ListMatches200JSONResponse)
	if !ok {
		t.Fatalf("expected ListMatches200JSONResponse, got %T", resp)
	}
	if len(r) != 2 {
		t.Fatalf("expected 2 matches, got %d", len(r))
	}
	if r[0].Id != "match-first" {
		t.Fatalf("expected first match id 'match-first', got %q", r[0].Id)
	}
	if r[1].Id != "match-second" {
		t.Fatalf("expected second match id 'match-second', got %q", r[1].Id)
	}
}

// ---------- CreateMatch ----------

func TestCreateMatch_UnknownLeague(t *testing.T) {
	h, _ := newTestHandler(t)
	ctx := context.Background()

	resp, err := h.CreateMatch(ctx, gen.CreateMatchRequestObject{
		LeagueId: "nonexistent",
		Body: &gen.MatchCreateRequest{
			HomeTeamId: testTeamID1,
			AwayTeamId: testTeamID2,
			HomeScore:  1,
			AwayScore:  0,
		},
	})
	if err != nil {
		t.Fatalf("CreateMatch error: %v", err)
	}
	if _, ok := resp.(gen.CreateMatch404JSONResponse); !ok {
		t.Fatalf("expected CreateMatch404JSONResponse, got %T", resp)
	}
}

func TestCreateMatch_SameTeam(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.CreateMatch(ctx, gen.CreateMatchRequestObject{
		LeagueId: testLeagueID,
		Body: &gen.MatchCreateRequest{
			HomeTeamId: testTeamID1,
			AwayTeamId: testTeamID1,
			HomeScore:  1,
			AwayScore:  0,
		},
	})
	if err != nil {
		t.Fatalf("CreateMatch error: %v", err)
	}
	r, ok := resp.(gen.CreateMatch422JSONResponse)
	if !ok {
		t.Fatalf("expected CreateMatch422JSONResponse, got %T", resp)
	}
	if r.Message != "homeTeamId and awayTeamId must differ" {
		t.Fatalf("expected 'homeTeamId and awayTeamId must differ', got %q", r.Message)
	}
}

func TestCreateMatch_Success(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.CreateMatch(ctx, gen.CreateMatchRequestObject{
		LeagueId: testLeagueID,
		Body: &gen.MatchCreateRequest{
			HomeTeamId: testTeamID1,
			AwayTeamId: testTeamID2,
			HomeScore:  3,
			AwayScore:  1,
		},
	})
	if err != nil {
		t.Fatalf("CreateMatch error: %v", err)
	}
	r, ok := resp.(gen.CreateMatch201JSONResponse)
	if !ok {
		t.Fatalf("expected CreateMatch201JSONResponse, got %T", resp)
	}
	if r.HomeScore != 3 {
		t.Fatalf("expected HomeScore=3, got %d", r.HomeScore)
	}
	if r.AwayScore != 1 {
		t.Fatalf("expected AwayScore=1, got %d", r.AwayScore)
	}
	if r.HomeTeamId != testTeamID1 {
		t.Fatalf("expected HomeTeamId=%q, got %q", testTeamID1, r.HomeTeamId)
	}
	if r.Id == "" {
		t.Fatal("expected non-empty match ID")
	}

	// Verify row in DB
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM matches WHERE id=?`, r.Id).Scan(&count); err != nil {
		t.Fatalf("count matches: %v", err)
	}
	if count != 1 {
		t.Fatal("expected match row to exist")
	}
}

func TestCreateMatch_UniqueConstraint(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	body := &gen.MatchCreateRequest{
		HomeTeamId: testTeamID1,
		AwayTeamId: testTeamID2,
		HomeScore:  1,
		AwayScore:  0,
	}

	// First insert succeeds
	resp1, err := h.CreateMatch(ctx, gen.CreateMatchRequestObject{LeagueId: testLeagueID, Body: body})
	if err != nil {
		t.Fatalf("first CreateMatch error: %v", err)
	}
	if _, ok := resp1.(gen.CreateMatch201JSONResponse); !ok {
		t.Fatalf("expected CreateMatch201JSONResponse on first insert, got %T", resp1)
	}

	// Second insert with same (league, home, away) must return an error (UNIQUE violation)
	_, err = h.CreateMatch(ctx, gen.CreateMatchRequestObject{LeagueId: testLeagueID, Body: body})
	if err == nil {
		t.Fatal("expected error on duplicate (league, home, away) insert, got nil")
	}
}

// ---------- UpdateMatch ----------

func TestUpdateMatch_NotFound(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.UpdateMatch(ctx, gen.UpdateMatchRequestObject{
		LeagueId: testLeagueID,
		MatchId:  "nonexistent",
		Body:     &gen.MatchUpdateRequest{HomeScore: ptr(5)},
	})
	if err != nil {
		t.Fatalf("UpdateMatch error: %v", err)
	}
	if _, ok := resp.(gen.UpdateMatch404JSONResponse); !ok {
		t.Fatalf("expected UpdateMatch404JSONResponse, got %T", resp)
	}
}

func TestUpdateMatch_HomeScoreOnly(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	// Seed a match
	_, err := db.Exec(
		`INSERT INTO matches(id, league_id, home_team_id, away_team_id, home_score, away_score) VALUES(?,?,?,?,?,?)`,
		"match-upd", testLeagueID, testTeamID1, testTeamID2, 1, 2,
	)
	if err != nil {
		t.Fatalf("insert match: %v", err)
	}

	resp, err := h.UpdateMatch(ctx, gen.UpdateMatchRequestObject{
		LeagueId: testLeagueID,
		MatchId:  "match-upd",
		Body:     &gen.MatchUpdateRequest{HomeScore: ptr(9)},
	})
	if err != nil {
		t.Fatalf("UpdateMatch error: %v", err)
	}
	r, ok := resp.(gen.UpdateMatch200JSONResponse)
	if !ok {
		t.Fatalf("expected UpdateMatch200JSONResponse, got %T", resp)
	}
	if r.HomeScore != 9 {
		t.Fatalf("expected HomeScore=9, got %d", r.HomeScore)
	}
	// AwayScore unchanged
	if r.AwayScore != 2 {
		t.Fatalf("expected AwayScore=2 unchanged, got %d", r.AwayScore)
	}
}

func TestUpdateMatch_AwayScoreOnly(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	_, err := db.Exec(
		`INSERT INTO matches(id, league_id, home_team_id, away_team_id, home_score, away_score) VALUES(?,?,?,?,?,?)`,
		"match-upd2", testLeagueID, testTeamID1, testTeamID2, 3, 3,
	)
	if err != nil {
		t.Fatalf("insert match: %v", err)
	}

	resp, err := h.UpdateMatch(ctx, gen.UpdateMatchRequestObject{
		LeagueId: testLeagueID,
		MatchId:  "match-upd2",
		Body:     &gen.MatchUpdateRequest{AwayScore: ptr(7)},
	})
	if err != nil {
		t.Fatalf("UpdateMatch error: %v", err)
	}
	r, ok := resp.(gen.UpdateMatch200JSONResponse)
	if !ok {
		t.Fatalf("expected UpdateMatch200JSONResponse, got %T", resp)
	}
	if r.AwayScore != 7 {
		t.Fatalf("expected AwayScore=7, got %d", r.AwayScore)
	}
	// HomeScore unchanged
	if r.HomeScore != 3 {
		t.Fatalf("expected HomeScore=3 unchanged, got %d", r.HomeScore)
	}
}

// ---------- DeleteMatch ----------

func TestDeleteMatch_NotFound(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.DeleteMatch(ctx, gen.DeleteMatchRequestObject{
		LeagueId: testLeagueID,
		MatchId:  "nonexistent",
	})
	if err != nil {
		t.Fatalf("DeleteMatch error: %v", err)
	}
	if _, ok := resp.(gen.DeleteMatch404JSONResponse); !ok {
		t.Fatalf("expected DeleteMatch404JSONResponse, got %T", resp)
	}
}

func TestDeleteMatch_Success(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	_, err := db.Exec(
		`INSERT INTO matches(id, league_id, home_team_id, away_team_id, home_score, away_score) VALUES(?,?,?,?,?,?)`,
		"match-del", testLeagueID, testTeamID1, testTeamID2, 0, 0,
	)
	if err != nil {
		t.Fatalf("insert match: %v", err)
	}

	resp, err := h.DeleteMatch(ctx, gen.DeleteMatchRequestObject{
		LeagueId: testLeagueID,
		MatchId:  "match-del",
	})
	if err != nil {
		t.Fatalf("DeleteMatch error: %v", err)
	}
	if _, ok := resp.(gen.DeleteMatch204Response); !ok {
		t.Fatalf("expected DeleteMatch204Response, got %T", resp)
	}

	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM matches WHERE id=?`, "match-del").Scan(&count); err != nil {
		t.Fatalf("count matches: %v", err)
	}
	if count != 0 {
		t.Fatal("expected match row to be deleted")
	}
}
