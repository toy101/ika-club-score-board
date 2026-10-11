package handler

import (
	"context"
	"testing"

	"ika-club-score-board/api/gen"
)

// ---------- ListTeams ----------

func TestListTeams_UnknownLeague(t *testing.T) {
	h, _ := newTestHandler(t)
	ctx := context.Background()

	resp, err := h.ListTeams(ctx, gen.ListTeamsRequestObject{LeagueId: "nonexistent"})
	if err != nil {
		t.Fatalf("ListTeams error: %v", err)
	}
	if _, ok := resp.(gen.ListTeams404JSONResponse); !ok {
		t.Fatalf("expected ListTeams404JSONResponse, got %T", resp)
	}
}

func TestListTeams_Success(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.ListTeams(ctx, gen.ListTeamsRequestObject{LeagueId: testLeagueID})
	if err != nil {
		t.Fatalf("ListTeams error: %v", err)
	}
	r, ok := resp.(gen.ListTeams200JSONResponse)
	if !ok {
		t.Fatalf("expected ListTeams200JSONResponse, got %T", resp)
	}
	if len(r) != 2 {
		t.Fatalf("expected 2 teams, got %d", len(r))
	}
	// sorted by sort_order
	if r[0].SortOrder != 1 || r[1].SortOrder != 2 {
		t.Fatalf("unexpected sort_order: %d, %d", r[0].SortOrder, r[1].SortOrder)
	}
	// full member lists
	for i, team := range r {
		if len(team.Members) != 4 {
			t.Fatalf("team[%d]: expected 4 members, got %d", i, len(team.Members))
		}
	}
}

// ---------- CreateTeam ----------

func TestCreateTeam_UnknownLeague(t *testing.T) {
	h, _ := newTestHandler(t)
	ctx := context.Background()

	resp, err := h.CreateTeam(ctx, gen.CreateTeamRequestObject{
		LeagueId: "nonexistent",
		Body: &gen.TeamCreateRequest{
			Name:    "Team X",
			Color:   "#000000",
			Members: []gen.Member{{Name: "A"}, {Name: "B"}, {Name: "C"}, {Name: "D"}},
		},
	})
	if err != nil {
		t.Fatalf("CreateTeam error: %v", err)
	}
	if _, ok := resp.(gen.CreateTeam404JSONResponse); !ok {
		t.Fatalf("expected CreateTeam404JSONResponse, got %T", resp)
	}
}

func TestCreateTeam_EmptyName(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.CreateTeam(ctx, gen.CreateTeamRequestObject{
		LeagueId: testLeagueID,
		Body: &gen.TeamCreateRequest{
			Name:    "",
			Color:   "#000000",
			Members: []gen.Member{{Name: "A"}, {Name: "B"}, {Name: "C"}, {Name: "D"}},
		},
	})
	if err != nil {
		t.Fatalf("CreateTeam error: %v", err)
	}
	r, ok := resp.(gen.CreateTeam422JSONResponse)
	if !ok {
		t.Fatalf("expected CreateTeam422JSONResponse, got %T", resp)
	}
	if r.Message != "name is required" {
		t.Fatalf("expected 'name is required', got %q", r.Message)
	}
}

func TestCreateTeam_SortOrderIncrement(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	// Start with a league that has 2 teams (sort_order 1 and 2)
	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	makeBody := func(name string) *gen.TeamCreateRequest {
		return &gen.TeamCreateRequest{
			Name:    name,
			Color:   "#123456",
			Members: []gen.Member{{Name: "A"}, {Name: "B"}, {Name: "C"}, {Name: "D"}},
		}
	}

	// Create 3rd team: expect sort_order = 3
	resp1, err := h.CreateTeam(ctx, gen.CreateTeamRequestObject{LeagueId: testLeagueID, Body: makeBody("Team3")})
	if err != nil {
		t.Fatalf("CreateTeam 3rd error: %v", err)
	}
	r1, ok := resp1.(gen.CreateTeam201JSONResponse)
	if !ok {
		t.Fatalf("expected CreateTeam201JSONResponse, got %T", resp1)
	}
	if r1.SortOrder != 3 {
		t.Fatalf("expected sort_order=3, got %d", r1.SortOrder)
	}

	// Create 4th team: expect sort_order = 4
	resp2, err := h.CreateTeam(ctx, gen.CreateTeamRequestObject{LeagueId: testLeagueID, Body: makeBody("Team4")})
	if err != nil {
		t.Fatalf("CreateTeam 4th error: %v", err)
	}
	r2, ok := resp2.(gen.CreateTeam201JSONResponse)
	if !ok {
		t.Fatalf("expected CreateTeam201JSONResponse, got %T", resp2)
	}
	if r2.SortOrder != 4 {
		t.Fatalf("expected sort_order=4, got %d", r2.SortOrder)
	}
}

