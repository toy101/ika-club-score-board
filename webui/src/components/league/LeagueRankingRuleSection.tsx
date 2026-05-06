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
    <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      <h2 className="text-base font-semibold text-gray-700">順位ルール</h2>

      <div className="space-y-3">
        <p className="text-sm text-gray-500">勝ち点</p>
        <div className="grid grid-cols-3 gap-3">
          {pointFields.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <label htmlFor={key} className="block text-xs font-medium text-gray-600">
                {label}
              </label>
              <input
                id={key}
                type="number"
                min={0}
                value={rankingRule[key]}
                onChange={(e) => handlePointChange(key, e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 bg-white text-center outline-none transition focus:ring-2 focus:ring-indigo-400 ${
                  errors[key] ? "border-red-400" : "border-gray-300"
                }`}
              />
              {errors[key] && <p className="text-xs text-red-500">{errors[key]}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-gray-500">タイブレーク判定</p>
        <p className="text-xs text-gray-400">勝ち点 → 直接対決</p>
      </div>
    </section>
  );
}
