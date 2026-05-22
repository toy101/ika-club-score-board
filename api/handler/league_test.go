package handler

import (
	"context"
	"testing"

	"ika-club-score-board/api/gen"
)

const (
	testLeagueID  = "00000000-0000-4000-a000-000000000001"
	testTeamID1   = "00000000-0000-4000-a000-000000000011"
	testTeamID2   = "00000000-0000-4000-a000-000000000012"
	testTeamID3   = "00000000-0000-4000-a000-000000000013"
	testLeagueID2 = "00000000-0000-4000-a000-000000000002"
)

// ---------- helpers ----------

func makeLeagueBody(name string, teams []gen.TeamCreateRequest) *gen.LeagueCreateRequest {
	return &gen.LeagueCreateRequest{
		Name: name,
		RankingRule: gen.RankingRule{
			PointsWin:   3,
			PointsDraw:  1,
			PointsLoss:  0,
			Tiebreakers: []gen.RankingRuleTiebreakers{gen.HeadToHead, gen.GoalDifference},
		},
		Teams: teams,
	}
}

func makeTeamReqs(n int) []gen.TeamCreateRequest {
	teams := make([]gen.TeamCreateRequest, n)
	for i := range teams {
		teams[i] = gen.TeamCreateRequest{
			Name:  "Team",
			Color: "#ffffff",
			Members: []gen.Member{
				{Name: "M1"}, {Name: "M2"}, {Name: "M3"}, {Name: "M4"},
			},
		}
	}
	return teams
}

// ---------- ListLeagues ----------

func TestListLeagues_Empty(t *testing.T) {
	h, _ := newTestHandler(t)
	ctx := context.Background()

	resp, err := h.ListLeagues(ctx, gen.ListLeaguesRequestObject{})
	if err != nil {
		t.Fatalf("ListLeagues error: %v", err)
	}
	r, ok := resp.(gen.ListLeagues200JSONResponse)
	if !ok {
		t.Fatalf("expected ListLeagues200JSONResponse, got %T", resp)
	}
	if len(r) != 0 {
		t.Fatalf("expected empty slice, got %d items", len(r))
	}
}

func TestListLeagues_Multiple(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})
	seedLeague(t, db, testLeagueID2, []string{testTeamID3})

	resp, err := h.ListLeagues(ctx, gen.ListLeaguesRequestObject{})
	if err != nil {
		t.Fatalf("ListLeagues error: %v", err)
	}
	r, ok := resp.(gen.ListLeagues200JSONResponse)
	if !ok {
		t.Fatalf("expected ListLeagues200JSONResponse, got %T", resp)
	}
	if len(r) != 2 {
		t.Fatalf("expected 2 leagues, got %d", len(r))
	}
}

// ---------- CreateLeague ----------

func TestCreateLeague_EmptyName(t *testing.T) {
	h, _ := newTestHandler(t)
	ctx := context.Background()

	body := makeLeagueBody("", makeTeamReqs(2))
	resp, err := h.CreateLeague(ctx, gen.CreateLeagueRequestObject{Body: body})
	if err != nil {
		t.Fatalf("CreateLeague error: %v", err)
	}
	r, ok := resp.(gen.CreateLeague422JSONResponse)
	if !ok {
		t.Fatalf("expected CreateLeague422JSONResponse, got %T", resp)
	}
	if r.Message != "name is required" {
		t.Fatalf("expected 'name is required', got %q", r.Message)
	}
}

func TestCreateLeague_TooFewTeams(t *testing.T) {
	h, _ := newTestHandler(t)
	ctx := context.Background()

	body := makeLeagueBody("League", makeTeamReqs(1))
	resp, err := h.CreateLeague(ctx, gen.CreateLeagueRequestObject{Body: body})
	if err != nil {
		t.Fatalf("CreateLeague error: %v", err)
	}
	r, ok := resp.(gen.CreateLeague422JSONResponse)
	if !ok {
		t.Fatalf("expected CreateLeague422JSONResponse, got %T", resp)
	}
	if r.Message != "teams must have at least 2 items" {
		t.Fatalf("expected 'teams must have at least 2 items', got %q", r.Message)
	}
}

