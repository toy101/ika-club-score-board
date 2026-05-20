import Link from "next/link";
import { listLeagues } from "@/lib/api";
import type { League } from "@/types/league";

function LeagueCard({ league }: { league: League }) {
  const { rankingRule } = league;
  return (
    <Link
      href={`/leagues/${league.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-line bg-ink-2 p-5 transition-colors hover:border-violet-500/60 hover:bg-ink-2/70"
    >
      <span className="h-10 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-fg lg:text-lg">
          {league.name}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-fg-3">
          勝 {rankingRule.pointsWin} / 分 {rankingRule.pointsDraw} / 負{" "}
          {rankingRule.pointsLoss}
        </p>
      </div>
      <span className="font-mono text-lg text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-fg">
        →
      </span>
    </Link>
  );
}

export default async function LeagueListPage() {
  const leagues = await listLeagues().catch(() => null);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-ink-0/80 backdrop-blur-md">
        <div className="mx-auto max-w-lg px-4 py-4 text-center lg:max-w-7xl lg:px-6 lg:py-5 lg:text-left">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.4em] text-fg-3">
            league.list
          </p>
          <h1 className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-base font-bold text-transparent lg:text-xl">
            リーグ一覧
          </h1>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-6 lg:max-w-7xl lg:space-y-6 lg:px-6 lg:py-8">
        <div className="flex justify-end">
          <Link
            href="/leagues/create"
            className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-sm font-bold text-white shadow-[0_0_30px_rgba(139,92,246,0.7),0_0_12px_rgba(34,211,238,0.5)] transition hover:brightness-125 active:scale-[0.98]"
          >
            ＋ リーグを作成
          </Link>
        </div>

        {leagues === null ? (
          <p
            className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm text-rose-300"
            role="alert"
          >
            リーグ一覧の取得に失敗したよ〜。APIサーバーが起動しているか確認してね。
          </p>
        ) : leagues.length === 0 ? (
          <div className="rounded-2xl border border-line bg-ink-2 p-8 text-center">
            <p className="text-sm text-fg-2">まだリーグがないよ〜。</p>
            <p className="mt-1 text-xs text-fg-3">
              右上のボタンから最初のリーグを作ろう。
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2 lg:gap-4">
            {leagues.map((league) => (
              <li key={league.id}>
                <LeagueCard league={league} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
