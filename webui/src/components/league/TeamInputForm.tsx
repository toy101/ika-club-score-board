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
  "#6b7280",
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
    <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-4 space-y-3">
      <p className="text-sm font-medium text-gray-600">チームを追加</p>

      <div className="space-y-2">
        <div className="space-y-1">
          <label
            htmlFor="team-name"
            className="block text-xs font-medium text-gray-500"
          >
            チーム名 <span className="text-red-500">*</span>
          </label>
          <input
            id="team-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 bg-white outline-none transition focus:ring-2 focus:ring-indigo-400 ${
              nameError ? "border-red-400" : "border-gray-300"
            }`}
          />
          {nameError && <p className="text-xs text-red-500">{nameError}</p>}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white outline-none transition focus:ring-2 focus:ring-indigo-400"
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-500">
            カラー
          </label>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {DEFAULT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition ${
                  color === c
                    ? "ring-2 ring-offset-1 ring-gray-600 scale-110"
                    : ""
                }`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="w-full rounded-lg bg-indigo-500 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 active:scale-95"
      >
        + 追加
      </button>
    </div>
  );
}
