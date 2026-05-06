"use client";

import type { RankingRule } from "@/types/league";

type Props = {
  rankingRule: RankingRule;
  onRankingRuleChange: (rule: RankingRule) => void;
  errors: Partial<Record<keyof RankingRule, string>>;
};

export function LeagueRankingRuleSection({ rankingRule, onRankingRuleChange, errors }: Props) {
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
                onChange={(e) => handlePointChange(key, e.target.value)}
                className={`w-full rounded-lg border bg-ink-1 px-3 py-2 text-center font-mono text-sm font-bold text-fg outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/60 focus:shadow-[0_0_22px_rgba(34,211,238,0.55),0_0_8px_rgba(34,211,238,0.4)] ${
                  errors[key] ? "border-rose-500" : "border-line-2"
                }`}
              />
              {errors[key] && <p className="text-xs text-rose-400">{errors[key]}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-3">
          tiebreaker
        </p>
        <p className="text-xs text-fg-2">勝ち点 → 直接対決</p>
      </div>
    </section>
  );
}
