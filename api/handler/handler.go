package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"ika-club-score-board/api/gen"
)

// Handler はStrictServerInterfaceを実装する。
type Handler struct {
	db *sql.DB
}

// インターフェース適合チェック（コンパイル時検証）
var _ gen.StrictServerInterface = (*Handler)(nil)

// New はHandlerを生成して返す。
func New(db *sql.DB) *Handler {
	return &Handler{db: db}
}

// ---------- helpers ----------

func errNotFound(msg string) error {
	return fmt.Errorf("%w: %s", errNotFoundSentinel, msg)
}

var errNotFoundSentinel = errors.New("not found")

func isNotFound(err error) bool {
	return errors.Is(err, errNotFoundSentinel) || errors.Is(err, sql.ErrNoRows)
}

func notFoundResp(msg string) gen.NotFoundJSONResponse {
	return gen.NotFoundJSONResponse{Message: msg}
}

func unprocessableResp(msg string) gen.UnprocessableEntityJSONResponse {
	return gen.UnprocessableEntityJSONResponse{Message: msg}
}

// ---------- League ----------

func (h *Handler) ListLeagues(ctx context.Context, _ gen.ListLeaguesRequestObject) (gen.ListLeaguesResponseObject, error) {
	rows, err := h.db.QueryContext(ctx,
		`SELECT id, name, points_win, points_draw, points_loss, tiebreakers FROM leagues`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var leagues []gen.League
	for rows.Next() {
		l, err := scanLeague(rows)
		if err != nil {
			return nil, err
		}
		leagues = append(leagues, l)
	}
	if leagues == nil {
		leagues = []gen.League{}
	}
	return gen.ListLeagues200JSONResponse(leagues), nil
}

func (h *Handler) CreateLeague(ctx context.Context, req gen.CreateLeagueRequestObject) (gen.CreateLeagueResponseObject, error) {
	body := req.Body
	if body.Name == "" {
		return gen.CreateLeague422JSONResponse{unprocessableResp("name is required")}, nil
	}
	if len(body.Teams) < 2 {
		return gen.CreateLeague422JSONResponse{unprocessableResp("teams must have at least 2 items")}, nil
	}

	leagueID := uuid.NewString()
	tiebreakerJSON, err := json.Marshal(body.RankingRule.Tiebreakers)
	if err != nil {
		return nil, err
	}

	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback() //nolint:errcheck

	_, err = tx.ExecContext(ctx,
		`INSERT INTO leagues(id, name, points_win, points_draw, points_loss, tiebreakers)
		 VALUES(?,?,?,?,?,?)`,
		leagueID, body.Name,
		body.RankingRule.PointsWin, body.RankingRule.PointsDraw, body.RankingRule.PointsLoss,
		string(tiebreakerJSON),
	)
	if err != nil {
		return nil, err
	}

	for i, t := range body.Teams {
		teamID := uuid.NewString()
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO teams(id, league_id, name, color, sort_order) VALUES(?,?,?,?,?)`,
			teamID, leagueID, t.Name, t.Color, i+1,
		); err != nil {
			return nil, err
		}
		for j, m := range t.Members {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO members(team_id, name, sort_order) VALUES(?,?,?)`,
				teamID, m.Name, j+1,
			); err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	league, err := h.fetchLeague(ctx, leagueID)
	if err != nil {
		return nil, err
	}
	return gen.CreateLeague201JSONResponse(league), nil
}

func (h *Handler) GetLeague(ctx context.Context, req gen.GetLeagueRequestObject) (gen.GetLeagueResponseObject, error) {
	row := h.db.QueryRowContext(ctx,
		`SELECT id, name, points_win, points_draw, points_loss, tiebreakers FROM leagues WHERE id=?`,
		req.LeagueId,
	)
	l, err := scanLeagueRow(row)
	if err != nil {
		if isNotFound(err) {
			return gen.GetLeague404JSONResponse{notFoundResp("league not found")}, nil
		}
		return nil, err
	}

	teams, err := h.fetchTeams(ctx, req.LeagueId)
	if err != nil {
		return nil, err
	}

	detail := gen.LeagueDetail{}
	detail.Id = l.Id
	detail.Name = l.Name
	detail.RankingRule = l.RankingRule
	detail.Teams = teams
	return gen.GetLeague200JSONResponse(detail), nil
}

func (h *Handler) UpdateLeague(ctx context.Context, req gen.UpdateLeagueRequestObject) (gen.UpdateLeagueResponseObject, error) {
	row := h.db.QueryRowContext(ctx,
		`SELECT id, name, points_win, points_draw, points_loss, tiebreakers FROM leagues WHERE id=?`,
		req.LeagueId,
	)
	current, err := scanLeagueRow(row)
	if err != nil {
		if isNotFound(err) {
			return gen.UpdateLeague404JSONResponse{notFoundResp("league not found")}, nil
		}
		return nil, err
	}

	body := req.Body
	if body.Name != nil {
		current.Name = *body.Name
	}
	if body.RankingRule != nil {
		current.RankingRule = *body.RankingRule
	}

	tiebreakerJSON, err := json.Marshal(current.RankingRule.Tiebreakers)
	if err != nil {
		return nil, err
	}
	_, err = h.db.ExecContext(ctx,
		`UPDATE leagues SET name=?, points_win=?, points_draw=?, points_loss=?, tiebreakers=? WHERE id=?`,
		current.Name,
		current.RankingRule.PointsWin, current.RankingRule.PointsDraw, current.RankingRule.PointsLoss,
		string(tiebreakerJSON),
		req.LeagueId,
	)
	if err != nil {
		return nil, err
	}
	return gen.UpdateLeague200JSONResponse(current), nil
}

func (h *Handler) DeleteLeague(ctx context.Context, req gen.DeleteLeagueRequestObject) (gen.DeleteLeagueResponseObject, error) {
	res, err := h.db.ExecContext(ctx, `DELETE FROM leagues WHERE id=?`, req.LeagueId)
	if err != nil {
		return nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return gen.DeleteLeague404JSONResponse{notFoundResp("league not found")}, nil
	}
	return gen.DeleteLeague204Response{}, nil
}

// ---------- Team ----------

func (h *Handler) ListTeams(ctx context.Context, req gen.ListTeamsRequestObject) (gen.ListTeamsResponseObject, error) {
	exists, err := h.leagueExists(ctx, req.LeagueId)
	if err != nil {
		return nil, err
	}
	if !exists {
		return gen.ListTeams404JSONResponse{notFoundResp("league not found")}, nil
	}
	teams, err := h.fetchTeams(ctx, req.LeagueId)
	if err != nil {
		return nil, err
	}
	return gen.ListTeams200JSONResponse(teams), nil
}

func (h *Handler) CreateTeam(ctx context.Context, req gen.CreateTeamRequestObject) (gen.CreateTeamResponseObject, error) {
	exists, err := h.leagueExists(ctx, req.LeagueId)
	if err != nil {
		return nil, err
	}
	if !exists {
		return gen.CreateTeam404JSONResponse{notFoundResp("league not found")}, nil
	}

	body := req.Body
	if body.Name == "" {
		return gen.CreateTeam422JSONResponse{unprocessableResp("name is required")}, nil
	}

	var maxOrder int
	_ = h.db.QueryRowContext(ctx,
		`SELECT COALESCE(MAX(sort_order),0) FROM teams WHERE league_id=?`, req.LeagueId,
	).Scan(&maxOrder)

	teamID := uuid.NewString()
	if _, err := h.db.ExecContext(ctx,
		`INSERT INTO teams(id, league_id, name, color, sort_order) VALUES(?,?,?,?,?)`,
		teamID, req.LeagueId, body.Name, body.Color, maxOrder+1,
	); err != nil {
		return nil, err
	}
	for j, m := range body.Members {
		if _, err := h.db.ExecContext(ctx,
			`INSERT INTO members(team_id, name, sort_order) VALUES(?,?,?)`,
			teamID, m.Name, j+1,
		); err != nil {
			return nil, err
		}
	}

	team, err := h.fetchTeam(ctx, teamID)
	if err != nil {
		return nil, err
	}
	return gen.CreateTeam201JSONResponse(team), nil
}

func (h *Handler) GetTeam(ctx context.Context, req gen.GetTeamRequestObject) (gen.GetTeamResponseObject, error) {
	team, err := h.fetchTeam(ctx, req.TeamId)
	if err != nil {
		if isNotFound(err) {
			return gen.GetTeam404JSONResponse{notFoundResp("team not found")}, nil
		}
		return nil, err
	}
	return gen.GetTeam200JSONResponse(team), nil
}

func (h *Handler) UpdateTeam(ctx context.Context, req gen.UpdateTeamRequestObject) (gen.UpdateTeamResponseObject, error) {
	team, err := h.fetchTeam(ctx, req.TeamId)
	if err != nil {
		if isNotFound(err) {
			return gen.UpdateTeam404JSONResponse{notFoundResp("team not found")}, nil
		}
		return nil, err
	}

	body := req.Body
	if body.Name != nil {
		team.Name = *body.Name
	}
	if body.Color != nil {
		team.Color = *body.Color
	}
	if body.SortOrder != nil {
		team.SortOrder = *body.SortOrder
	}

	if _, err := h.db.ExecContext(ctx,
		`UPDATE teams SET name=?, color=?, sort_order=? WHERE id=?`,
		team.Name, team.Color, team.SortOrder, req.TeamId,
	); err != nil {
		return nil, err
	}

	if body.Members != nil {
		if _, err := h.db.ExecContext(ctx, `DELETE FROM members WHERE team_id=?`, req.TeamId); err != nil {
			return nil, err
		}
		for j, m := range *body.Members {
			if _, err := h.db.ExecContext(ctx,
				`INSERT INTO members(team_id, name, sort_order) VALUES(?,?,?)`,
				req.TeamId, m.Name, j+1,
			); err != nil {
				return nil, err
			}
		}
	}

	updated, err := h.fetchTeam(ctx, req.TeamId)
	if err != nil {
		return nil, err
	}
	return gen.UpdateTeam200JSONResponse(updated), nil
}

func (h *Handler) DeleteTeam(ctx context.Context, req gen.DeleteTeamRequestObject) (gen.DeleteTeamResponseObject, error) {
	res, err := h.db.ExecContext(ctx, `DELETE FROM teams WHERE id=?`, req.TeamId)
	if err != nil {
		return nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return gen.DeleteTeam404JSONResponse{notFoundResp("team not found")}, nil
	}
	return gen.DeleteTeam204Response{}, nil
}

// ---------- Match ----------

func (h *Handler) ListMatches(ctx context.Context, req gen.ListMatchesRequestObject) (gen.ListMatchesResponseObject, error) {
	exists, err := h.leagueExists(ctx, req.LeagueId)
	if err != nil {
		return nil, err
	}
	if !exists {
		return gen.ListMatches404JSONResponse{notFoundResp("league not found")}, nil
	}
	rows, err := h.db.QueryContext(ctx,
		`SELECT id, home_team_id, away_team_id, home_score, away_score FROM matches WHERE league_id=? ORDER BY rowid`,
		req.LeagueId,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var matches []gen.Match
	for rows.Next() {
		var m gen.Match
		if err := rows.Scan(&m.Id, &m.HomeTeamId, &m.AwayTeamId, &m.HomeScore, &m.AwayScore); err != nil {
			return nil, err
		}
		matches = append(matches, m)
	}
	if matches == nil {
		matches = []gen.Match{}
	}
	return gen.ListMatches200JSONResponse(matches), nil
}

func (h *Handler) CreateMatch(ctx context.Context, req gen.CreateMatchRequestObject) (gen.CreateMatchResponseObject, error) {
	exists, err := h.leagueExists(ctx, req.LeagueId)
	if err != nil {
		return nil, err
	}
	if !exists {
		return gen.CreateMatch404JSONResponse{notFoundResp("league not found")}, nil
	}

	body := req.Body
	if body.HomeTeamId == body.AwayTeamId {
		return gen.CreateMatch422JSONResponse{unprocessableResp("homeTeamId and awayTeamId must differ")}, nil
	}

	matchID := uuid.NewString()
	_, err = h.db.ExecContext(ctx,
		`INSERT INTO matches(id, league_id, home_team_id, away_team_id, home_score, away_score) VALUES(?,?,?,?,?,?)`,
		matchID, req.LeagueId, body.HomeTeamId, body.AwayTeamId, body.HomeScore, body.AwayScore,
	)
	if err != nil {
		return nil, err
	}

	var m gen.Match
	err = h.db.QueryRowContext(ctx,
		`SELECT id, home_team_id, away_team_id, home_score, away_score FROM matches WHERE id=?`, matchID,
	).Scan(&m.Id, &m.HomeTeamId, &m.AwayTeamId, &m.HomeScore, &m.AwayScore)
	if err != nil {
		return nil, err
	}
	return gen.CreateMatch201JSONResponse(m), nil
}

func (h *Handler) UpdateMatch(ctx context.Context, req gen.UpdateMatchRequestObject) (gen.UpdateMatchResponseObject, error) {
	var m gen.Match
	err := h.db.QueryRowContext(ctx,
		`SELECT id, home_team_id, away_team_id, home_score, away_score FROM matches WHERE id=? AND league_id=?`,
		req.MatchId, req.LeagueId,
	).Scan(&m.Id, &m.HomeTeamId, &m.AwayTeamId, &m.HomeScore, &m.AwayScore)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return gen.UpdateMatch404JSONResponse{notFoundResp("match not found")}, nil
		}
		return nil, err
	}

	body := req.Body
	if body.HomeScore != nil {
		m.HomeScore = *body.HomeScore
	}
	if body.AwayScore != nil {
		m.AwayScore = *body.AwayScore
	}

	_, err = h.db.ExecContext(ctx,
		`UPDATE matches SET home_score=?, away_score=? WHERE id=?`,
		m.HomeScore, m.AwayScore, m.Id,
	)
	if err != nil {
		return nil, err
	}
	return gen.UpdateMatch200JSONResponse(m), nil
}

