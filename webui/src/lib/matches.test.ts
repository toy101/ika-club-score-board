import { describe, it, expect } from "vitest";
import type { Team, Match } from "@/types/league";
import {
  buildMatchMap,
  getCellStatus,
  getConfirmedPairs,
  countMismatchedPairs,
} from "@/lib/matches";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTeam(id: string, sortOrder: number = 1): Team {
  return {
    id,
    name: `Team ${id}`,
    color: "#ffffff",
    sortOrder,
    members: [
      { name: "P1" },
      { name: "P2" },
      { name: "P3" },
      { name: "P4" },
    ],
  };
}

function makeMatch(
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
): Match {
  return {
    id: `${homeTeamId}-vs-${awayTeamId}`,
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
  };
}

const A = "00000000-0000-4000-a000-000000000001";
const B = "00000000-0000-4000-a000-000000000002";
const C = "00000000-0000-4000-a000-000000000003";

// ---------------------------------------------------------------------------
// buildMatchMap
// ---------------------------------------------------------------------------

describe("buildMatchMap", () => {
  it("builds key homeTeamId:awayTeamId for each match", () => {
    const m = makeMatch(A, B, 2, 1);
    const map = buildMatchMap([m]);
    expect(map.get(`${A}:${B}`)).toBe(m);
  });

  it("returns an empty map for an empty array", () => {
    expect(buildMatchMap([]).size).toBe(0);
  });

  it("last entry wins on duplicate key", () => {
    const first = makeMatch(A, B, 1, 0);
    const second = { ...makeMatch(A, B, 3, 2), id: "second" };
    const map = buildMatchMap([first, second]);
    expect(map.get(`${A}:${B}`)).toBe(second);
    expect(map.size).toBe(1);
  });

  it("stores multiple distinct keys independently", () => {
    const ab = makeMatch(A, B, 2, 1);
    const ba = makeMatch(B, A, 1, 2);
    const map = buildMatchMap([ab, ba]);
    expect(map.get(`${A}:${B}`)).toBe(ab);
    expect(map.get(`${B}:${A}`)).toBe(ba);
    expect(map.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getCellStatus
// ---------------------------------------------------------------------------

describe("getCellStatus", () => {
  it("returns empty when neither side has reported", () => {
    const map = buildMatchMap([]);
    expect(getCellStatus(A, B, map)).toEqual({ kind: "empty" });
  });

  it("returns reported when only self has reported", () => {
    const mine = makeMatch(A, B, 3, 1);
    const map = buildMatchMap([mine]);
    const status = getCellStatus(A, B, map);
    expect(status.kind).toBe("reported");
    if (status.kind === "reported") {
      expect(status.match).toBe(mine);
    }
  });

  it("returns other_only when only opponent has reported", () => {
    const theirs = makeMatch(B, A, 1, 3);
    const map = buildMatchMap([theirs]);
    const status = getCellStatus(A, B, map);
    expect(status.kind).toBe("other_only");
    if (status.kind === "other_only") {
      expect(status.otherMatch).toBe(theirs);
    }
  });

  it("returns confirmed when both sides mirror each other", () => {
    // A reports: home=A(3), away=B(1)  => A scored 3, B scored 1
    // B reports: home=B(1), away=A(3)  => mirrors perfectly
    const mine = makeMatch(A, B, 3, 1);
    const theirs = makeMatch(B, A, 1, 3);
    const map = buildMatchMap([mine, theirs]);
    const status = getCellStatus(A, B, map);
    expect(status.kind).toBe("confirmed");
    if (status.kind === "confirmed") {
      expect(status.match).toBe(mine);
    }
  });

  it("returns mismatch when both sides disagree on score", () => {
    const mine = makeMatch(A, B, 3, 1);
    const theirs = makeMatch(B, A, 2, 3); // B claims they scored 2, not 1
    const map = buildMatchMap([mine, theirs]);
    const status = getCellStatus(A, B, map);
    expect(status.kind).toBe("mismatch");
    if (status.kind === "mismatch") {
      expect(status.match).toBe(mine);
      expect(status.otherMatch).toBe(theirs);
    }
  });
});

// ---------------------------------------------------------------------------
// getConfirmedPairs
// ---------------------------------------------------------------------------

describe("getConfirmedPairs", () => {
  it("returns empty array when no matches", () => {
    const teams = [makeTeam(A), makeTeam(B)];
    expect(getConfirmedPairs(teams, [])).toHaveLength(0);
  });

  it("returns one entry per confirmed pair regardless of iteration order", () => {
    const teams = [makeTeam(A), makeTeam(B)];
    const matches = [makeMatch(A, B, 2, 0), makeMatch(B, A, 0, 2)];
    const pairs = getConfirmedPairs(teams, matches);
    expect(pairs).toHaveLength(1);
  });

  it("includes only confirmed pairs (reported-only pair excluded)", () => {
    const teams = [makeTeam(A), makeTeam(B), makeTeam(C)];
    // A-B confirmed
    const matches = [makeMatch(A, B, 2, 0), makeMatch(B, A, 0, 2)];
    // A-C only A reported — not confirmed
    matches.push(makeMatch(A, C, 1, 0));
    const pairs = getConfirmedPairs(teams, matches);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].teamA).toBe(A);
    expect(pairs[0].teamB).toBe(B);
  });

  it("scoreA/scoreB reflect the iterated t1 perspective (homeScore/awayScore of mine)", () => {
    // When t1=A, t2=B: status = getCellStatus(A, B, map) => confirmed, match = A's report
    // A's report: homeTeamId=A, homeScore=3, awayScore=1
    const teams = [makeTeam(A, 1), makeTeam(B, 2)];
    const matches = [makeMatch(A, B, 3, 1), makeMatch(B, A, 1, 3)];
    const pairs = getConfirmedPairs(teams, matches);
    expect(pairs).toHaveLength(1);
    // teamA is whichever of A/B is first encountered as t1 (sorted by teams array order = A first)
    expect(pairs[0].teamA).toBe(A);
    expect(pairs[0].teamB).toBe(B);
    expect(pairs[0].scoreA).toBe(3); // A's homeScore
    expect(pairs[0].scoreB).toBe(1); // A's awayScore
  });

  it("no duplicate pairs from iteration when 3 teams all confirmed", () => {
    const teams = [makeTeam(A, 1), makeTeam(B, 2), makeTeam(C, 3)];
    const matches = [
      makeMatch(A, B, 2, 1),
      makeMatch(B, A, 1, 2),
      makeMatch(A, C, 3, 0),
      makeMatch(C, A, 0, 3),
      makeMatch(B, C, 1, 1),
      makeMatch(C, B, 1, 1),
    ];
    const pairs = getConfirmedPairs(teams, matches);
    // 3 unique pairs: A-B, A-C, B-C
    expect(pairs).toHaveLength(3);
    const keys = pairs.map((p) => [p.teamA, p.teamB].sort().join(":")).sort();
    expect(keys).toEqual([`${A}:${B}`, `${A}:${C}`, `${B}:${C}`].sort());
  });
});

// ---------------------------------------------------------------------------
// countMismatchedPairs
// ---------------------------------------------------------------------------

describe("countMismatchedPairs", () => {
  it("returns 0 when no matches", () => {
    const teams = [makeTeam(A), makeTeam(B)];
    expect(countMismatchedPairs(teams, buildMatchMap([]))).toBe(0);
  });

  it("counts a mismatched pair exactly once", () => {
    const teams = [makeTeam(A), makeTeam(B)];
    const mine = makeMatch(A, B, 3, 1);
    const theirs = makeMatch(B, A, 9, 9); // mismatch
    expect(countMismatchedPairs(teams, buildMatchMap([mine, theirs]))).toBe(1);
  });

  it("does not count a confirmed pair", () => {
    const teams = [makeTeam(A), makeTeam(B)];
    const matches = [makeMatch(A, B, 2, 0), makeMatch(B, A, 0, 2)];
    expect(countMismatchedPairs(teams, buildMatchMap(matches))).toBe(0);
  });

  it("does not count reported-only pair", () => {
    const teams = [makeTeam(A), makeTeam(B)];
    expect(
      countMismatchedPairs(teams, buildMatchMap([makeMatch(A, B, 1, 0)])),
    ).toBe(0);
  });

  it("counts each mismatched pair only once across multiple teams", () => {
    const teams = [makeTeam(A), makeTeam(B), makeTeam(C)];
    // A-B mismatch
    const ab = [makeMatch(A, B, 3, 1), makeMatch(B, A, 9, 9)];
    // A-C mismatch
    const ac = [makeMatch(A, C, 1, 0), makeMatch(C, A, 5, 5)];
    // B-C confirmed
    const bc = [makeMatch(B, C, 1, 1), makeMatch(C, B, 1, 1)];
    const map = buildMatchMap([...ab, ...ac, ...bc]);
    expect(countMismatchedPairs(teams, map)).toBe(2);
  });
});
