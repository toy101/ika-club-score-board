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
  const existingNames = teams.map((t) => t.name);

  return (
    <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-700">参加チーム</h2>
        <span className="text-xs text-gray-400">{teams.length} チーム</span>
      </div>

      {teamsError && <p className="text-xs text-red-500">{teamsError}</p>}

      <TeamInputForm
        existingNames={existingNames}
        onAdd={onAddTeam}
        teamCnt={teams.length}
      />

      <TeamList
        teams={teams}
        onEdit={onEditTeam}
        onDelete={onDeleteTeam}
        onMoveUp={onMoveTeamUp}
        onMoveDown={onMoveTeamDown}
      />
    </section>
  );
}
