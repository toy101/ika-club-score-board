import { notFound } from "next/navigation";
import { getLeague, listMatches } from "@/lib/api";
import type { Team } from "@/types/league";
import MatchMatrix from "@/components/league/MatchMatrix";
import ModeRoulette from "@/components/league/ModeRoulette";
import { TeamColorDot } from "@/components/league/TeamColorDot";
import { LeagueSettingsEditor } from "@/components/league/LeagueSettingsEditor";

type Props = {
  params: Promise<{ leagueId: string }>;
};

function TeamCard({ team }: { team: Team }) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-ink-2 p-4">
      <div className="flex items-center gap-3">
        <TeamColorDot color={team.color} size="lg" />
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
  const [league, matches] = await Promise.all([
    getLeague(leagueId),
    listMatches(leagueId),
  ]).catch(() => notFound());

  const { rankingRule } = league;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-ink-0/80 backdrop-blur-md">
        <div className="mx-auto max-w-lg px-4 py-4 text-center lg:max-w-7xl lg:px-6 lg:py-5 lg:text-left">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.4em] text-fg-3">
            league.detail
          </p>
          <h1 className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-base font-bold text-transparent lg:text-xl">
            リーグ詳細
          </h1>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
      </header>

      <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-6 lg:max-w-7xl lg:space-y-6 lg:px-6 lg:py-8">
        {/* 上段: リーグ名 + ランキングルール (PCでは横並び、モバイルは縦並び) */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-stretch lg:gap-6">
          {/* 基本情報 */}
          <section className="flex flex-col justify-center space-y-1 rounded-2xl border border-line bg-ink-2 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-3">
              league.name
            </p>
            <p className="text-xl font-bold text-fg lg:text-2xl">{league.name}</p>
          </section>

          <LeagueSettingsEditor
            leagueId={leagueId}
            initialRankingRule={rankingRule}
            hasMatches={matches.length > 0}
          />
        </div>

        {/* 中段: ランキング & 対戦結果マトリクス (横全幅) */}
        <div className="min-w-0">
          <MatchMatrix
            leagueId={leagueId}
            teams={league.teams}
            rankingRule={rankingRule}
          />
        </div>

        {/* ルールルーレット (スマホ表示のみ) */}
        <div className="lg:hidden">
          <ModeRoulette />
        </div>

        {/* 下段: チーム一覧 (Grid形式) */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 px-1 text-sm font-bold text-fg">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
            チーム一覧
            <span className="ml-1 font-mono text-xs font-normal text-fg-3">
              {league.teams.length}team
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {league.teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
