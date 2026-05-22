"use client";

import { useEffect, useRef, useState } from "react";

type Mode = {
  label: string;
  accent: string;
  active: string;
};

const MODES: Mode[] = [
  {
    label: "エリア",
    accent: "from-violet-500/15 to-fuchsia-500/10",
    active:
      "border-violet-400/70 from-violet-500/45 to-fuchsia-500/30 text-violet-100",
  },
  {
    label: "ヤグラ",
    accent: "from-cyan-500/15 to-violet-500/10",
    active:
      "border-cyan-400/70 from-cyan-500/45 to-violet-500/30 text-cyan-100",
  },
  {
    label: "ホコ",
    accent: "from-amber-500/15 to-fuchsia-500/10",
    active:
      "border-amber-400/70 from-amber-500/45 to-fuchsia-500/30 text-amber-100",
  },
  {
    label: "アサリ",
    accent: "from-rose-500/15 to-fuchsia-500/10",
    active:
      "border-rose-400/70 from-rose-500/45 to-fuchsia-500/30 text-rose-100",
  },
];

export default function ModeRoulette() {
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [resultIndex, setResultIndex] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function spin() {
    if (spinning) return;
    setSpinning(true);
    setResultIndex(null);

    const finalIndex = Math.floor(Math.random() * MODES.length);
    const extraLoops = 3 + Math.floor(Math.random() * 2);
    const totalSteps = extraLoops * MODES.length + finalIndex;

    let step = 0;
    const tick = () => {
      setHighlightIndex(step % MODES.length);
      if (step >= totalSteps) {
        setResultIndex(finalIndex);
        setSpinning(false);
        timeoutRef.current = null;
        return;
      }
      step += 1;
      const progress = step / totalSteps;
      const delay = 55 + progress * progress * 300;
      timeoutRef.current = setTimeout(tick, delay);
    };
    tick();
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-ink-2 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-fg">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
        ルールルーレット
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {MODES.map((mode, i) => {
          const isActive = highlightIndex === i;
          return (
            <div
              key={mode.label}
              className={`relative overflow-hidden rounded-xl border bg-gradient-to-br py-4 text-center transition-all duration-100 ${
                isActive
                  ? `${mode.active} scale-[1.03]`
                  : `border-line ${mode.accent} text-fg-2`
              }`}
            >
              <p className="text-base font-bold">{mode.label}</p>
            </div>
          );
        })}
      </div>

      <div className="min-h-[1.5rem] text-center">
        {resultIndex !== null && (
          <p className="text-sm text-fg-2">
            次のバトルは{" "}
            <span className="font-bold text-fg">
              {MODES[resultIndex].label}
            </span>{" "}
            だよ〜！
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={spin}
        disabled={spinning}
        className="w-full rounded-xl border border-violet-400/40 bg-gradient-to-r from-violet-500/30 to-cyan-500/30 py-3 text-sm font-bold text-fg transition-all hover:from-violet-500/45 hover:to-cyan-500/45 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {spinning ? "抽選中…" : "ルーレットを回す"}
      </button>
    </section>
  );
}
