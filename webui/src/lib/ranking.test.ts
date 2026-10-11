import { describe, it, expect } from "vitest";
import type { Team, Match, RankingRule } from "@/types/league";
import { rankTeams } from "@/lib/ranking";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTeam(id: string, sortOrder: number = 1): Team {
  return {
    id,
    name: `Team ${id.slice(-4)}`,
    color: "#ffffff",
    sortOrder,
    members: [{ name: "P1" }, { name: "P2" }, { name: "P3" }, { name: "P4" }],
  };
}

function makeMatch(
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
): Match {
  return {
    id: `${homeTeamId.slice(-4)}-vs-${awayTeamId.slice(-4)}`,
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
  };
}

/** Produce a confirmed pair: both directions mirror each other. */
function confirmedMatch(
  homeId: string,
  awayId: string,
  homeScore: number,
  awayScore: number,
): Match[] {
  return [
    makeMatch(homeId, awayId, homeScore, awayScore),
    makeMatch(awayId, homeId, awayScore, homeScore),
  ];
}

const defaultRule: RankingRule = {
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  tiebreakers: ["head_to_head", "goal_difference", "goals_scored"],
};

const A = "00000000-0000-4000-a000-000000000001";
const B = "00000000-0000-4000-a000-000000000002";
const C = "00000000-0000-4000-a000-000000000003";
const D = "00000000-0000-4000-a000-000000000004";

// ---------------------------------------------------------------------------
// Empty matches
// ---------------------------------------------------------------------------

