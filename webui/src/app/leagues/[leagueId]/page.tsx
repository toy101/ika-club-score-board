import { notFound } from "next/navigation";
import { getLeague } from "@/lib/api";
import type { Team } from "@/types/league";
import MatchMatrix from "@/components/league/MatchMatrix";

type Props = {
  params: Promise<{ leagueId: string }>;
};

const TIEBREAKER_LABELS: Record<string, string> = {
  head_to_head: "直接対決",
  goal_difference: "得失点差",
  goals_scored: "総得点",
};

function TeamCard({ team }: { team: Team }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="inline-block w-4 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: team.color }}
        />
        <span className="text-sm font-semibold text-gray-800">{team.name}</span>
        <span className="ml-auto text-xs text-gray-400">#{team.sortOrder}</span>
      </div>
      <ul className="grid grid-cols-2 gap-1.5">
        {team.members.map((m, i) => (
          <li
            key={i}
            className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5"
          >
            {m.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function LeagueDetailPage({ params }: Props) {
  const { leagueId } = await params;
  const league = await getLeague(leagueId).catch(() => notFound());

  const { rankingRule } = league;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-base font-bold text-gray-800 text-center">リーグ詳細</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* 基本情報 */}
        <section className="bg-white rounded-2xl shadow-sm p-5 space-y-1">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide">リーグ名</h2>
          <p className="text-xl font-bold text-gray-900">{league.name}</p>
        </section>

        {/* ランキングルール */}
        <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-700">ランキングルール</h2>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { label: "勝利", value: rankingRule.pointsWin },
                { label: "引分", value: rankingRule.pointsDraw },
                { label: "敗北", value: rankingRule.pointsLoss },
              ] as const
            ).map(({ label, value }) => (
              <div key={label} className="text-center bg-gray-50 rounded-xl py-3">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}pt</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">タイブレーク（優先順位）</p>
            <ol className="space-y-1.5">
              {rankingRule.tiebreakers.map((tb, i) => (
                <li key={tb} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  {TIEBREAKER_LABELS[tb] ?? tb}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 対戦結果マトリクス */}
        <MatchMatrix leagueId={leagueId} teams={league.teams} />

        {/* チーム一覧 */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700 px-1">
            チーム一覧{" "}
            <span className="text-sm font-normal text-gray-400">
              ({league.teams.length}チーム)
            </span>
          </h2>
          {league.teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </section>
      </main>
    </div>
  );
}
