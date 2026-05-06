"use client";

import { useState } from "react";
import type { TeamInput } from "@/types/league";

type Props = {
  existingNames: string[];
  onAdd: (team: TeamInput) => void;
  teamCnt: number;
};

const DEFAULT_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#94a3b8",
];

const MEMBER_EXAMPLES = ["アオリ", "ホタル", "ヒメ", "イイダ"];
const MEMBER_COUNT = 4 as const;
const INITIAL_MEMBER_NAMES: [string, string, string, string] = ["", "", "", ""];

export function TeamInputForm({ existingNames, onAdd, teamCnt }: Props) {
  const [name, setName] = useState(`チーム${teamCnt + 1}`);
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [memberNames, setMemberNames] = useState<
    [string, string, string, string]
  >([...INITIAL_MEMBER_NAMES]);
  const [nameError, setNameError] = useState<string | null>(null);

  const validate = (): boolean => {
    if (!name.trim()) {
      setNameError("チーム名を入力してください");
      return false;
    }
    if (existingNames.includes(name.trim())) {
      setNameError("同じチーム名がすでに存在します");
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleMemberNameChange = (index: number, value: string) => {
    const next = [...memberNames] as [string, string, string, string];
    next[index] = value;
    setMemberNames(next);
  };

  const handleAdd = () => {
    if (!validate()) return;
    onAdd({ name: name.trim(), color, memberNames });
    setName(`チーム${teamCnt + 2}`);
    setColor(DEFAULT_COLORS[0]);
    setMemberNames([...INITIAL_MEMBER_NAMES]);
  };

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-line-2 bg-ink-1/50 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-3">
        + new.team
      </p>

      <div className="space-y-3">
        <div className="space-y-1">
          <label
            htmlFor="team-name"
            className="block text-xs font-medium text-fg-2"
          >
            チーム名 <span className="text-rose-400">*</span>
          </label>
          <input
            id="team-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            className={`w-full rounded-lg border bg-ink-1 px-3 py-2 text-sm text-fg outline-none transition placeholder:text-fg-3 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/60 focus:shadow-[0_0_22px_rgba(34,211,238,0.55),0_0_8px_rgba(34,211,238,0.4)] ${
              nameError ? "border-rose-500" : "border-line-2"
            }`}
          />
          {nameError && <p className="text-xs text-rose-400">{nameError}</p>}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-fg-2">
            メンバー（{MEMBER_COUNT}人）
          </p>
          <div className="grid grid-cols-2 gap-2">
            {memberNames.map((memberName, i) => (
              <input
                key={i}
                type="text"
                value={memberName}
                onChange={(e) => handleMemberNameChange(i, e.target.value)}
                placeholder={MEMBER_EXAMPLES[i]}
                className="w-full rounded-lg border border-line-2 bg-ink-1 px-3 py-2 text-sm text-fg outline-none transition placeholder:text-fg-3 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/60 focus:shadow-[0_0_22px_rgba(34,211,238,0.55),0_0_8px_rgba(34,211,238,0.4)]"
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-fg-2">
            カラー
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {DEFAULT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition-all ${
                  color === c
                    ? "scale-110 ring-2 ring-cyan-400 ring-offset-2 ring-offset-ink-1"
                    : "opacity-70 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: c,
                  boxShadow: color === c ? `0 0 24px ${c}, 0 0 10px ${c}` : undefined,
                }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="w-full rounded-lg border border-violet-500/50 bg-violet-500/10 py-2.5 text-sm font-bold text-violet-200 shadow-[0_0_18px_rgba(139,92,246,0.25)] transition hover:border-violet-400 hover:bg-violet-500/20 hover:shadow-[0_0_32px_rgba(139,92,246,0.65),0_0_12px_rgba(139,92,246,0.45)] active:scale-95"
      >
        + チームを追加
      </button>
    </div>
  );
}
