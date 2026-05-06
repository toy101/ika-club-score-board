"use client";

import { useState } from "react";
import type { Team } from "@/types/league";

type Props = {
  team: Team;
  onEdit: (team: Team) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
};

const DEFAULT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#94a3b8",
];

export function TeamItem({ team, onEdit, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(team.name);
  const [editColor, setEditColor] = useState(team.color);
  const [editMemberNames, setEditMemberNames] = useState<[string, string, string, string]>(
    [team.members[0].name, team.members[1].name, team.members[2].name, team.members[3].name]
  );

  const handleEditMemberNameChange = (index: number, value: string) => {
    const next = [...editMemberNames] as [string, string, string, string];
    next[index] = value;
    setEditMemberNames(next);
  };

  const handleEditSave = () => {
    if (!editName.trim()) return;
    const members: Team["members"] = [
      { name: editMemberNames[0] },
      { name: editMemberNames[1] },
      { name: editMemberNames[2] },
      { name: editMemberNames[3] },
    ];
    onEdit({ ...team, name: editName.trim(), color: editColor, members });
    setShowEditModal(false);
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-ink-1 px-3 py-3 transition hover:border-violet-500/40">
        <span
          className="h-3 w-3 flex-shrink-0 rounded-full"
          style={{ backgroundColor: team.color, boxShadow: `0 0 18px ${team.color}, 0 0 6px ${team.color}` }}
        />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-bold text-fg">{team.name}</p>
          <p className="truncate text-xs text-fg-3">
            {team.members.map((m) => m.name || "…").join(" / ")}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMoveUp(team.id)}
            disabled={isFirst}
            className="p-1.5 text-fg-3 transition hover:text-cyan-400 disabled:opacity-30 disabled:hover:text-fg-3"
            aria-label="上へ"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(team.id)}
            disabled={isLast}
            className="p-1.5 text-fg-3 transition hover:text-cyan-400 disabled:opacity-30 disabled:hover:text-fg-3"
            aria-label="下へ"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="p-1.5 text-fg-3 transition hover:text-violet-400"
            aria-label="編集"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 text-fg-3 transition hover:text-rose-400"
            aria-label="削除"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-ink-2 p-6 shadow-[0_0_72px_rgba(244,63,94,0.5),0_0_24px_rgba(244,63,94,0.35)]">
            <p className="text-sm font-bold text-fg">
              「{team.name}」を削除しますか？
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-line-2 bg-ink-3/50 py-2 text-sm text-fg-2 transition hover:bg-ink-3"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => onDelete(team.id)}
                className="flex-1 rounded-lg bg-gradient-to-r from-rose-600 to-fuchsia-600 py-2 text-sm font-bold text-white shadow-[0_0_30px_rgba(244,63,94,0.7),0_0_12px_rgba(244,63,94,0.5)] transition hover:brightness-125 hover:shadow-[0_0_44px_rgba(244,63,94,0.9),0_0_18px_rgba(244,63,94,0.6)]"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-ink-2 p-6 shadow-[0_0_72px_rgba(139,92,246,0.55),0_0_24px_rgba(139,92,246,0.35)]">
            <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
              <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
              チームを編集
            </h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-fg-2">
                  チーム名 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-line-2 bg-ink-1 px-3 py-2 text-sm text-fg outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/60 focus:shadow-[0_0_22px_rgba(34,211,238,0.55),0_0_8px_rgba(34,211,238,0.4)]"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-fg-2">メンバー（4人）</p>
                <div className="grid grid-cols-2 gap-2">
                  {editMemberNames.map((memberName, i) => (
                    <input
                      key={i}
                      type="text"
                      value={memberName}
                      onChange={(e) => handleEditMemberNameChange(i, e.target.value)}
                      placeholder={`メンバー${i + 1}`}
                      className="w-full rounded-lg border border-line-2 bg-ink-1 px-3 py-2 text-sm text-fg outline-none transition placeholder:text-fg-3 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/60 focus:shadow-[0_0_22px_rgba(34,211,238,0.55),0_0_8px_rgba(34,211,238,0.4)]"
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-fg-2">カラー</label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`h-7 w-7 rounded-full transition-all ${
                        editColor === c
                          ? "scale-110 ring-2 ring-cyan-400 ring-offset-2 ring-offset-ink-2"
                          : "opacity-70 hover:opacity-100"
                      }`}
                      style={{
                        backgroundColor: c,
                        boxShadow: editColor === c ? `0 0 24px ${c}, 0 0 10px ${c}` : undefined,
                      }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 rounded-lg border border-line-2 bg-ink-3/50 py-2 text-sm text-fg-2 transition hover:bg-ink-3"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                className="flex-1 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 py-2 text-sm font-bold text-white shadow-[0_0_30px_rgba(139,92,246,0.7),0_0_12px_rgba(34,211,238,0.5)] transition hover:brightness-125 hover:shadow-[0_0_44px_rgba(139,92,246,0.9),0_0_18px_rgba(34,211,238,0.6)]"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
