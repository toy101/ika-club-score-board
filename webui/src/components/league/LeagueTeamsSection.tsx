import type { Team, TeamInput } from "@/types/league";
import { TeamInputForm } from "./TeamInputForm";
import { TeamList } from "./TeamList";

type Props = {
  teams: Team[];
  onAddTeam: (input: TeamInput) => void;
  onEditTeam: (team: Team) => void;
  onDeleteTeam: (id: string) => void;
  onMoveTeamUp: (id: string) => void;
  onMoveTeamDown: (id: string) => void;
  teamsError: string | null;
};

export function LeagueTeamsSection({
  teams,
  onAddTeam,
  onEditTeam,
  onDeleteTeam,
  onMoveTeamUp,
  onMoveTeamDown,
  teamsError,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
      <section className="space-y-4 rounded-2xl border border-line bg-ink-2 p-5 lg:sticky lg:top-24">
        <h2 className="flex items-center gap-2 text-sm font-bold text-fg">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
          <span>チームを追加</span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.3em] text-fg-3">
            + new.team
          </span>
        </h2>
        <TeamInputForm
          onAdd={onAddTeam}
          teamCnt={teams.length}
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-ink-2 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-fg">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
            参加チーム
          </h2>
          <span className="font-mono text-xs text-fg-3">
            {teams.length}
            <span className="text-fg-3/60">/2+</span>
          </span>
        </div>

        {teamsError && <p className="text-xs text-rose-400">{teamsError}</p>}

        <TeamList
          teams={teams}
          onEdit={onEditTeam}
          onDelete={onDeleteTeam}
          onMoveUp={onMoveTeamUp}
          onMoveDown={onMoveTeamDown}
        />
      </section>
    </div>
  );
}
