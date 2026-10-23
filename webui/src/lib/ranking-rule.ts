import type { BestOf, RankingRule, ScoringMode } from "@/types/league";

export const DEFAULT_SCORING_MODE: ScoringMode = "match_points";
export const DEFAULT_BEST_OF: BestOf = 3;
export const DEFAULT_POINTS_PER_GAME_WIN = 1;

export function getScoringMode(rule: RankingRule): ScoringMode {
  return rule.scoringMode ?? DEFAULT_SCORING_MODE;
}

export function getBestOf(rule: RankingRule): BestOf {
  return rule.bestOf ?? DEFAULT_BEST_OF;
}

export function getPointsPerGameWin(rule: RankingRule): number {
  return rule.pointsPerGameWin ?? DEFAULT_POINTS_PER_GAME_WIN;
}

export function isCompletedSeriesScore(
  homeScore: number,
  awayScore: number,
  bestOf: BestOf,
): boolean {
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) return false;
  if (homeScore < 0 || awayScore < 0) return false;

  const winsRequired = Math.ceil(bestOf / 2);
  return (
    (homeScore === winsRequired && awayScore < winsRequired) ||
    (awayScore === winsRequired && homeScore < winsRequired)
  );
}
