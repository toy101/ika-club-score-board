"use client";

import type { Team, Match, RankingRule } from "@/types/league";
import { rankTeams } from "@/lib/ranking";

type Props = {
  teams: Team[];
  matches: Match[];
  rankingRule: RankingRule;
};

export default function RankingTable({ teams, matches, rankingRule }: Props) {
  if (teams.length < 2) return null;
  const ranked = rankTeams(teams, matches, rankingRule);

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 px-1 text-sm font-bold text-fg">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
        現在のランキング
      </h2>

      <div className="overflow-x-auto rounded-2xl border border-line bg-ink-2">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th align="center">#</Th>
              <Th align="left">team</Th>
              <Th align="center">試</Th>
              <Th align="center">勝</Th>
              <Th align="center">分</Th>
              <Th align="center">敗</Th>
              <Th align="center">得</Th>
              <Th align="center">失</Th>
              <Th align="center">差</Th>
              <Th align="center">勝点</Th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ team, stats, rank }) => {
              const diffClass =
                stats.goalDiff > 0
                  ? "text-emerald-400"
                  : stats.goalDiff < 0
                  ? "text-rose-400"
                  : "text-fg-2";
              return (
                <tr key={team.id} className="border-t border-line/50">
                  <td className="p-2 text-center font-mono text-sm font-bold text-fg">
                    {rank}
                  </td>
                  <td className="whitespace-nowrap p-2 text-left text-xs font-medium text-fg">
                    <span
                      className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                      style={{
                        backgroundColor: team.color,
                        boxShadow: `0 0 14px ${team.color}, 0 0 4px ${team.color}`,
                      }}
                    />
                    {team.name}
                  </td>
                  <Td>{stats.played}</Td>
                  <Td>{stats.wins}</Td>
                  <Td>{stats.draws}</Td>
                  <Td>{stats.losses}</Td>
                  <Td>{stats.goalsFor}</Td>
                  <Td>{stats.goalsAgainst}</Td>
                  <td className={`p-2 text-center font-mono text-xs ${diffClass}`}>
                    {stats.goalDiff > 0 ? "+" : ""}
                    {stats.goalDiff}
                  </td>
                  <td className="p-2 text-center font-mono text-sm font-bold text-fg">
                    {stats.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-1 text-xs text-fg-3">
        確定済み（両チームの申告一致）の試合のみで集計してるよ〜
      </p>
    </section>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "center";
}) {
  const alignClass = align === "center" ? "text-center" : "text-left";
  return (
    <th
      className={`border-b border-line bg-ink-3 p-2 ${alignClass} font-mono text-[10px] uppercase tracking-wider font-normal text-fg-3`}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="p-2 text-center font-mono text-xs text-fg-2">{children}</td>
  );
}
