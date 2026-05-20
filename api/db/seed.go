package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
)

// SeedMode は Seed の挙動を切り替える。
type SeedMode string

const (
	// SeedOff: seed しない。
	SeedOff SeedMode = "off"
	// SeedIfEmpty: leagues が 0 件のときだけ seed する（デフォルト）。
	SeedIfEmpty SeedMode = "if-empty"
	// SeedForce: 既存のテストリーグを CASCADE 削除してから再投入する（開発用）。
	SeedForce SeedMode = "force"
)

// ParseSeedMode は SEED_TEST_DATA 環境変数の値を SeedMode に変換する。
// 未設定または未知の値は SeedIfEmpty にフォールバックする。
func ParseSeedMode(env string) SeedMode {
	switch env {
	case string(SeedOff):
		return SeedOff
	case string(SeedForce):
		return SeedForce
	case "", string(SeedIfEmpty):
		return SeedIfEmpty
	default:
		log.Printf("seed: unknown SEED_TEST_DATA=%q, falling back to %s", env, SeedIfEmpty)
		return SeedIfEmpty
	}
}

const seedLeagueID = "00000000-0000-4000-a000-000000000001"

type seedTeam struct {
	id      string
	name    string
	color   string
	members [4]string
}

var defaultSeedTeams = []seedTeam{
	{
		id:      "00000000-0000-4000-a000-000000000011",
		name:    "チームA",
		color:   "#ff7a3d",
		members: [4]string{"カイト", "アオイ", "ツバサ", "リン"},
	},
	{
		id:      "00000000-0000-4000-a000-000000000012",
		name:    "チームB",
		color:   "#3da3ff",
		members: [4]string{"ソウタ", "ユナ", "ミナト", "ハルカ"},
	},
	{
		id:      "00000000-0000-4000-a000-000000000013",
		name:    "チームC",
		color:   "#10b981",
		members: [4]string{"カナ", "ナオキ", "サクラ", "レン"},
	},
	{
		id:      "00000000-0000-4000-a000-000000000014",
		name:    "チームD",
		color:   "#a855f7",
		members: [4]string{"ヒカル", "スミレ", "ショウタ", "コトネ"},
	},
}

var defaultSeedTiebreakers = []string{"head_to_head", "goal_difference", "goals_scored"}

type seedMatch struct {
	id         string
	homeTeamID string
	awayTeamID string
	homeScore  int
	awayScore  int
}

// 自己申告モデル: (reporter→opponent) で「自チームスコア, 相手スコア」を記録。
// 両チームが申告し値が対称なら確定。スワップして不一致なら⚠。
// チームA=11, B=12, C=13, D=14
var defaultSeedMatches = []seedMatch{
	// A-B: 両申告・確定 (A:3 B:1)
	{"00000000-0000-4000-a000-000000000101", "00000000-0000-4000-a000-000000000011", "00000000-0000-4000-a000-000000000012", 3, 1},
	{"00000000-0000-4000-a000-000000000102", "00000000-0000-4000-a000-000000000012", "00000000-0000-4000-a000-000000000011", 1, 3},

	// A-C: 両申告・確定 (A:2 C:0)
	{"00000000-0000-4000-a000-000000000103", "00000000-0000-4000-a000-000000000011", "00000000-0000-4000-a000-000000000013", 2, 0},
	{"00000000-0000-4000-a000-000000000104", "00000000-0000-4000-a000-000000000013", "00000000-0000-4000-a000-000000000011", 0, 2},

	// B-C: 両申告・確定 (1-1引分)
	{"00000000-0000-4000-a000-000000000105", "00000000-0000-4000-a000-000000000012", "00000000-0000-4000-a000-000000000013", 1, 1},
	{"00000000-0000-4000-a000-000000000106", "00000000-0000-4000-a000-000000000013", "00000000-0000-4000-a000-000000000012", 1, 1},

	// A-D: Aのみ申告（⏳相手待ち / Dから見て要申告）
	{"00000000-0000-4000-a000-000000000107", "00000000-0000-4000-a000-000000000011", "00000000-0000-4000-a000-000000000014", 1, 1},

	// B-D: 両申告・不一致⚠ (Bは B:2 D:3, Dは D:2 B:1 と申告)
	{"00000000-0000-4000-a000-000000000108", "00000000-0000-4000-a000-000000000012", "00000000-0000-4000-a000-000000000014", 2, 3},
	{"00000000-0000-4000-a000-000000000109", "00000000-0000-4000-a000-000000000014", "00000000-0000-4000-a000-000000000012", 2, 1},

	// C-D: 未申告（空セル確認用）
}