// ---------- GetTeam ----------

func TestGetTeam_NotFound(t *testing.T) {
	h, _ := newTestHandler(t)
	ctx := context.Background()

	resp, err := h.GetTeam(ctx, gen.GetTeamRequestObject{
		LeagueId: testLeagueID,
		TeamId:   "nonexistent",
	})
	if err != nil {
		t.Fatalf("GetTeam error: %v", err)
	}
	if _, ok := resp.(gen.GetTeam404JSONResponse); !ok {
		t.Fatalf("expected GetTeam404JSONResponse, got %T", resp)
	}
}

func TestGetTeam_Success(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.GetTeam(ctx, gen.GetTeamRequestObject{
		LeagueId: testLeagueID,
		TeamId:   testTeamID1,
	})
	if err != nil {
		t.Fatalf("GetTeam error: %v", err)
	}
	r, ok := resp.(gen.GetTeam200JSONResponse)
	if !ok {
		t.Fatalf("expected GetTeam200JSONResponse, got %T", resp)
	}
	if r.Id != testTeamID1 {
		t.Fatalf("expected ID %q, got %q", testTeamID1, r.Id)
	}
	if len(r.Members) != 4 {
		t.Fatalf("expected 4 members, got %d", len(r.Members))
	}
}

// ---------- UpdateTeam ----------

func TestUpdateTeam_NotFound(t *testing.T) {
	h, _ := newTestHandler(t)
	ctx := context.Background()

	resp, err := h.UpdateTeam(ctx, gen.UpdateTeamRequestObject{
		LeagueId: testLeagueID,
		TeamId:   "nonexistent",
		Body:     &gen.TeamUpdateRequest{Name: ptr("X")},
	})
	if err != nil {
		t.Fatalf("UpdateTeam error: %v", err)
	}
	if _, ok := resp.(gen.UpdateTeam404JSONResponse); !ok {
		t.Fatalf("expected UpdateTeam404JSONResponse, got %T", resp)
	}
}

func TestUpdateTeam_NameOnly(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.UpdateTeam(ctx, gen.UpdateTeamRequestObject{
		LeagueId: testLeagueID,
		TeamId:   testTeamID1,
		Body:     &gen.TeamUpdateRequest{Name: ptr("New Name")},
	})
	if err != nil {
		t.Fatalf("UpdateTeam error: %v", err)
	}
	r, ok := resp.(gen.UpdateTeam200JSONResponse)
	if !ok {
		t.Fatalf("expected UpdateTeam200JSONResponse, got %T", resp)
	}
	if r.Name != "New Name" {
		t.Fatalf("expected name 'New Name', got %q", r.Name)
	}
	// color unchanged
	if r.Color != "#ff0000" {
		t.Fatalf("expected color '#ff0000', got %q", r.Color)
	}
	// members unchanged (nil body.Members)
	if len(r.Members) != 4 {
		t.Fatalf("expected 4 members unchanged, got %d", len(r.Members))
	}
}

func TestUpdateTeam_ColorOnly(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.UpdateTeam(ctx, gen.UpdateTeamRequestObject{
		LeagueId: testLeagueID,
		TeamId:   testTeamID1,
		Body:     &gen.TeamUpdateRequest{Color: ptr("#abcdef")},
	})
	if err != nil {
		t.Fatalf("UpdateTeam error: %v", err)
	}
	r, ok := resp.(gen.UpdateTeam200JSONResponse)
	if !ok {
		t.Fatalf("expected UpdateTeam200JSONResponse, got %T", resp)
	}
	if r.Color != "#abcdef" {
		t.Fatalf("expected color '#abcdef', got %q", r.Color)
	}
	// name unchanged
	if r.Name != "Team1" {
		t.Fatalf("expected name 'Team1', got %q", r.Name)
	}
}

func TestUpdateTeam_SortOrderOnly(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.UpdateTeam(ctx, gen.UpdateTeamRequestObject{
		LeagueId: testLeagueID,
		TeamId:   testTeamID1,
		Body:     &gen.TeamUpdateRequest{SortOrder: ptr(99)},
	})
	if err != nil {
		t.Fatalf("UpdateTeam error: %v", err)
	}
	r, ok := resp.(gen.UpdateTeam200JSONResponse)
	if !ok {
		t.Fatalf("expected UpdateTeam200JSONResponse, got %T", resp)
	}
	if r.SortOrder != 99 {
		t.Fatalf("expected sort_order=99, got %d", r.SortOrder)
	}
}

