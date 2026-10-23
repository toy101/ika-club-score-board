"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RankingRule } from "@/types/league";
import { updateLeague } from "@/lib/api";
import {
  getBestOf,
  getPointsPerGameWin,
  getScoringMode,
} from "@/lib/ranking-rule";
import { LeagueRankingRuleSection } from "./LeagueRankingRuleSection";

type Props = {
  leagueId: string;
  initialRankingRule: RankingRule;
  hasMatches: boolean;
};

type RuleErrors = Partial<Record<keyof RankingRule, string>>;

export function LeagueSettingsEditor({
  leagueId,
  initialRankingRule,
  hasMatches,
}: Props) {
  const router = useRouter();
  const [rankingRule, setRankingRule] = useState<RankingRule>(() => ({
    ...initialRankingRule,
    scoringMode: getScoringMode(initialRankingRule),
    bestOf: getBestOf(initialRankingRule),
    pointsPerGameWin: getPointsPerGameWin(initialRankingRule),
  }));
  const [errors, setErrors] = useState<RuleErrors>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function validate(): boolean {
    const nextErrors: RuleErrors = {};
    if (getScoringMode(rankingRule) === "game_wins") {
      const points = getPointsPerGameWin(rankingRule);
      if (!Number.isInteger(points) || points < 1) {
        nextErrors.pointsPerGameWin = "1以上の整数を入力してください";
      }
    } else {
      for (const field of ["pointsWin", "pointsDraw", "pointsLoss"] as const) {
        if (!Number.isInteger(rankingRule[field]) || rankingRule[field] < 0) {
          nextErrors[field] = "0以上の整数を入力してください";
        }
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateLeague(leagueId, { rankingRule });
      setMessage("ランキングルールを保存しました");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "設定の保存に失敗しました",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <LeagueRankingRuleSection
        rankingRule={rankingRule}
        onRankingRuleChange={(next) => {
          setRankingRule(next);
          setErrors({});
          setMessage(null);
        }}
        errors={errors}
        formatLocked={hasMatches}
        disabled={saving}
      />
      {hasMatches && (
        <p className="text-xs text-amber-300">
          対戦結果が登録済みのため、集計方式とBO形式は変更できません。
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {message && (
          <p className="mr-auto text-xs text-fg-2" role="status">
            {message}
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-2 text-sm font-bold text-white transition hover:brightness-125 disabled:opacity-50"
        >
          {saving ? "保存中…" : "設定を保存"}
        </button>
      </div>
    </div>
  );
}