func (h *Handler) DeleteMatch(ctx context.Context, req gen.DeleteMatchRequestObject) (gen.DeleteMatchResponseObject, error) {
	res, err := h.db.ExecContext(ctx, `DELETE FROM matches WHERE id=? AND league_id=?`, req.MatchId, req.LeagueId)
	if err != nil {
		return nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return gen.DeleteMatch404JSONResponse{notFoundResp("match not found")}, nil
	}
	return gen.DeleteMatch204Response{}, nil
}

// ---------- fetch helpers ----------

func (h *Handler) leagueExists(ctx context.Context, id string) (bool, error) {
	var count int
	err := h.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM leagues WHERE id=?`, id).Scan(&count)
	return count > 0, err
}

func (h *Handler) fetchLeague(ctx context.Context, id string) (gen.League, error) {
	row := h.db.QueryRowContext(ctx,
		`SELECT id, name, points_win, points_draw, points_loss, tiebreakers FROM leagues WHERE id=?`, id)
	return scanLeagueRow(row)
}

func (h *Handler) fetchTeams(ctx context.Context, leagueID string) ([]gen.Team, error) {
	rows, err := h.db.QueryContext(ctx,
		`SELECT id, name, color, sort_order FROM teams WHERE league_id=? ORDER BY sort_order`, leagueID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []gen.Team
	for rows.Next() {
		var t gen.Team
		if err := rows.Scan(&t.Id, &t.Name, &t.Color, &t.SortOrder); err != nil {
			return nil, err
		}
		members, err := h.fetchMembers(ctx, t.Id)
		if err != nil {
			return nil, err
		}
		t.Members = members
		teams = append(teams, t)
	}
	if teams == nil {
		teams = []gen.Team{}
	}
	return teams, nil
}

func (h *Handler) fetchTeam(ctx context.Context, teamID string) (gen.Team, error) {
	var t gen.Team
	err := h.db.QueryRowContext(ctx,
		`SELECT id, name, color, sort_order FROM teams WHERE id=?`, teamID,
	).Scan(&t.Id, &t.Name, &t.Color, &t.SortOrder)
	if err != nil {
		return gen.Team{}, err
	}
	members, err := h.fetchMembers(ctx, teamID)
	if err != nil {
		return gen.Team{}, err
	}
	t.Members = members
	return t, nil
}

func (h *Handler) fetchMembers(ctx context.Context, teamID string) ([]gen.Member, error) {
	rows, err := h.db.QueryContext(ctx,
		`SELECT name FROM members WHERE team_id=? ORDER BY sort_order`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []gen.Member
	for rows.Next() {
		var m gen.Member
		if err := rows.Scan(&m.Name); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	if members == nil {
		members = []gen.Member{}
	}
	return members, nil
}

// ---------- scan helpers ----------

type leagueScanner interface {
	Scan(dest ...any) error
}

func scanLeague(rows *sql.Rows) (gen.League, error) {
	return scanLeagueRow(rows)
}

func scanLeagueRow(s leagueScanner) (gen.League, error) {
	var l gen.League
	var tiebreakerJSON string
	if err := s.Scan(&l.Id, &l.Name,
		&l.RankingRule.PointsWin, &l.RankingRule.PointsDraw, &l.RankingRule.PointsLoss,
		&tiebreakerJSON,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return l, errNotFound("not found")
		}
		return l, err
	}
	if err := json.Unmarshal([]byte(tiebreakerJSON), &l.RankingRule.Tiebreakers); err != nil {
		return l, fmt.Errorf("scanLeagueRow tiebreakers: %w", err)
	}
	return l, nil
}
