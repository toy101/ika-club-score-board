export type Tiebreaker = "head_to_head" | "goal_difference" | "goals_scored";
export type ScoringMode = "match_points" | "game_wins";
export type BestOf = 3 | 5;

export type RankingRule = {
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  tiebreakers: Tiebreaker[];
  scoringMode?: ScoringMode;
  bestOf?: BestOf;
  pointsPerGameWin?: number;
};

export type Member = {
  name: string;
};

export type Team = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  members: [Member, Member, Member, Member];
  roomUrl?: string;
};

export type TeamInput = {
  color: string;
  memberNames: [string, string, string, string];
};

export type LeagueCreatePayload = {
  league: {
    name: string;
    rankingRule: RankingRule;
  };
  teams: Omit<Team, "id">[];
};

export type League = {
  id: string;
  name: string;
  rankingRule: RankingRule;
};

export type LeagueDetail = League & {
  teams: Team[];
};

export type Match = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

export type MatchCreateRequest = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

export type MatchUpdateRequest = {
  homeScore?: number;
  awayScore?: number;
};
