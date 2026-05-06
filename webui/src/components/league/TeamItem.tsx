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
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
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
      <div className="flex items-center gap-3 rounded-xl bg-white border border-gray-200 px-3 py-3">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: team.color }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{team.name}</p>
          <p className="text-xs text-gray-400 truncate">
            {team.members.map((m) => m.name || "…").join(" / ")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMoveUp(team.id)}
            disabled={isFirst}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            aria-label="上へ"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(team.id)}
            disabled={isLast}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            aria-label="下へ"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="p-1 text-gray-400 hover:text-indigo-500"
            aria-label="編集"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1 text-gray-400 hover:text-red-500"
            aria-label="削除"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <p className="text-sm font-semibold text-gray-700">
              「{team.name}」を削除しますか？
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => onDelete(team.id)}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">チームを編集</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">
                  チーム名 <span className="text-red-500">*</span>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </label>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500">メンバー（4人）</p>
                <div className="grid grid-cols-2 gap-2">
                  {editMemberNames.map((memberName, i) => (
                    <input
                      key={i}
                      type="text"
                      value={memberName}
                      onChange={(e) => handleEditMemberNameChange(i, e.target.value)}
                      placeholder={`メンバー${i + 1}`}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">カラー</label>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-6 h-6 rounded-full transition ${
                        editColor === c ? "ring-2 ring-offset-1 ring-gray-600 scale-110" : ""
                      }`}
                      style={{ backgroundColor: c }}
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
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                className="flex-1 rounded-lg bg-indigo-500 py-2 text-sm font-semibold text-white hover:bg-indigo-600"
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
