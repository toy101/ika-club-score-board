import type { Team } from "@/types/league";
import { TeamItem } from "./TeamItem";

type Props = {
  teams: Team[];
  onEdit: (team: Team) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
};

export function TeamList({ teams, onEdit, onDelete, onMoveUp, onMoveDown }: Props) {
  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line/60 bg-ink-1/40 py-6 text-center">
        <p className="text-sm text-fg-3">チームがまだ追加されていません</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {teams.map((team, index) => (
        <TeamItem
          key={team.id}
          team={team}
          onEdit={onEdit}
          onDelete={onDelete}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          isFirst={index === 0}
          isLast={index === teams.length - 1}
        />
      ))}
    </div>
  );
}
