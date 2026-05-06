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
    <div className="space-y-3 rounded-2xl border border-line bg-ink-2 p-4">
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-4 w-4 flex-shrink-0 rounded-full"
          style={{ backgroundColor: team.color, boxShadow: `0 0 22px ${team.color}, 0 0 8px ${team.color}` }}
        />
        <span className="text-sm font-bold text-fg">{team.name}</span>
        <span className="ml-auto font-mono text-xs text-fg-3">#{team.sortOrder}</span>
      </div>
      <ul className="grid grid-cols-2 gap-1.5">
        {team.members.map((m, i) => (
          <li
            key={i}
            className="rounded-lg border border-line/60 bg-ink-1 px-3 py-1.5 text-sm text-fg-2"
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
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-ink-0/80 backdrop-blur-md">
        <div className="mx-auto max-w-lg px-4 py-4 text-center">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.4em] text-fg-3">
            league.detail
          </p>
          <h1 className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-base font-bold text-transparent">
            リーグ詳細
          </h1>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
      </header>

      <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
        {/* 基本情報 */}
        <section className="space-y-1 rounded-2xl border border-line bg-ink-2 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-3">
            league.name
          </p>
          <p className="text-xl font-bold text-fg">{league.name}</p>
        </section>

        {/* ランキングルール */}
        <section className="space-y-4 rounded-2xl border border-line bg-ink-2 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-fg">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
            ランキングルール
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { label: "勝利", value: rankingRule.pointsWin, accent: "from-violet-500/25 to-fuchsia-500/15" },
                { label: "引分", value: rankingRule.pointsDraw, accent: "from-cyan-500/25 to-violet-500/15" },
                { label: "敗北", value: rankingRule.pointsLoss, accent: "from-rose-500/15 to-fuchsia-500/10" },
              ] as const
            ).map(({ label, value, accent }) => (
              <div
                key={label}
                className={`relative overflow-hidden rounded-xl border border-line bg-gradient-to-br ${accent} py-3 text-center`}
              >
                <p className="mb-1 text-xs text-fg-2">{label}</p>
                <p className="font-mono text-2xl font-bold text-fg">{value}</p>
                <p className="text-[10px] text-fg-3">pt</p>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-fg-3">
              tiebreaker.priority
            </p>
            <ol className="space-y-1.5">
              {rankingRule.tiebreakers.map((tb, i) => (
                <li
                  key={tb}
                  className="flex items-center gap-2 rounded-lg border border-line/60 bg-ink-1 px-3 py-2 text-sm text-fg-2"
                >
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/20 font-mono text-xs font-bold text-violet-200">
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
          <h2 className="flex items-center gap-2 px-1 text-sm font-bold text-fg">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
            チーム一覧
            <span className="ml-1 font-mono text-xs font-normal text-fg-3">
              {league.teams.length}team
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
