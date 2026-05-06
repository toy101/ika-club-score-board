"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RankingRule, Team, TeamInput } from "@/types/league";
import { LeagueBasicInfoSection } from "@/components/league/LeagueBasicInfoSection";
import { LeagueRankingRuleSection } from "@/components/league/LeagueRankingRuleSection";
import { LeagueTeamsSection } from "@/components/league/LeagueTeamsSection";
import { createLeague } from "@/lib/api";

let teamIdCounter = 1;

const DEFAULT_RANKING_RULE: RankingRule = {
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  tiebreakers: ["head_to_head"],
};

type FormErrors = {
  name: string | null;
  teams: string | null;
  rankingRule: Partial<Record<keyof RankingRule, string>>;
};

export default function LeagueCreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rankingRule, setRankingRule] = useState<RankingRule>(DEFAULT_RANKING_RULE);
  const [teams, setTeams] = useState<Team[]>([]);
  const [errors, setErrors] = useState<FormErrors>({
    name: null,
    teams: null,
    rankingRule: {},
  });
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const addTeam = (input: TeamInput) => {
    const members: Team["members"] = [
      { name: input.memberNames[0] },
      { name: input.memberNames[1] },
      { name: input.memberNames[2] },
      { name: input.memberNames[3] },
    ];
    const newTeam: Team = {
      id: String(teamIdCounter++),
      name: input.name,
      color: input.color,
      members,
      sortOrder: teams.length + 1,
    };
    setTeams((prev) => [...prev, newTeam]);
    setErrors((prev) => ({ ...prev, teams: null }));
  };

  const editTeam = (updated: Team) => {
    setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const deleteTeam = (id: string) => {
    setTeams((prev) =>
      prev
        .filter((t) => t.id !== id)
        .map((t, i) => ({ ...t, sortOrder: i + 1 }))
    );
  };

  const moveTeamUp = (id: string) => {
    setTeams((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((t, i) => ({ ...t, sortOrder: i + 1 }));
    });
  };

  const moveTeamDown = (id: string) => {
    setTeams((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((t, i) => ({ ...t, sortOrder: i + 1 }));
    });
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = { name: null, teams: null, rankingRule: {} };
    let valid = true;

    if (!name.trim()) {
      newErrors.name = "リーグ名は必須です";
      valid = false;
    }
    if (teams.length < 2) {
      newErrors.teams = "チームを2件以上追加してください";
      valid = false;
    }

    const pointFields = ["pointsWin", "pointsDraw", "pointsLoss"] as const;
    for (const field of pointFields) {
      if (!Number.isInteger(rankingRule[field]) || rankingRule[field] < 0) {
        newErrors.rankingRule[field] = "0以上の整数を入力してください";
        valid = false;
      }
    }

    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setApiError(null);
    try {
      const league = await createLeague({
        name: name.trim(),
        rankingRule,
        teams: teams.map(({ name, color, members }) => ({ name, color, members })),
      });
      router.push(`/leagues/${league.id}`);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-ink-0/80 backdrop-blur-md">
        <div className="mx-auto max-w-lg px-4 py-4 text-center">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.4em] text-fg-3">
            league.create
          </p>
          <h1 className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-base font-bold text-transparent">
            リーグ作成
          </h1>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
      </header>

      <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-6 pb-32">
        <LeagueBasicInfoSection
          name={name}
          onNameChange={setName}
          nameError={errors.name}
        />
        <LeagueRankingRuleSection
          rankingRule={rankingRule}
          onRankingRuleChange={setRankingRule}
          errors={errors.rankingRule}
        />
        <LeagueTeamsSection
          teams={teams}
          onAddTeam={addTeam}
          onEditTeam={editTeam}
          onDeleteTeam={deleteTeam}
          onMoveTeamUp={moveTeamUp}
          onMoveTeamDown={moveTeamDown}
          teamsError={errors.teams}
        />
      </main>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-line bg-ink-0/85 backdrop-blur-md">
        <div className="mx-auto max-w-lg space-y-2 px-4 py-3">
          {apiError && (
            <p className="text-center text-sm text-rose-400">{apiError}</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 py-3 text-sm font-bold tracking-wide text-white shadow-[0_0_44px_rgba(139,92,246,0.75),0_0_16px_rgba(217,70,239,0.55),0_0_8px_rgba(34,211,238,0.4)] transition-all hover:brightness-125 hover:shadow-[0_0_60px_rgba(139,92,246,0.95),0_0_24px_rgba(217,70,239,0.7),0_0_12px_rgba(34,211,238,0.55)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "送信中…" : "リーグを作成"}
          </button>
        </div>
      </footer>
    </div>
  );
}