func TestCreateLeague_Success(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	body := makeLeagueBody("My League", makeTeamReqs(3))
	resp, err := h.CreateLeague(ctx, gen.CreateLeagueRequestObject{Body: body})
	if err != nil {
		t.Fatalf("CreateLeague error: %v", err)
	}
	r, ok := resp.(gen.CreateLeague201JSONResponse)
	if !ok {
		t.Fatalf("expected CreateLeague201JSONResponse, got %T", resp)
	}
	if r.Name != "My League" {
		t.Fatalf("expected name 'My League', got %q", r.Name)
	}
	if r.Id == "" {
		t.Fatal("expected non-empty ID")
	}
	if len(r.RankingRule.Tiebreakers) != 2 {
		t.Fatalf("expected 2 tiebreakers, got %d", len(r.RankingRule.Tiebreakers))
	}

	// Verify teams rows inserted with sort_order 1..N
	var teamCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM teams WHERE league_id=?`, r.Id).Scan(&teamCount); err != nil {
		t.Fatalf("count teams: %v", err)
	}
	if teamCount != 3 {
		t.Fatalf("expected 3 teams, got %d", teamCount)
	}

	// Verify sort_order values
	rows, err := db.Query(`SELECT sort_order FROM teams WHERE league_id=? ORDER BY sort_order`, r.Id)
	if err != nil {
		t.Fatalf("query sort_order: %v", err)
	}
	defer rows.Close()
	expected := 1
	for rows.Next() {
		var so int
		if err := rows.Scan(&so); err != nil {
			t.Fatalf("scan sort_order: %v", err)
		}
		if so != expected {
			t.Fatalf("expected sort_order %d, got %d", expected, so)
		}
		expected++
	}

	// Verify members (3 teams * 4 members = 12)
	var memberCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM members WHERE team_id IN (SELECT id FROM teams WHERE league_id=?)`, r.Id).Scan(&memberCount); err != nil {
		t.Fatalf("count members: %v", err)
	}
	if memberCount != 12 {
		t.Fatalf("expected 12 members, got %d", memberCount)
	}
}

// ---------- GetLeague ----------

func TestGetLeague_NotFound(t *testing.T) {
	h, _ := newTestHandler(t)
	ctx := context.Background()

	resp, err := h.GetLeague(ctx, gen.GetLeagueRequestObject{LeagueId: "nonexistent"})
	if err != nil {
		t.Fatalf("GetLeague error: %v", err)
	}
	if _, ok := resp.(gen.GetLeague404JSONResponse); !ok {
		t.Fatalf("expected GetLeague404JSONResponse, got %T", resp)
	}
}

func TestGetLeague_Success(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.GetLeague(ctx, gen.GetLeagueRequestObject{LeagueId: testLeagueID})
	if err != nil {
		t.Fatalf("GetLeague error: %v", err)
	}
	r, ok := resp.(gen.GetLeague200JSONResponse)
	if !ok {
		t.Fatalf("expected GetLeague200JSONResponse, got %T", resp)
	}
	if r.Id != testLeagueID {
		t.Fatalf("expected ID %q, got %q", testLeagueID, r.Id)
	}
	if len(r.Teams) != 2 {
		t.Fatalf("expected 2 teams, got %d", len(r.Teams))
	}
	// Teams ordered by sort_order; each should have 4 members
	for i, team := range r.Teams {
		if team.SortOrder != i+1 {
			t.Fatalf("team[%d]: expected sort_order %d, got %d", i, i+1, team.SortOrder)
		}
		if len(team.Members) != 4 {
			t.Fatalf("team[%d]: expected 4 members, got %d", i, len(team.Members))
		}
	}
}

// ---------- UpdateLeague ----------

func TestUpdateLeague_NotFound(t *testing.T) {
	h, _ := newTestHandler(t)
	ctx := context.Background()

	resp, err := h.UpdateLeague(ctx, gen.UpdateLeagueRequestObject{
		LeagueId: "nonexistent",
		Body:     &gen.LeagueUpdateRequest{Name: ptr("New Name")},
	})
	if err != nil {
		t.Fatalf("UpdateLeague error: %v", err)
	}
	if _, ok := resp.(gen.UpdateLeague404JSONResponse); !ok {
		t.Fatalf("expected UpdateLeague404JSONResponse, got %T", resp)
	}
}