const (
	defaultSeedLeagueName  = "テストリーグ"
	defaultSeedPointsWin   = 3
	defaultSeedPointsDraw  = 1
	defaultSeedPointsLoss  = 0
)

// Seed はテストデータを mode に従って投入する。
//   - SeedOff       : 何もしない
//   - SeedIfEmpty   : leagues が 0 件のときだけ投入
//   - SeedForce     : 固定 ID のテストリーグを削除（CASCADE）してから投入
func Seed(ctx context.Context, db *sql.DB, mode SeedMode) error {
	if mode == SeedOff {
		log.Printf("seed: mode=%s skipped", mode)
		return nil
	}

	if mode == SeedIfEmpty {
		var count int
		if err := db.QueryRowContext(ctx, `SELECT COUNT(1) FROM leagues`).Scan(&count); err != nil {
			return fmt.Errorf("seed: count leagues: %w", err)
		}
		if count > 0 {
			log.Printf("seed: mode=%s skipped (existing leagues: %d)", mode, count)
			return nil
		}
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("seed: begin tx: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck

	if mode == SeedForce {
		log.Printf("seed: WARNING mode=%s, deleting existing test league %s (CASCADE)", mode, seedLeagueID)
		if _, err := tx.ExecContext(ctx, `DELETE FROM leagues WHERE id = ?`, seedLeagueID); err != nil {
			return fmt.Errorf("seed: delete existing test league: %w", err)
		}
	}

	tiebreakerJSON, err := json.Marshal(defaultSeedTiebreakers)
	if err != nil {
		return fmt.Errorf("seed: marshal tiebreakers: %w", err)
	}

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO leagues(id, name, points_win, points_draw, points_loss, tiebreakers)
		 VALUES(?,?,?,?,?,?)`,
		seedLeagueID,
		defaultSeedLeagueName,
		defaultSeedPointsWin,
		defaultSeedPointsDraw,
		defaultSeedPointsLoss,
		string(tiebreakerJSON),
	); err != nil {
		return fmt.Errorf("seed: insert league: %w", err)
	}

	for i, t := range defaultSeedTeams {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO teams(id, league_id, name, color, sort_order) VALUES(?,?,?,?,?)`,
			t.id, seedLeagueID, t.name, t.color, i+1,
		); err != nil {
			return fmt.Errorf("seed: insert team %s: %w", t.id, err)
		}
		for j, name := range t.members {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO members(team_id, name, sort_order) VALUES(?,?,?)`,
				t.id, name, j+1,
			); err != nil {
				return fmt.Errorf("seed: insert member team=%s seq=%d: %w", t.id, j+1, err)
			}
		}
	}

	for _, m := range defaultSeedMatches {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO matches(id, league_id, home_team_id, away_team_id, home_score, away_score) VALUES(?,?,?,?,?,?)`,
			m.id, seedLeagueID, m.homeTeamID, m.awayTeamID, m.homeScore, m.awayScore,
		); err != nil {
			return fmt.Errorf("seed: insert match %s: %w", m.id, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("seed: commit: %w", err)
	}

	log.Printf("seed: mode=%s inserted league=%s teams=%d members=%d matches=%d",
		mode, seedLeagueID, len(defaultSeedTeams), len(defaultSeedTeams)*4, len(defaultSeedMatches))
	return nil
}
