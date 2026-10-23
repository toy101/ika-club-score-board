import { describe, expect, it } from "vitest";
import {
  getBestOf,
  getPointsPerGameWin,
  getScoringMode,
  isCompletedSeriesScore,
} from "@/lib/ranking-rule";
import type { RankingRule } from "@/types/league";

const legacyRule: RankingRule = {
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  tiebreakers: ["head_to_head"],
};

describe("ranking rule defaults", () => {
  it("keeps legacy leagues on match-points and BO3-compatible defaults", () => {
    expect(getScoringMode(legacyRule)).toBe("match_points");
    expect(getBestOf(legacyRule)).toBe(3);
    expect(getPointsPerGameWin(legacyRule)).toBe(1);
  });
});

describe("isCompletedSeriesScore", () => {
  it.each([
    [2, 0, 3],
    [2, 1, 3],
    [0, 2, 3],
    [3, 0, 5],
    [3, 2, 5],
    [1, 3, 5],
  ] as const)("accepts %i-%i for BO%i", (home, away, bestOf) => {
    expect(isCompletedSeriesScore(home, away, bestOf)).toBe(true);
  });

  it.each([
    [0, 0, 3],
    [1, 1, 3],
    [2, 2, 3],
    [3, 0, 3],
    [2, 2, 5],
    [3, 3, 5],
    [2.5, 3, 5],
  ] as const)("rejects %s-%s for BO%s", (home, away, bestOf) => {
    expect(isCompletedSeriesScore(home, away, bestOf)).toBe(false);
  });
});
