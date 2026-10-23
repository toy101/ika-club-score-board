package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"unicode"

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

func normalizeRankingRule(rule gen.RankingRule) gen.RankingRule {
	if rule.ScoringMode == nil {
		mode := gen.MatchPoints
		rule.ScoringMode = &mode
	}
	if rule.BestOf == nil {
		bestOf := gen.N3
		rule.BestOf = &bestOf
	}
	if rule.PointsPerGameWin == nil {
		points := 1
		rule.PointsPerGameWin = &points
	}
	return rule
}

func validateRankingRule(rule gen.RankingRule) error {
	rule = normalizeRankingRule(rule)
	if *rule.ScoringMode != gen.MatchPoints && *rule.ScoringMode != gen.GameWins {
		return errors.New("scoringMode must be match_points or game_wins")
	}
	if *rule.BestOf != gen.N3 && *rule.BestOf != gen.N5 {
		return errors.New("bestOf must be 3 or 5")
	}
	if *rule.PointsPerGameWin < 1 {
		return errors.New("pointsPerGameWin must be at least 1")
	}
	return nil
}

func validateSeriesScore(rule gen.RankingRule, homeScore, awayScore int) error {
	rule = normalizeRankingRule(rule)
	if *rule.ScoringMode != gen.GameWins {
		return nil
	}
	winsNeeded := (int(*rule.BestOf) + 1) / 2
	if homeScore < 0 || awayScore < 0 ||
		!((homeScore == winsNeeded && awayScore < winsNeeded) ||
			(awayScore == winsNeeded && homeScore < winsNeeded)) {
		return fmt.Errorf("score must be a completed BO%d series", *rule.BestOf)
	}
	return nil
}

// ---------- League ----------

