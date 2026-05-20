import type { Team, Match } from "@/types/league";

export type CellStatus =
  | { kind: "empty" }
  | { kind: "reported"; match: Match }
  | { kind: "other_only"; otherMatch: Match }
  | { kind: "confirmed"; match: Match }
  | { kind: "mismatch"; match: Match; otherMatch: Match };

export type ConfirmedPair = {
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
};

export function buildMatchMap(matches: Match[]): Map<string, Match> {
  const matchMap = new Map<string, Match>();
  for (const m of matches) {
    matchMap.set(`${m.homeTeamId}:${m.awayTeamId}`, m);
  }
  return matchMap;
}

export function getCellStatus(
  selfId: string,
  opponentId: string,
  matchMap: Map<string, Match>,
): CellStatus {
  const mine = matchMap.get(`${selfId}:${opponentId}`);
  const theirs = matchMap.get(`${opponentId}:${selfId}`);

  if (!mine && !theirs) return { kind: "empty" };
  if (!mine) return { kind: "other_only", otherMatch: theirs! };
  if (!theirs) return { kind: "reported", match: mine };

  const confirmed =
    mine.homeScore === theirs.awayScore && mine.awayScore === theirs.homeScore;
  return confirmed
    ? { kind: "confirmed", match: mine }
    : { kind: "mismatch", match: mine, otherMatch: theirs };
}

export function getConfirmedPairs(
  teams: Team[],
  matches: Match[],
): ConfirmedPair[] {
  const matchMap = buildMatchMap(matches);
  const pairs: ConfirmedPair[] = [];
  const seen = new Set<string>();
  for (const t1 of teams) {
    for (const t2 of teams) {
      if (t1.id === t2.id) continue;
      const key = [t1.id, t2.id].sort().join(":");
      if (seen.has(key)) continue;
      const status = getCellStatus(t1.id, t2.id, matchMap);
      if (status.kind === "confirmed") {
        seen.add(key);
        pairs.push({
          teamA: t1.id,
          teamB: t2.id,
          scoreA: status.match.homeScore,
          scoreB: status.match.awayScore,
        });
      }
    }
  }
  return pairs;
}

export function countMismatchedPairs(
  teams: Team[],
  matchMap: Map<string, Match>,
): number {
  const seen = new Set<string>();
  let count = 0;
  for (const t1 of teams) {
    for (const t2 of teams) {
      if (t1.id >= t2.id) continue;
      const status = getCellStatus(t1.id, t2.id, matchMap);
      if (status.kind === "mismatch") {
        const key = [t1.id, t2.id].sort().join(":");
        if (!seen.has(key)) {
          seen.add(key);
          count++;
        }
      }
    }
  }
  return count;
}
