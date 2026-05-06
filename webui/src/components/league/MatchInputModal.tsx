"use client";

import { useEffect, useState } from "react";
import type { Match, Team } from "@/types/league";

type Props = {
  homeTeam: Team;
  awayTeam: Team;
  existingMatch?: Match;
  otherSideMatch?: Match;
  saving: boolean;
  error: string | null;
  onSave: (homeScore: number, awayScore: number) => void;
  onCancel: () => void;
};

export default function MatchInputModal({
  homeTeam,
  awayTeam,
  existingMatch,
  otherSideMatch,
  saving,
  error,
  onSave,
  onCancel,
}: Props) {
  const [selfScore, setSelfScore] = useState(
    existingMatch !== undefined ? String(existingMatch.homeScore) : ""
  );
  const [opponentScore, setOpponentScore] = useState(
    existingMatch !== undefined ? String(existingMatch.awayScore) : ""
  );
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onCancel();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onCancel, saving]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const self = parseInt(selfScore, 10);
    const opp = parseInt(opponentScore, 10);
    if (
      Number.isNaN(self) ||
      Number.isNaN(opp) ||
      self < 0 ||
      opp < 0
    ) {
      setLocalError("0以上の整数を入力してね〜");
      return;
    }
    setLocalError(null);
    onSave(self, opp);
  }

  const otherClaimSelf = otherSideMatch?.awayScore;
  const otherClaimOpponent = otherSideMatch?.homeScore;
  const hasMismatch =
    !!existingMatch &&
    !!otherSideMatch &&
    (existingMatch.homeScore !== otherSideMatch.awayScore ||
      existingMatch.awayScore !== otherSideMatch.homeScore);

  const displayError = localError ?? error;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel();
      }}
    >
      <form
        noValidate
        onSubmit={handleSubmit}
        className="w-full max-h-[92vh] space-y-4 overflow-y-auto rounded-t-3xl border border-line bg-ink-2 p-5 shadow-[0_-12px_72px_rgba(139,92,246,0.55),0_-6px_28px_rgba(139,92,246,0.4)] sm:max-w-md sm:rounded-2xl sm:shadow-[0_0_96px_rgba(139,92,246,0.6),0_0_32px_rgba(139,92,246,0.4)]"
      >
        <div className="flex items-center justify-between">
          <h2
            id="match-modal-title"
            className="flex items-center gap-2 text-sm font-bold text-fg"
          >
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
            対戦結果を入力
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="閉じる"
            className="rounded-full px-2 py-0.5 text-xl leading-none text-fg-3 transition-colors hover:bg-ink-3 hover:text-fg disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-line bg-ink-1 p-3">
          <TeamBadge label="SELF" team={homeTeam} />
          <span className="font-mono text-sm font-light text-fg-3">VS</span>
          <TeamBadge label="OPP" team={awayTeam} />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="self-score"
              className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-fg-3"
            >
              self.score
            </label>
            <input
              id="self-score"
              type="number"
              inputMode="numeric"
              min="0"
              value={selfScore}
              onChange={(e) => {
                setSelfScore(e.target.value);
                if (localError) setLocalError(null);
              }}
              autoFocus
              className="w-full rounded-xl border-2 border-line-2 bg-ink-1 py-3 text-center font-mono text-3xl font-bold text-fg outline-none transition-all focus:border-cyan-400 focus:shadow-[0_0_36px_rgba(34,211,238,0.65),0_0_12px_rgba(34,211,238,0.5)]"
            />
          </div>
          <span className="pb-3 font-mono text-2xl font-light text-fg-3">-</span>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="opp-score"
              className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-fg-3"
            >
              opp.score
            </label>
            <input
              id="opp-score"
              type="number"
              inputMode="numeric"
              min="0"
              value={opponentScore}
              onChange={(e) => {
                setOpponentScore(e.target.value);
                if (localError) setLocalError(null);
              }}
              className="w-full rounded-xl border-2 border-line-2 bg-ink-1 py-3 text-center font-mono text-3xl font-bold text-fg outline-none transition-all focus:border-cyan-400 focus:shadow-[0_0_36px_rgba(34,211,238,0.65),0_0_12px_rgba(34,211,238,0.5)]"
            />
          </div>
        </div>

        {otherSideMatch && (
          <div
            className={`rounded-xl border px-3 py-2 text-xs ${
              hasMismatch
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
            }`}
          >
            <p className="font-medium">
              {hasMismatch ? "⚠ " : "ℹ "}
              相手の申告: 自 {otherClaimSelf} - 相 {otherClaimOpponent}
            </p>
            {hasMismatch && (
              <p className="mt-0.5 opacity-80">
                両チームの申告を一致させると確定するよ〜
              </p>
            )}
          </div>
        )}

        {displayError && (
          <p className="text-xs text-rose-400" role="alert">
            {displayError}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-xl border border-line-2 bg-ink-3/50 py-3 font-medium text-fg-2 transition-colors hover:bg-ink-3 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-[2] rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 py-3 font-bold text-white shadow-[0_0_36px_rgba(139,92,246,0.7),0_0_14px_rgba(217,70,239,0.55),0_0_8px_rgba(34,211,238,0.4)] transition-all hover:brightness-125 hover:shadow-[0_0_52px_rgba(139,92,246,0.9),0_0_22px_rgba(217,70,239,0.7),0_0_12px_rgba(34,211,238,0.55)] active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "保存中…" : existingMatch ? "更新する" : "保存する"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TeamBadge({ label, team }: { label: string; team: Team }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-fg-3">
        {label}
      </span>
      <span
        className="inline-block h-4 w-4 rounded-full"
        style={{ backgroundColor: team.color, boxShadow: `0 0 24px ${team.color}, 0 0 10px ${team.color}` }}
      />
      <span className="w-full truncate text-center text-sm font-bold text-fg">
        {team.name}
      </span>
    </div>
  );
}
