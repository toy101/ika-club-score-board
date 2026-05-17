"use client";

import { useState, useEffect, useCallback } from "react";
import type { Team, Match, RankingRule } from "@/types/league";
import { listMatches, createMatch, updateMatch } from "@/lib/api";
import MatchInputModal from "./MatchInputModal";
import RankingTable from "./RankingTable";

type Props = {
  leagueId: string;
  teams: Team[];
  rankingRule: RankingRule;
};

type EditingTarget = {
  homeTeam: Team;
  awayTeam: Team;
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

export default function MatchMatrix({ leagueId, teams, rankingRule }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [editing, setEditing] = useState<EditingTarget | null>(null);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回ロード（leagueId 変化時の再フェッチ含む）
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

  function startEdit(homeTeam: Team, awayTeam: Team) {
    setError(null);
    setEditing({ homeTeam, awayTeam });
  }

  async function handleSave(homeScore: number, awayScore: number) {
    if (!editing) return;
    const existingMatch = matchMap.get(
      `${editing.homeTeam.id}:${editing.awayTeam.id}`,
    );
    setSaving(true);
    setError(null);
    try {
      if (existingMatch) {
        await updateMatch(leagueId, existingMatch.id, {
          homeScore,
          awayScore,
        });
      } else {
        await createMatch(leagueId, {
          homeTeamId: editing.homeTeam.id,
          awayTeamId: editing.awayTeam.id,
          homeScore,
          awayScore,
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

  function handleCancel() {
    if (saving) return;
    setEditing(null);
    setError(null);
  }

  if (teams.length < 2) return null;

  const editingExisting = editing
    ? matchMap.get(`${editing.homeTeam.id}:${editing.awayTeam.id}`)
    : undefined;
  const editingOtherSide = editing
    ? matchMap.get(`${editing.awayTeam.id}:${editing.homeTeam.id}`)
    : undefined;

  return (
    <div className="space-y-6">
      <RankingTable teams={teams} matches={matches} rankingRule={rankingRule} />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 px-1 text-sm font-bold text-fg">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
          対戦結果マトリクス
        </h2>

        {mismatchCount > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
            <p className="text-sm font-bold text-amber-300">
              ⚠ {mismatchCount}件のスコア不一致があるよ〜
            </p>
            <p className="mt-0.5 text-xs text-amber-300/80">
              オレンジのセルを確認・修正してね〜
            </p>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-line bg-ink-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[80px] border-b border-line bg-ink-3 p-2 text-left font-mono text-[10px] uppercase tracking-wider font-normal text-fg-3">
                  self / vs
                </th>
                {teams.map((t) => (
                  <th
                    key={t.id}
                    className="min-w-[80px] whitespace-nowrap border-b border-line bg-ink-3 p-2 text-center text-xs font-medium text-fg"
                  >
                    <span
                      className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                      style={{
                        backgroundColor: t.color,
                        boxShadow: `0 0 14px ${t.color}, 0 0 4px ${t.color}`,
                      }}
                    />
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((selfTeam) => (
                <tr key={selfTeam.id} className="border-t border-line/50">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-ink-3 p-2 text-xs font-medium text-fg">
                    <span
                      className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                      style={{
                        backgroundColor: selfTeam.color,
                        boxShadow: `0 0 14px ${selfTeam.color}, 0 0 4px ${selfTeam.color}`,
                      }}
                    />
                    {selfTeam.name}
                  </td>
                  {teams.map((opponentTeam) => {
                    if (selfTeam.id === opponentTeam.id) {
                      return (
                        <td
                          key={opponentTeam.id}
                          className="bg-ink-1/60 p-2 text-center"
                        >
                          <span className="text-base text-fg-3">―</span>
                        </td>
                      );
                    }

                    const status = getCellStatus(
                      selfTeam.id,
                      opponentTeam.id,
                      matchMap,
                    );
                    return (
                      <Cell
                        key={opponentTeam.id}
                        status={status}
                        onClick={() => startEdit(selfTeam, opponentTeam)}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="px-1 text-xs text-fg-3">
          セルをタップして自チームのスコアを申告。両チームの申告が一致したら確定するよ〜
        </p>
      </section>

      {editing && (
        <MatchInputModal
          homeTeam={editing.homeTeam}
          awayTeam={editing.awayTeam}
          existingMatch={editingExisting}
          otherSideMatch={editingOtherSide}
          saving={saving}
          error={error}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
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
          className="cursor-pointer p-2 text-center transition-colors hover:bg-violet-500/10"
          onClick={onClick}
        >
          <span className="select-none text-xl leading-none text-fg-3/60">
            +
          </span>
        </td>
      );

    case "other_only":
      return (
        <td
          className="cursor-pointer p-2 text-center transition-colors hover:bg-amber-500/10"
          onClick={onClick}
          title="相手チームはすでに申告済み"
        >
          <span className="select-none text-xl leading-none text-amber-400">
            +
          </span>
          <div className="mt-0.5 text-xs leading-tight text-amber-400/80">
            要申告
          </div>
        </td>
      );

    case "reported":
      return (
        <td
          className="cursor-pointer p-2 text-center transition-colors hover:bg-violet-500/10"
          onClick={onClick}
        >
          <span className="font-mono text-sm font-bold text-fg">
            {status.match.homeScore}
            <span className="mx-0.5 text-fg-3">-</span>
            {status.match.awayScore}
          </span>
          <div className="mt-0.5 text-xs leading-tight text-fg-3">
            ⏳ 相手待ち
          </div>
        </td>
      );

    case "confirmed":
      return (
        <td
          className="cursor-pointer p-2 text-center transition-colors hover:bg-emerald-500/10"
          onClick={onClick}
        >
          <span className="font-mono text-sm font-bold text-fg">
            {status.match.homeScore}
            <span className="mx-0.5 text-fg-3">-</span>
            {status.match.awayScore}
          </span>
          <div className="mt-0.5 text-xs leading-tight text-emerald-400">
            ✓ 確定
          </div>
        </td>
      );

    case "mismatch": {
      const theirClaimOfMySelf = status.otherMatch.awayScore;
      const theirClaimOfOpponent = status.otherMatch.homeScore;
      return (
        <td
          className="cursor-pointer border border-amber-500/50 bg-amber-500/5 p-2 text-center transition-colors hover:bg-amber-500/15"
          onClick={onClick}
          title={`相手の申告: ${theirClaimOfMySelf} - ${theirClaimOfOpponent}`}
        >
          <span className="font-mono text-sm font-bold text-fg">
            {status.match.homeScore}
            <span className="mx-0.5 text-fg-3">-</span>
            {status.match.awayScore}
          </span>
          <div className="mt-0.5 text-xs leading-tight text-amber-400">
            ⚠ 不一致
          </div>
        </td>
      );
    }
  }
}
