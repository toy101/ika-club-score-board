"use client";

import { useState, useEffect, useCallback } from "react";
import type { Team, Match } from "@/types/league";
import { listMatches, createMatch, updateMatch } from "@/lib/api";

type Props = {
  leagueId: string;
  teams: Team[];
};

type EditingCell = {
  homeTeamId: string;
  awayTeamId: string;
  matchId?: string;
  selfScore: string;
  opponentScore: string;
};

type CellStatus =
  | { kind: "empty" }
  | { kind: "reported"; match: Match }
  | { kind: "other_only"; otherMatch: Match }
  | { kind: "confirmed"; match: Match }
  | { kind: "mismatch"; match: Match; otherMatch: Match };

function getCellStatus(
  selfId: string,
  opponentId: string,
  matchMap: Map<string, Match>
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

export default function MatchMatrix({ leagueId, teams }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    try {
      const data = await listMatches(leagueId);
      setMatches(data);
    } catch {
      // 失敗時は空のまま表示
    }
  }, [leagueId]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const matchMap = new Map<string, Match>();
  for (const m of matches) {
    matchMap.set(`${m.homeTeamId}:${m.awayTeamId}`, m);
  }

  const mismatchCount = (() => {
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
  })();

  function startEdit(homeTeamId: string, awayTeamId: string) {
    const existing = matchMap.get(`${homeTeamId}:${awayTeamId}`);
    setError(null);
    setEditing({
      homeTeamId,
      awayTeamId,
      matchId: existing?.id,
      selfScore: existing !== undefined ? String(existing.homeScore) : "",
      opponentScore: existing !== undefined ? String(existing.awayScore) : "",
    });
  }

  async function saveEdit() {
    if (!editing) return;
    const self = parseInt(editing.selfScore, 10);
    const opp = parseInt(editing.opponentScore, 10);
    if (isNaN(self) || isNaN(opp) || self < 0 || opp < 0) {
      setError("0以上の整数を入力してね〜");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing.matchId) {
        await updateMatch(leagueId, editing.matchId, { homeScore: self, awayScore: opp });
      } else {
        await createMatch(leagueId, {
          homeTeamId: editing.homeTeamId,
          awayTeamId: editing.awayTeamId,
          homeScore: self,
          awayScore: opp,
        });
      }
      await fetchMatches();
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗したよ〜");
    } finally {
      setSaving(false);
    }
  }

  if (teams.length < 2) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-gray-700 px-1">対戦結果マトリクス</h2>

      {mismatchCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">
            ⚠ {mismatchCount}件のスコア不一致があるよ〜
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            オレンジ枠のセルを確認・修正してね〜
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-2 bg-gray-50 text-left text-xs text-gray-400 font-normal border-b border-gray-100 sticky left-0 z-10 min-w-[80px]">
                ↓自チーム / 相手→
              </th>
              {teams.map((t) => (
                <th
                  key={t.id}
                  className="p-2 bg-gray-50 text-center text-xs font-medium text-gray-700 border-b border-gray-100 min-w-[80px] whitespace-nowrap"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                    style={{ backgroundColor: t.color }}
                  />
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((selfTeam) => (
              <tr key={selfTeam.id} className="border-t border-gray-100">
                <td className="p-2 bg-gray-50 text-xs font-medium text-gray-700 sticky left-0 z-10 whitespace-nowrap">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                    style={{ backgroundColor: selfTeam.color }}
                  />
                  {selfTeam.name}
                </td>
                {teams.map((opponentTeam) => {
                  if (selfTeam.id === opponentTeam.id) {
                    return (
                      <td key={opponentTeam.id} className="p-2 text-center bg-gray-100">
                        <span className="text-gray-300 text-base">―</span>
                      </td>
                    );
                  }

                  const isEditingThis =
                    editing?.homeTeamId === selfTeam.id &&
                    editing?.awayTeamId === opponentTeam.id;

                  if (isEditingThis && editing) {
                    return (
                      <td
                        key={opponentTeam.id}
                        className="p-1.5 text-center align-middle min-w-[120px]"
                      >
                        <div className="flex items-center gap-1 justify-center">
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-400 mb-0.5">自</span>
                            <input
                              type="number"
                              min="0"
                              value={editing.selfScore}
                              onChange={(e) =>
                                setEditing({ ...editing, selfScore: e.target.value })
                              }
                              className="w-10 text-center border border-gray-300 rounded text-xs p-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                              autoFocus
                            />
                          </div>
                          <span className="text-gray-400 text-xs mt-4">-</span>
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-400 mb-0.5">相</span>
                            <input
                              type="number"
                              min="0"
                              value={editing.opponentScore}
                              onChange={(e) =>
                                setEditing({ ...editing, opponentScore: e.target.value })
                              }
                              className="w-10 text-center border border-gray-300 rounded text-xs p-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                        </div>
                        <div className="flex gap-1 justify-center mt-1.5">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="text-xs px-2 py-0.5 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => {
                              setEditing(null);
                              setError(null);
                            }}
                            className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    );
                  }

                  const status = getCellStatus(selfTeam.id, opponentTeam.id, matchMap);
                  return (
                    <Cell
                      key={opponentTeam.id}
                      status={status}
                      onClick={() => startEdit(selfTeam.id, opponentTeam.id)}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-xs text-red-500 px-1">{error}</p>}
      <p className="text-xs text-gray-400 px-1">
        セルをタップして自チームのスコアを申告。両チームの申告が一致したら確定するよ〜
      </p>
    </section>
  );
}

function Cell({
  status,
  onClick,
}: {
  status: CellStatus;
  onClick: () => void;
}) {
  switch (status.kind) {
    case "empty":
      return (
        <td
          className="p-2 text-center cursor-pointer hover:bg-indigo-50 transition-colors"
          onClick={onClick}
        >
          <span className="text-gray-300 text-xl leading-none select-none">+</span>
        </td>
      );

    case "other_only":
      return (
        <td
          className="p-2 text-center cursor-pointer hover:bg-amber-50 transition-colors"
          onClick={onClick}
          title="相手チームはすでに申告済み"
        >
          <span className="text-amber-400 text-xl leading-none select-none">+</span>
          <div className="text-xs text-amber-500 mt-0.5 leading-tight">要申告</div>
        </td>
      );

    case "reported":
      return (
        <td
          className="p-2 text-center cursor-pointer hover:bg-indigo-50 transition-colors"
          onClick={onClick}
        >
          <span className="font-mono font-semibold text-gray-800 text-sm">
            {status.match.homeScore}
            <span className="text-gray-400 mx-0.5">-</span>
            {status.match.awayScore}
          </span>
          <div className="text-xs text-gray-400 mt-0.5 leading-tight">⏳ 相手待ち</div>
        </td>
      );

    case "confirmed":
      return (
        <td
          className="p-2 text-center cursor-pointer hover:bg-green-50 transition-colors"
          onClick={onClick}
        >
          <span className="font-mono font-semibold text-gray-800 text-sm">
            {status.match.homeScore}
            <span className="text-gray-400 mx-0.5">-</span>
            {status.match.awayScore}
          </span>
          <div className="text-xs text-green-600 mt-0.5 leading-tight">✓ 確定</div>
        </td>
      );

    case "mismatch": {
      // otherMatch: (opponent→self). otherMatch.awayScore = opponent's claim of self's score
      const theirClaimOfMySelf = status.otherMatch.awayScore;
      const theirClaimOfOpponent = status.otherMatch.homeScore;
      return (
        <td
          className="p-2 text-center cursor-pointer hover:bg-amber-50 transition-colors border border-amber-300"
          onClick={onClick}
          title={`相手の申告: ${theirClaimOfMySelf} - ${theirClaimOfOpponent}`}
        >
          <span className="font-mono font-semibold text-gray-800 text-sm">
            {status.match.homeScore}
            <span className="text-gray-400 mx-0.5">-</span>
            {status.match.awayScore}
          </span>
          <div className="text-xs text-amber-600 mt-0.5 leading-tight">⚠ 不一致</div>
        </td>
      );
    }
  }
}