func TestUpdateLeague_NameOnly(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.UpdateLeague(ctx, gen.UpdateLeagueRequestObject{
		LeagueId: testLeagueID,
		Body:     &gen.LeagueUpdateRequest{Name: ptr("Updated Name")},
	})
	if err != nil {
		t.Fatalf("UpdateLeague error: %v", err)
	}
	r, ok := resp.(gen.UpdateLeague200JSONResponse)
	if !ok {
		t.Fatalf("expected UpdateLeague200JSONResponse, got %T", resp)
	}
	if r.Name != "Updated Name" {
		t.Fatalf("expected name 'Updated Name', got %q", r.Name)
	}
	// RankingRule unchanged (points 3/1/0 from seedLeague)
	if r.RankingRule.PointsWin != 3 {
		t.Fatalf("expected PointsWin=3, got %d", r.RankingRule.PointsWin)
	}
}

func TestUpdateLeague_RankingRuleOnly(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	newRule := gen.RankingRule{
		PointsWin:   5,
		PointsDraw:  2,
		PointsLoss:  1,
		Tiebreakers: []gen.RankingRuleTiebreakers{gen.GoalsScored},
	}
	resp, err := h.UpdateLeague(ctx, gen.UpdateLeagueRequestObject{
		LeagueId: testLeagueID,
		Body:     &gen.LeagueUpdateRequest{RankingRule: &newRule},
	})
	if err != nil {
		t.Fatalf("UpdateLeague error: %v", err)
	}
	r, ok := resp.(gen.UpdateLeague200JSONResponse)
	if !ok {
		t.Fatalf("expected UpdateLeague200JSONResponse, got %T", resp)
	}
	// Name unchanged
	if r.Name != "Test League" {
		t.Fatalf("expected name 'Test League', got %q", r.Name)
	}
	if r.RankingRule.PointsWin != 5 {
		t.Fatalf("expected PointsWin=5, got %d", r.RankingRule.PointsWin)
	}
	// Tiebreakers JSON round-trip
	if len(r.RankingRule.Tiebreakers) != 1 || r.RankingRule.Tiebreakers[0] != gen.GoalsScored {
		t.Fatalf("tiebreakers mismatch: %v", r.RankingRule.Tiebreakers)
	}
}

// ---------- DeleteLeague ----------

func TestDeleteLeague_NotFound(t *testing.T) {
	h, _ := newTestHandler(t)
	ctx := context.Background()

	resp, err := h.DeleteLeague(ctx, gen.DeleteLeagueRequestObject{LeagueId: "nonexistent"})
	if err != nil {
		t.Fatalf("DeleteLeague error: %v", err)
	}
	if _, ok := resp.(gen.DeleteLeague404JSONResponse); !ok {
		t.Fatalf("expected DeleteLeague404JSONResponse, got %T", resp)
	}
}

func TestDeleteLeague_CascadeDeletes(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	// Insert a match so we can verify cascade
	_, err := db.Exec(
		`INSERT INTO matches(id, league_id, home_team_id, away_team_id, home_score, away_score) VALUES(?,?,?,?,?,?)`,
		"match-1", testLeagueID, testTeamID1, testTeamID2, 1, 0,
	)
	if err != nil {
		t.Fatalf("insert match: %v", err)
	}

	resp, err := h.DeleteLeague(ctx, gen.DeleteLeagueRequestObject{LeagueId: testLeagueID})
	if err != nil {
		t.Fatalf("DeleteLeague error: %v", err)
	}
	if _, ok := resp.(gen.DeleteLeague204Response); !ok {
		t.Fatalf("expected DeleteLeague204Response, got %T", resp)
	}

	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM leagues WHERE id=?`, testLeagueID).Scan(&count); err != nil {
		t.Fatalf("count leagues: %v", err)
	}
	if count != 0 {
		t.Fatal("expected league to be deleted")
	}

	if err := db.QueryRow(`SELECT COUNT(*) FROM teams WHERE league_id=?`, testLeagueID).Scan(&count); err != nil {
		t.Fatalf("count teams: %v", err)
	}
	if count != 0 {
		t.Fatal("expected teams to be cascade-deleted")
	}

	if err := db.QueryRow(`SELECT COUNT(*) FROM members WHERE team_id IN (?,?)`, testTeamID1, testTeamID2).Scan(&count); err != nil {
		t.Fatalf("count members: %v", err)
	}
	if count != 0 {
		t.Fatal("expected members to be cascade-deleted")
	}

	if err := db.QueryRow(`SELECT COUNT(*) FROM matches WHERE league_id=?`, testLeagueID).Scan(&count); err != nil {
		t.Fatalf("count matches: %v", err)
	}
	if count != 0 {
		t.Fatal("expected matches to be cascade-deleted")
	}
}