func TestUpdateTeam_MembersReplaced(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	newMembers := []gen.Member{{Name: "X1"}, {Name: "X2"}, {Name: "X3"}, {Name: "X4"}}
	resp, err := h.UpdateTeam(ctx, gen.UpdateTeamRequestObject{
		LeagueId: testLeagueID,
		TeamId:   testTeamID1,
		Body:     &gen.TeamUpdateRequest{Members: &newMembers},
	})
	if err != nil {
		t.Fatalf("UpdateTeam error: %v", err)
	}
	r, ok := resp.(gen.UpdateTeam200JSONResponse)
	if !ok {
		t.Fatalf("expected UpdateTeam200JSONResponse, got %T", resp)
	}
	if len(r.Members) != 4 {
		t.Fatalf("expected 4 members, got %d", len(r.Members))
	}
	if r.Members[0].Name != "X1" {
		t.Fatalf("expected member[0]='X1', got %q", r.Members[0].Name)
	}
	// Verify sort_order assigned correctly in DB
	rows, err := db.Query(`SELECT sort_order FROM members WHERE team_id=? ORDER BY sort_order`, testTeamID1)
	if err != nil {
		t.Fatalf("query members sort_order: %v", err)
	}
	defer rows.Close()
	expected := 1
	for rows.Next() {
		var so int
		if err := rows.Scan(&so); err != nil {
			t.Fatalf("scan sort_order: %v", err)
		}
		if so != expected {
			t.Fatalf("member sort_order: expected %d, got %d", expected, so)
		}
		expected++
	}
}

func TestUpdateTeam_MembersNil_Unchanged(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	// Update name only, members=nil
	resp, err := h.UpdateTeam(ctx, gen.UpdateTeamRequestObject{
		LeagueId: testLeagueID,
		TeamId:   testTeamID1,
		Body:     &gen.TeamUpdateRequest{Name: ptr("Changed")},
	})
	if err != nil {
		t.Fatalf("UpdateTeam error: %v", err)
	}
	r, ok := resp.(gen.UpdateTeam200JSONResponse)
	if !ok {
		t.Fatalf("expected UpdateTeam200JSONResponse, got %T", resp)
	}
	// Original members from seedLeague are Member1-1..Member1-4
	if len(r.Members) != 4 {
		t.Fatalf("expected 4 members unchanged, got %d", len(r.Members))
	}

	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM members WHERE team_id=?`, testTeamID1).Scan(&count); err != nil {
		t.Fatalf("count members: %v", err)
	}
	if count != 4 {
		t.Fatalf("expected 4 members in DB, got %d", count)
	}
}

// ---------- DeleteTeam ----------

func TestDeleteTeam_NotFound(t *testing.T) {
	h, _ := newTestHandler(t)
	ctx := context.Background()

	resp, err := h.DeleteTeam(ctx, gen.DeleteTeamRequestObject{
		LeagueId: testLeagueID,
		TeamId:   "nonexistent",
	})
	if err != nil {
		t.Fatalf("DeleteTeam error: %v", err)
	}
	if _, ok := resp.(gen.DeleteTeam404JSONResponse); !ok {
		t.Fatalf("expected DeleteTeam404JSONResponse, got %T", resp)
	}
}

func TestDeleteTeam_CascadeDeletesMembers(t *testing.T) {
	h, db := newTestHandler(t)
	ctx := context.Background()

	seedLeague(t, db, testLeagueID, []string{testTeamID1, testTeamID2})

	resp, err := h.DeleteTeam(ctx, gen.DeleteTeamRequestObject{
		LeagueId: testLeagueID,
		TeamId:   testTeamID1,
	})
	if err != nil {
		t.Fatalf("DeleteTeam error: %v", err)
	}
	if _, ok := resp.(gen.DeleteTeam204Response); !ok {
		t.Fatalf("expected DeleteTeam204Response, got %T", resp)
	}

	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM teams WHERE id=?`, testTeamID1).Scan(&count); err != nil {
		t.Fatalf("count teams: %v", err)
	}
	if count != 0 {
		t.Fatal("expected team to be deleted")
	}

	if err := db.QueryRow(`SELECT COUNT(*) FROM members WHERE team_id=?`, testTeamID1).Scan(&count); err != nil {
		t.Fatalf("count members: %v", err)
	}
	if count != 0 {
		t.Fatal("expected members to be cascade-deleted")
	}
}
