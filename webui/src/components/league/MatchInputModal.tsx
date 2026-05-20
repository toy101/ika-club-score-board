"use client";

import { useEffect, useState } from "react";
import type { Match, Team } from "@/types/league";
import { TeamColorDot } from "@/components/league/TeamColorDot";

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
    existingMatch !== undefined ? existingMatch.homeScore : 0,
  );
  const [opponentScore, setOpponentScore] = useState(
    existingMatch !== undefined ? existingMatch.awayScore : 0,
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
    if (selfScore < 0 || opponentScore < 0) {
      setLocalError("0以上の整数を入力してね〜");
      return;
    }
    setLocalError(null);
    onSave(selfScore, opponentScore);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel();
      }}
    >
      <form
        noValidate
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-ink-2 p-6 shadow-[0_0_72px_rgba(139,92,246,0.55),0_0_24px_rgba(139,92,246,0.35)]"
      >
        <div className="flex items-start justify-between gap-2">
          <h3
            id="match-modal-title"
            className="flex items-center gap-2 text-sm font-bold text-fg"
          >
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
            対戦結果を入力
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="閉じる"
            className="-mr-1 -mt-1 rounded-full p-1 text-fg-3 transition hover:text-fg disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamCard label="self" team={homeTeam} />
          <span className="font-mono text-xs font-light text-fg-3">vs</span>
          <TeamCard label="opp" team={awayTeam} />
        </div>

        <div className="space-y-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-3">
            score
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <ScoreStepper
              label={`${homeTeam.name}のスコア`}
              value={selfScore}
              onChange={(v) => {
                setSelfScore(v);
                if (localError) setLocalError(null);
              }}
            />
            <span className="font-mono text-lg font-light text-fg-3">-</span>
            <ScoreStepper
              label={`${awayTeam.name}のスコア`}
              value={opponentScore}
              onChange={(v) => {
                setOpponentScore(v);
                if (localError) setLocalError(null);
              }}
            />
          </div>
        </div>

        {otherSideMatch && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              hasMismatch
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
            }`}
          >
            <p className="font-medium">
              {hasMismatch ? "⚠ " : ""}
              相手の申告: {homeTeam.name} {otherClaimSelf} - {awayTeam.name}{" "}
              {otherClaimOpponent}
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

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-lg border border-line-2 bg-ink-3/50 py-2 text-sm text-fg-2 transition hover:bg-ink-3 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 py-2 text-sm font-bold text-white shadow-[0_0_30px_rgba(139,92,246,0.7),0_0_12px_rgba(34,211,238,0.5)] transition hover:brightness-125 hover:shadow-[0_0_44px_rgba(139,92,246,0.9),0_0_18px_rgba(34,211,238,0.6)] active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "保存中…" : existingMatch ? "更新する" : "保存する"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ScoreStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const stepBtn =
    "flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-lg border border-line-2 bg-ink-3/50 text-lg font-bold text-fg-2 transition hover:bg-ink-3 hover:text-fg active:scale-95 disabled:opacity-40 disabled:hover:bg-ink-3/50";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label={`${label}を1減らす`}
        className={stepBtn}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={value}
        onChange={(e) => {
          const next = parseInt(e.target.value, 10);
          onChange(Number.isNaN(next) || next < 0 ? 0 : next);
        }}
        aria-label={label}
        className="w-full min-w-0 rounded-lg border border-line-2 bg-ink-1 px-1 py-2.5 text-center font-mono text-2xl font-bold text-fg outline-none transition-colors focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/60 focus:shadow-[0_0_22px_rgba(34,211,238,0.55),0_0_8px_rgba(34,211,238,0.4)]"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label={`${label}を1増やす`}
        className={stepBtn}
      >
        ＋
      </button>
    </div>
  );
}

function TeamCard({ label, team }: { label: string; team: Team }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl border border-line bg-ink-1 px-2 py-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-3">
        {label}
      </span>
      <TeamColorDot color={team.color} size="md" />
      <span className="w-full truncate text-center text-sm font-bold text-fg">
        {team.name}
      </span>
    </div>
  );
}
