import type { Team, Match, RankingRule, Tiebreaker } from "@/types/league";
import { getConfirmedPairs, type ConfirmedPair } from "@/lib/matches";

export type TeamStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

export type RankedTeam = {
  team: Team;
  stats: TeamStats;
  rank: number;
};

function emptyStats(): TeamStats {
  return {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
  };
}

function applyMatch(
  stats: TeamStats,
  scoredFor: number,
  scoredAgainst: number,
  rule: RankingRule
): void {
  stats.played += 1;
  stats.goalsFor += scoredFor;
  stats.goalsAgainst += scoredAgainst;
  stats.goalDiff = stats.goalsFor - stats.goalsAgainst;
  if (scoredFor > scoredAgainst) {
    stats.wins += 1;
    stats.points += rule.pointsWin;
  } else if (scoredFor < scoredAgainst) {
    stats.losses += 1;
    stats.points += rule.pointsLoss;
  } else {
    stats.draws += 1;
    stats.points += rule.pointsDraw;
  }
}

function computeStats(
  teams: Team[],
  pairs: ConfirmedPair[],
  rule: RankingRule
): Map<string, TeamStats> {
  const map = new Map<string, TeamStats>();
  for (const t of teams) map.set(t.id, emptyStats());
  for (const p of pairs) {
    const a = map.get(p.teamA);
    const b = map.get(p.teamB);
    if (!a || !b) continue;
    applyMatch(a, p.scoreA, p.scoreB, rule);
    applyMatch(b, p.scoreB, p.scoreA, rule);
  }
  return map;
}

function tiebreakerKey(
  tb: Tiebreaker,
  teamId: string,
  group: Team[],
  stats: Map<string, TeamStats>,
  pairs: ConfirmedPair[],
  rule: RankingRule
): number {
  const s = stats.get(teamId);
  if (!s) return 0;
  switch (tb) {
    case "goal_difference":
      return s.goalDiff;
    case "goals_scored":
      return s.goalsFor;
    case "head_to_head": {
      const groupIds = new Set(group.map((t) => t.id));
      let points = 0;
      for (const p of pairs) {
        if (!groupIds.has(p.teamA) || !groupIds.has(p.teamB)) continue;
        if (p.teamA === teamId) {
          if (p.scoreA > p.scoreB) points += rule.pointsWin;
          else if (p.scoreA < p.scoreB) points += rule.pointsLoss;
          else points += rule.pointsDraw;
        } else if (p.teamB === teamId) {
          if (p.scoreB > p.scoreA) points += rule.pointsWin;
          else if (p.scoreB < p.scoreA) points += rule.pointsLoss;
          else points += rule.pointsDraw;
        }
      }
      return points;
    }
  }
}

function splitGroup(
  group: Team[],
  tbIdx: number,
  stats: Map<string, TeamStats>,
  pairs: ConfirmedPair[],
  rule: RankingRule,
  result: Team[][]
): void {
  if (group.length === 1) {
    result.push(group);
    return;
  }
  if (tbIdx >= rule.tiebreakers.length) {
    result.push([...group].sort((a, b) => a.sortOrder - b.sortOrder));
    return;
  }
  const tb = rule.tiebreakers[tbIdx];
  const keyed = group.map((t) => ({
    team: t,
    key: tiebreakerKey(tb, t.id, group, stats, pairs, rule),
  }));
  keyed.sort((a, b) => b.key - a.key);
  let i = 0;
  while (i < keyed.length) {
    let j = i;
    while (j < keyed.length && keyed[j].key === keyed[i].key) j++;
    splitGroup(
      keyed.slice(i, j).map((x) => x.team),
      tbIdx + 1,
      stats,
      pairs,
      rule,
      result
    );
    i = j;
  }
}

export function rankTeams(
  teams: Team[],
  matches: Match[],
  rule: RankingRule
): RankedTeam[] {
  const pairs = getConfirmedPairs(teams, matches);
  const stats = computeStats(teams, pairs, rule);

  const byPoints = [...teams].sort((a, b) => {
    const pa = stats.get(a.id)?.points ?? 0;
    const pb = stats.get(b.id)?.points ?? 0;
    return pb - pa;
  });

  const groups: Team[][] = [];
  let i = 0;
  while (i < byPoints.length) {
    let j = i;
    const headPoints = stats.get(byPoints[i].id)?.points ?? 0;
    while (
      j < byPoints.length &&
      (stats.get(byPoints[j].id)?.points ?? 0) === headPoints
    ) {
      j++;
    }
    splitGroup(byPoints.slice(i, j), 0, stats, pairs, rule, groups);
    i = j;
  }

  const result: RankedTeam[] = [];
  let position = 1;
  for (const group of groups) {
    for (const team of group) {
      const s = stats.get(team.id) ?? emptyStats();
      result.push({ team, stats: s, rank: position });
    }
    position += group.length;
  }
  return result;
}
