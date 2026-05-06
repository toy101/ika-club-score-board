-- leagues テーブル
CREATE TABLE IF NOT EXISTS leagues (
    id           TEXT    NOT NULL PRIMARY KEY,
    name         TEXT    NOT NULL,
    points_win   INTEGER NOT NULL DEFAULT 3,
    points_draw  INTEGER NOT NULL DEFAULT 1,
    points_loss  INTEGER NOT NULL DEFAULT 0,
    tiebreakers  TEXT    NOT NULL DEFAULT 'head_to_head' -- JSON配列をTEXTで保存
);

-- teams テーブル
CREATE TABLE IF NOT EXISTS teams (
    id         TEXT    NOT NULL PRIMARY KEY,
    league_id  TEXT    NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    color      TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1
);

-- members テーブル
CREATE TABLE IF NOT EXISTS members (
    id         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    team_id    TEXT    NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1
);

-- matches テーブル
CREATE TABLE IF NOT EXISTS matches (
    id            TEXT    NOT NULL PRIMARY KEY,
    league_id     TEXT    NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    home_team_id  TEXT    NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    away_team_id  TEXT    NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    home_score    INTEGER NOT NULL,
    away_score    INTEGER NOT NULL,
    UNIQUE(league_id, home_team_id, away_team_id)
);