func (h *Handler) ListLeagues(ctx context.Context, _ gen.ListLeaguesRequestObject) (gen.ListLeaguesResponseObject, error) {
	rows, err := h.db.QueryContext(ctx,
		`SELECT id, name, points_win, points_draw, points_loss, scoring_mode, best_of, points_per_game_win, tiebreakers FROM leagues`)
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
	body.RankingRule = normalizeRankingRule(body.RankingRule)
	if err := validateRankingRule(body.RankingRule); err != nil {
		return gen.CreateLeague422JSONResponse{unprocessableResp(err.Error())}, nil
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
		`INSERT INTO leagues(id, name, points_win, points_draw, points_loss, scoring_mode, best_of, points_per_game_win, tiebreakers)
		 VALUES(?,?,?,?,?,?,?,?,?)`,
		leagueID, body.Name,
		body.RankingRule.PointsWin, body.RankingRule.PointsDraw, body.RankingRule.PointsLoss,
		*body.RankingRule.ScoringMode, *body.RankingRule.BestOf, *body.RankingRule.PointsPerGameWin,
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
		`SELECT id, name, points_win, points_draw, points_loss, scoring_mode, best_of, points_per_game_win, tiebreakers FROM leagues WHERE id=?`,
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
	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback() //nolint:errcheck

	row := tx.QueryRowContext(ctx,
		`SELECT id, name, points_win, points_draw, points_loss, scoring_mode, best_of, points_per_game_win, tiebreakers FROM leagues WHERE id=?`,
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
		nextRule := normalizeRankingRule(*body.RankingRule)
		if err := validateRankingRule(nextRule); err != nil {
			return gen.UpdateLeague422JSONResponse{unprocessableResp(err.Error())}, nil
		}
		current.RankingRule = normalizeRankingRule(current.RankingRule)
		if *current.RankingRule.ScoringMode != *nextRule.ScoringMode || *current.RankingRule.BestOf != *nextRule.BestOf {
			var matchCount int
			if err := tx.QueryRowContext(ctx, `SELECT COUNT(1) FROM matches WHERE league_id=?`, req.LeagueId).Scan(&matchCount); err != nil {
				return nil, err
			}
			if matchCount > 0 {
				return gen.UpdateLeague422JSONResponse{unprocessableResp("scoringMode and bestOf cannot change after match reports exist")}, nil
			}
		}
		current.RankingRule = nextRule
	}
	current.RankingRule = normalizeRankingRule(current.RankingRule)

	tiebreakerJSON, err := json.Marshal(current.RankingRule.Tiebreakers)
	if err != nil {
		return nil, err
	}
	_, err = tx.ExecContext(ctx,
		`UPDATE leagues SET name=?, points_win=?, points_draw=?, points_loss=?, scoring_mode=?, best_of=?, points_per_game_win=?, tiebreakers=? WHERE id=?`,
		current.Name,
		current.RankingRule.PointsWin, current.RankingRule.PointsDraw, current.RankingRule.PointsLoss,
		*current.RankingRule.ScoringMode, *current.RankingRule.BestOf, *current.RankingRule.PointsPerGameWin,
		string(tiebreakerJSON),
		req.LeagueId,
	)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
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
	team, err := h.fetchTeamInLeague(ctx, req.LeagueId, req.TeamId)
	if err != nil {
		if isNotFound(err) {
			return gen.GetTeam404JSONResponse{notFoundResp("team not found")}, nil
		}
		return nil, err
	}
	return gen.GetTeam200JSONResponse(team), nil
}

func (h *Handler) UpdateTeam(ctx context.Context, req gen.UpdateTeamRequestObject) (gen.UpdateTeamResponseObject, error) {
	_, err := h.fetchTeamInLeague(ctx, req.LeagueId, req.TeamId)
	if err != nil {
		if isNotFound(err) {
			return gen.UpdateTeam404JSONResponse{notFoundResp("team not found")}, nil
		}
		return nil, err
	}

	body := req.Body
	var assignments []string
	var args []any
	if body.Name != nil {
		assignments = append(assignments, "name=?")
		args = append(args, *body.Name)
	}
	if body.Color != nil {
		assignments = append(assignments, "color=?")
		args = append(args, *body.Color)
	}
	if body.SortOrder != nil {
		assignments = append(assignments, "sort_order=?")
		args = append(args, *body.SortOrder)
	}
	if body.RoomUrl != nil {
		roomURL, err := normalizeRoomURL(*body.RoomUrl)
		if err != nil {
			return gen.UpdateTeam422JSONResponse{unprocessableResp(err.Error())}, nil
		}
		assignments = append(assignments, "room_url=?")
		args = append(args, roomURL)
	}

	if len(assignments) > 0 {
		args = append(args, req.TeamId, req.LeagueId)
		if _, err := h.db.ExecContext(ctx,
			`UPDATE teams SET `+strings.Join(assignments, ", ")+` WHERE id=? AND league_id=?`,
			args...,
		); err != nil {
			return nil, err
		}
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

	updated, err := h.fetchTeamInLeague(ctx, req.LeagueId, req.TeamId)
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
	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback() //nolint:errcheck

	league, err := scanLeagueRow(tx.QueryRowContext(ctx,
		`SELECT id, name, points_win, points_draw, points_loss, scoring_mode, best_of, points_per_game_win, tiebreakers FROM leagues WHERE id=?`,
		req.LeagueId,
	))
	if err != nil {
		if !isNotFound(err) {
			return nil, err
		}
		return gen.CreateMatch404JSONResponse{notFoundResp("league not found")}, nil
	}

	body := req.Body
	if body.HomeTeamId == body.AwayTeamId {
		return gen.CreateMatch422JSONResponse{unprocessableResp("homeTeamId and awayTeamId must differ")}, nil
	}
	if err := validateSeriesScore(league.RankingRule, body.HomeScore, body.AwayScore); err != nil {
		return gen.CreateMatch422JSONResponse{unprocessableResp(err.Error())}, nil
	}

	matchID := uuid.NewString()
	_, err = tx.ExecContext(ctx,
		`INSERT INTO matches(id, league_id, home_team_id, away_team_id, home_score, away_score) VALUES(?,?,?,?,?,?)`,
		matchID, req.LeagueId, body.HomeTeamId, body.AwayTeamId, body.HomeScore, body.AwayScore,
	)
	if err != nil {
		return nil, err
	}

	var m gen.Match
	err = tx.QueryRowContext(ctx,
		`SELECT id, home_team_id, away_team_id, home_score, away_score FROM matches WHERE id=?`, matchID,
	).Scan(&m.Id, &m.HomeTeamId, &m.AwayTeamId, &m.HomeScore, &m.AwayScore)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
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
	league, err := h.fetchLeague(ctx, req.LeagueId)
	if err != nil {
		return nil, err
	}
	if err := validateSeriesScore(league.RankingRule, m.HomeScore, m.AwayScore); err != nil {
		return gen.UpdateMatch422JSONResponse{unprocessableResp(err.Error())}, nil
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
		`SELECT id, name, points_win, points_draw, points_loss, scoring_mode, best_of, points_per_game_win, tiebreakers FROM leagues WHERE id=?`, id)
	return scanLeagueRow(row)
}

func (h *Handler) fetchTeams(ctx context.Context, leagueID string) ([]gen.Team, error) {
	rows, err := h.db.QueryContext(ctx,
		`SELECT id, name, color, sort_order, room_url FROM teams WHERE league_id=? ORDER BY sort_order`, leagueID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []gen.Team
	for rows.Next() {
		var t gen.Team
		var roomURL string
		if err := rows.Scan(&t.Id, &t.Name, &t.Color, &t.SortOrder, &roomURL); err != nil {
			return nil, err
		}
		t.RoomUrl = &roomURL
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
	var roomURL string
	err := h.db.QueryRowContext(ctx,
		`SELECT id, name, color, sort_order, room_url FROM teams WHERE id=?`, teamID,
	).Scan(&t.Id, &t.Name, &t.Color, &t.SortOrder, &roomURL)
	if err != nil {
		return gen.Team{}, err
	}
	t.RoomUrl = &roomURL
	members, err := h.fetchMembers(ctx, teamID)
	if err != nil {
		return gen.Team{}, err
	}
	t.Members = members
	return t, nil
}

func (h *Handler) fetchTeamInLeague(ctx context.Context, leagueID, teamID string) (gen.Team, error) {
	var t gen.Team
	var roomURL string
	err := h.db.QueryRowContext(ctx,
		`SELECT id, name, color, sort_order, room_url FROM teams WHERE id=? AND league_id=?`, teamID, leagueID,
	).Scan(&t.Id, &t.Name, &t.Color, &t.SortOrder, &roomURL)
	if err != nil {
		return gen.Team{}, err
	}
	t.RoomUrl = &roomURL
	members, err := h.fetchMembers(ctx, teamID)
	if err != nil {
		return gen.Team{}, err
	}
	t.Members = members
	return t, nil
}

func normalizeRoomURL(raw string) (string, error) {
	if strings.Contains(raw, `\`) || strings.IndexFunc(raw, unicode.IsControl) >= 0 {
		return "", errors.New("roomUrl must be a valid Nintendo room URL")
	}
	roomURL := strings.TrimSpace(raw)
	if roomURL == "" {
		return "", nil
	}
	parsed, err := url.ParseRequestURI(roomURL)
	if err != nil || parsed.Opaque != "" || parsed.Scheme != "https" || parsed.Host != "s.nintendo.com" || parsed.User != nil || parsed.Path == "" || parsed.Path == "/" {
		return "", errors.New("roomUrl must start with https://s.nintendo.com/ and include a path")
	}
	return roomURL, nil
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
	var scoringMode gen.RankingRuleScoringMode
	var bestOf gen.RankingRuleBestOf
	var pointsPerGameWin int
	if err := s.Scan(&l.Id, &l.Name,
		&l.RankingRule.PointsWin, &l.RankingRule.PointsDraw, &l.RankingRule.PointsLoss,
		&scoringMode, &bestOf, &pointsPerGameWin,
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
	l.RankingRule.ScoringMode = &scoringMode
	l.RankingRule.BestOf = &bestOf
	l.RankingRule.PointsPerGameWin = &pointsPerGameWin
	return l, nil
}