describe("rankTeams — empty matches", () => {
  it("all teams have 0 stats when no matches", () => {
    const teams = [makeTeam(A, 1), makeTeam(B, 2)];
    const ranked = rankTeams(teams, [], defaultRule);
    for (const r of ranked) {
      expect(r.stats.played).toBe(0);
      expect(r.stats.wins).toBe(0);
      expect(r.stats.draws).toBe(0);
      expect(r.stats.losses).toBe(0);
      expect(r.stats.points).toBe(0);
    }
  });

  it("all tied at 0 points — ranked by sortOrder ascending within the tied group", () => {
    // splitGroup falls through to sort by sortOrder when no tiebreaker separates
    const teams = [makeTeam(C, 3), makeTeam(A, 1), makeTeam(B, 2)];
    const ranked = rankTeams(teams, [], defaultRule);
    // All rank 1 (same group), but within the group sorted by sortOrder
    expect(ranked[0].team.id).toBe(A); // sortOrder 1
    expect(ranked[1].team.id).toBe(B); // sortOrder 2
    expect(ranked[2].team.id).toBe(C); // sortOrder 3
    // All share rank 1
    for (const r of ranked) expect(r.rank).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Basic win / draw / loss accumulation
// ---------------------------------------------------------------------------

describe("rankTeams — basic point accumulation", () => {
  it("win gives pointsWin, loss gives pointsLoss, draw gives pointsDraw", () => {
    const teams = [makeTeam(A, 1), makeTeam(B, 2)];
    // A wins
    const matches = confirmedMatch(A, B, 3, 1);
    const ranked = rankTeams(teams, matches, defaultRule);
    const ra = ranked.find((r) => r.team.id === A)!;
    const rb = ranked.find((r) => r.team.id === B)!;
    expect(ra.stats.wins).toBe(1);
    expect(ra.stats.points).toBe(3);
    expect(rb.stats.losses).toBe(1);
    expect(rb.stats.points).toBe(0);
  });

  it("draw gives pointsDraw to both", () => {
    const teams = [makeTeam(A, 1), makeTeam(B, 2)];
    const matches = confirmedMatch(A, B, 1, 1);
    const ranked = rankTeams(teams, matches, defaultRule);
    for (const r of ranked) {
      expect(r.stats.draws).toBe(1);
      expect(r.stats.points).toBe(1);
    }
  });

  it("winner is ranked first", () => {
    const teams = [makeTeam(A, 1), makeTeam(B, 2)];
    const matches = confirmedMatch(A, B, 2, 0);
    const ranked = rankTeams(teams, matches, defaultRule);
    expect(ranked[0].team.id).toBe(A);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it("accumulated stats across multiple matches", () => {
    const teams = [makeTeam(A, 1), makeTeam(B, 2), makeTeam(C, 3)];
    // A beats B and C
    const matches = [
      ...confirmedMatch(A, B, 2, 1),
      ...confirmedMatch(A, C, 3, 0),
      ...confirmedMatch(B, C, 1, 0),
    ];
    const ranked = rankTeams(teams, matches, defaultRule);
    const ra = ranked.find((r) => r.team.id === A)!;
    expect(ra.stats.played).toBe(2);
    expect(ra.stats.wins).toBe(2);
    expect(ra.stats.points).toBe(6);
    expect(ra.rank).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Only confirmed pairs count
// ---------------------------------------------------------------------------

describe("rankTeams — only confirmed pairs", () => {
  it("mismatched pair is excluded from stats", () => {
    const teams = [makeTeam(A, 1), makeTeam(B, 2)];
    // A reports 3-1, B reports 9-9 => mismatch
    const matches = [makeMatch(A, B, 3, 1), makeMatch(B, A, 9, 9)];
    const ranked = rankTeams(teams, matches, defaultRule);
    for (const r of ranked) {
      expect(r.stats.played).toBe(0);
      expect(r.stats.points).toBe(0);
    }
  });

  it("reported-only pair is excluded from stats", () => {
    const teams = [makeTeam(A, 1), makeTeam(B, 2)];
    const matches = [makeMatch(A, B, 3, 1)]; // only A reported
    const ranked = rankTeams(teams, matches, defaultRule);
    for (const r of ranked) {
      expect(r.stats.played).toBe(0);
      expect(r.stats.points).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Tiebreakers
// ---------------------------------------------------------------------------

describe("rankTeams — head_to_head tiebreaker", () => {
  it("resolves tie using head-to-head points among tied group only", () => {
    // A and B both beat C => A:3pts, B:3pts, C:0pts
    // Among A and B, whoever won directly ranks higher
    const teams = [makeTeam(A, 1), makeTeam(B, 2), makeTeam(C, 3)];
    const matches = [
      ...confirmedMatch(A, B, 2, 1), // A beats B in h2h
      ...confirmedMatch(A, C, 3, 0),
      ...confirmedMatch(B, C, 2, 0),
    ];
    const rule: RankingRule = {
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      tiebreakers: ["head_to_head"],
    };
    const ranked = rankTeams(teams, matches, rule);
    // A and B both have 6 pts, but A beat B => A ranks 1st
    expect(ranked[0].team.id).toBe(A);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].team.id).toBe(B);
    expect(ranked[1].rank).toBe(2);
  });

  it("head_to_head only counts matches within the tied group", () => {
    // All three teams at 3 pts each (each beat the one below in a cycle)
    // A beats B, B beats C, C beats A => cycle, all equal in h2h
    // Then tiebreaker falls through to goal_difference
    const teams = [makeTeam(A, 1), makeTeam(B, 2), makeTeam(C, 3)];
    const matches = [
      ...confirmedMatch(A, B, 3, 0), // A beats B (gd+3 for A, -3 for B)
      ...confirmedMatch(B, C, 3, 0), // B beats C (gd+3 for B, -3 for C)
      ...confirmedMatch(C, A, 3, 0), // C beats A (gd+3 for C, -3 for A)
    ];
    const rule: RankingRule = {
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      tiebreakers: ["head_to_head", "goal_difference"],
    };
    const ranked = rankTeams(teams, matches, rule);
    // All 3 pts, h2h cycle => all equal; goal_diff: A=0, B=0, C=0 => all tied still
    // Falls to sortOrder: A(1), B(2), C(3)
    expect(ranked[0].team.id).toBe(A);
    expect(ranked[1].team.id).toBe(B);
    expect(ranked[2].team.id).toBe(C);
    // All share rank 1
    for (const r of ranked) expect(r.rank).toBe(1);
  });
});

describe("rankTeams — goal_difference tiebreaker", () => {
  it("resolves tie by goal difference descending", () => {
    const teams = [makeTeam(A, 1), makeTeam(B, 2), makeTeam(C, 3)];
    // All win one match, but by different margins
    // A beats C 5-0, B beats C 1-0, A and B don't play each other
    // A: 1 win 3pts, gd+5; B: 1 win 3pts, gd+1; C: 0pts
    const matches = [
      ...confirmedMatch(A, C, 5, 0),
      ...confirmedMatch(B, C, 1, 0),
    ];
    const rule: RankingRule = {
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      tiebreakers: ["goal_difference"],
    };
    const ranked = rankTeams(teams, matches, rule);
    expect(ranked[0].team.id).toBe(A);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].team.id).toBe(B);
    expect(ranked[1].rank).toBe(2);
  });
});

describe("rankTeams — goals_scored tiebreaker", () => {
  it("resolves tie by goals scored descending", () => {
    const teams = [makeTeam(A, 1), makeTeam(B, 2), makeTeam(C, 3)];
    // A beats C 3-2, B beats C 3-2 => same gd (+1 each), A and B tied
    // Then goals_scored: A scored 3, B scored 3 => still tied => sortOrder
    // Use distinct goals: A beats C 4-1, B beats C 2-1 => gd+3 vs gd+1 — different gd
    // To test goals_scored: A beats C 3-2 (gf=3,ga=2,gd=1), B beats C 4-3 (gf=4,ga=3,gd=1)
    // Same gd=1, but B has more goals_scored => B ranks above A
    const matches = [
      ...confirmedMatch(A, C, 3, 2),
      ...confirmedMatch(B, C, 4, 3),
    ];
    const rule: RankingRule = {
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      tiebreakers: ["goal_difference", "goals_scored"],
    };
    const ranked = rankTeams(teams, matches, rule);
    // Both A and B have 3 pts, gd=1
    // goals_scored: B=4, A=3 => B ranks above A
    expect(ranked[0].team.id).toBe(B);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].team.id).toBe(A);
    expect(ranked[1].rank).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Recursive tiebreaker split
// ---------------------------------------------------------------------------

describe("rankTeams — recursive tiebreaker split", () => {
  it("applies tiebreakers cascadingly in array order", () => {
    // 4 teams: A and B tied at 6 pts, C and D tied at 3 pts
    // Among A/B: head_to_head resolves (A beat B)
    // Among C/D: head_to_head resolves (D beat C)
    const teams = [makeTeam(A, 1), makeTeam(B, 2), makeTeam(C, 3), makeTeam(D, 4)];
    const matches = [
      ...confirmedMatch(A, B, 2, 0), // A beats B
      ...confirmedMatch(A, C, 1, 0), // A beats C
      ...confirmedMatch(B, D, 1, 0), // B beats D
      ...confirmedMatch(D, C, 2, 1), // D beats C
    ];
    const ranked = rankTeams(teams, matches, defaultRule);
    // A: 2 wins=6pts, B: 1 win=3pts, D: 1 win=3pts, C: 0pts
    // A is clear 1st
    expect(ranked[0].team.id).toBe(A);
    expect(ranked[0].rank).toBe(1);
    // B and D both at 3pts; h2h between B and D: B beat D => B ranks above D
    expect(ranked[1].team.id).toBe(B);
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].team.id).toBe(D);
    expect(ranked[2].rank).toBe(3);
    // C last
    expect(ranked[3].team.id).toBe(C);
    expect(ranked[3].rank).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Shared rank and rank numbering
// ---------------------------------------------------------------------------

describe("rankTeams — shared ranks and skip numbering", () => {
  it("fully tied teams share the same rank", () => {
    const teams = [makeTeam(A, 1), makeTeam(B, 2)];
    const ranked = rankTeams(teams, [], defaultRule);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1);
  });

  it("rank numbering after a shared block skips by group size", () => {
    // A alone at 6pts (rank 1), B and C tied at 3pts (rank 2), D at 0pts (rank 4)
    const teams = [makeTeam(A, 1), makeTeam(B, 2), makeTeam(C, 3), makeTeam(D, 4)];
    const matches = [
      ...confirmedMatch(A, B, 3, 0), // A beats B
      ...confirmedMatch(A, C, 3, 0), // A beats C
      ...confirmedMatch(B, D, 1, 0), // B beats D
      ...confirmedMatch(C, D, 1, 0), // C beats D
      // B and C don't play each other => tied at 3pts, no h2h => goal_difference
      // B gd: +1-3= -2, C gd: +1-3= -2 => tied => goals_scored B=1, C=1 => tied => sortOrder
    ];
    const ranked = rankTeams(teams, matches, defaultRule);
    const ra = ranked.find((r) => r.team.id === A)!;
    const rb = ranked.find((r) => r.team.id === B)!;
    const rc = ranked.find((r) => r.team.id === C)!;
    const rd = ranked.find((r) => r.team.id === D)!;
    expect(ra.rank).toBe(1);
    // B and C share rank 2 (they are a tied group of size 2)
    expect(rb.rank).toBe(2);
    expect(rc.rank).toBe(2);
    // D's rank = 2 + 2 = 4
    expect(rd.rank).toBe(4);
  });
});
