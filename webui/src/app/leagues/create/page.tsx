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
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-base font-bold text-gray-800 text-center">リーグ作成</h1>
      </header>

      {/* コンテンツ */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-32">
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

      {/* フッターアクション */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-lg mx-auto space-y-2">
          {apiError && (
            <p className="text-sm text-red-500 text-center">{apiError}</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "送信中…" : "リーグを作成する"}
          </button>
        </div>
      </footer>
    </div>
  );
}
