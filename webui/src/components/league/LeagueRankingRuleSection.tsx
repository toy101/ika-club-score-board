"use client";

import type { RankingRule } from "@/types/league";
import {
  getBestOf,
  getPointsPerGameWin,
  getScoringMode,
} from "@/lib/ranking-rule";

type Props = {
  rankingRule: RankingRule;
  onRankingRuleChange: (rule: RankingRule) => void;
  errors: Partial<Record<keyof RankingRule, string>>;
  formatLocked?: boolean;
  disabled?: boolean;
};

export function LeagueRankingRuleSection({
  rankingRule,
  onRankingRuleChange,
  errors,
  formatLocked = false,
  disabled = false,
}: Props) {
  const scoringMode = getScoringMode(rankingRule);
  const tiebreakerLabels = {
    head_to_head: "直接対決",
    goal_difference: scoringMode === "game_wins" ? "本数差" : "得失点差",
    goals_scored: scoringMode === "game_wins" ? "獲得本数" : "総得点",
  };
  const bestOf = getBestOf(rankingRule);
  const pointsPerGameWin = getPointsPerGameWin(rankingRule);
  const handlePointChange = (
    field: "pointsWin" | "pointsDraw" | "pointsLoss",
    value: string
  ) => {
    const num = parseInt(value, 10);
    onRankingRuleChange({
      ...rankingRule,
      [field]: isNaN(num) ? 0 : num,
    });
  };

  const pointFields: { key: "pointsWin" | "pointsDraw" | "pointsLoss"; label: string }[] = [
    { key: "pointsWin", label: "勝利" },
    { key: "pointsDraw", label: "引分" },
    { key: "pointsLoss", label: "敗北" },
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-ink-2 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-fg">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
        順位ルール
      </h2>

      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-3">
          scoring.mode
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["match_points", "シリーズ勝敗"],
              ["game_wins", "獲得本数"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() =>
                onRankingRuleChange({
                  ...rankingRule,
                  scoringMode: mode,
                  bestOf,
                  pointsPerGameWin,
                })
              }
              aria-pressed={scoringMode === mode}
              disabled={disabled || formatLocked}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                scoringMode === mode
                  ? "border-cyan-400 bg-cyan-400/15 font-bold text-cyan-200"
                  : "border-line-2 bg-ink-1 text-fg-2 hover:border-cyan-400/60"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-fg-3">
          {scoringMode === "game_wins"
            ? "負けたシリーズでも、獲得した本数に応じて勝点が入ります。"
            : "シリーズの勝ち・引き分け・負けに応じて勝点が入ります。"}
        </p>
      </div>

      {scoringMode === "match_points" ? (
        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-3">
            points
          </p>
          <div className="grid grid-cols-3 gap-3">
            {pointFields.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label htmlFor={key} className="block text-xs font-medium text-fg-2">
                  {label}
                </label>
                <input
                  id={key}
                  type="number"
                  min={0}
                  value={rankingRule[key]}
                  disabled={disabled}
                  onChange={(e) => handlePointChange(key, e.target.value)}
                  className={`w-full rounded-lg border bg-ink-1 px-3 py-2 text-center font-mono text-sm font-bold text-fg outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/60 focus:shadow-[0_0_22px_rgba(34,211,238,0.55),0_0_8px_rgba(34,211,238,0.4)] ${
                    errors[key] ? "border-rose-500" : "border-line-2"
                  }`}
                />
                {errors[key] && (
                  <p className="text-xs text-rose-400">{errors[key]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="block text-xs font-medium text-fg-2">対戦形式</span>
            <div className="grid grid-cols-2 gap-2">
              {([3, 5] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    onRankingRuleChange({ ...rankingRule, bestOf: value })
                  }
                  aria-pressed={bestOf === value}
                  disabled={disabled || formatLocked}
                  className={`rounded-lg border px-2 py-2 font-mono text-sm font-bold transition ${
                    bestOf === value
                      ? "border-violet-400 bg-violet-400/15 text-violet-200"
                      : "border-line-2 bg-ink-1 text-fg-2"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  BO{value}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="pointsPerGameWin"
              className="block text-xs font-medium text-fg-2"
            >
              1本あたりの勝点
            </label>
            <input
              id="pointsPerGameWin"
              type="number"
              min={1}
              value={pointsPerGameWin}
              disabled={disabled}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value, 10);
                onRankingRuleChange({
                  ...rankingRule,
                  pointsPerGameWin: Number.isNaN(value) ? 0 : value,
                });
              }}
              className={`w-full rounded-lg border bg-ink-1 px-3 py-2 text-center font-mono text-sm font-bold text-fg outline-none focus:border-cyan-400 ${
                errors.pointsPerGameWin ? "border-rose-500" : "border-line-2"
              }`}
            />
            {errors.pointsPerGameWin && (
              <p className="text-xs text-rose-400">{errors.pointsPerGameWin}</p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-3">
          tiebreaker
        </p>
        <p className="text-xs text-fg-2">
          {["勝点", ...rankingRule.tiebreakers.map((rule) => tiebreakerLabels[rule])].join(" → ")}
        </p>
      </div>
    </section>
  );
}
