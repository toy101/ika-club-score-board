"use client";

import { useState } from "react";
import type { Team, RankingRule } from "@/types/league";
import { createMatch, updateMatch } from "@/lib/api";
import { buildMatchMap, getCellStatus, countMismatchedPairs } from "@/lib/matches";
import { useMatches } from "./useMatches";
import MatchCell from "./MatchCell";
import { TeamColorDot } from "./TeamColorDot";
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

export default function MatchMatrix({ leagueId, teams, rankingRule }: Props) {
  const { matches, refetch } = useMatches(leagueId);
  const [editing, setEditing] = useState<EditingTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchMap = buildMatchMap(matches);
  const mismatchCount = countMismatchedPairs(teams, matchMap);

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
      await refetch();
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
                    <TeamColorDot
                      color={t.color}
                      size="sm"
                      className="mr-1 align-middle"
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
                    <TeamColorDot
                      color={selfTeam.color}
                      size="sm"
                      className="mr-1 align-middle"
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
                      <MatchCell
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
