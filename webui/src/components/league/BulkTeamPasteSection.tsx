"use client";

import { useMemo, useState } from "react";
import type { TeamInput } from "@/types/league";

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

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const SAMPLE_TSV = `アオリ\tホタル\tヒメ\tイイダ
タコ1\tタコ2\tタコ3\tタコ4\t#22c55e`;

type Props = {
  currentTeamCount: number;
  onAddTeamsBulk: (inputs: TeamInput[]) => void;
};

type ParsedRow = {
  lineNo: number;
  autoName: string;
  memberNames: [string, string, string, string];
  color: string;
  error: string | null;
};

function parseRows(rawText: string, currentTeamCount: number): ParsedRow[] {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const draftRows: ParsedRow[] = [];
  let validIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;

    const cols = line.split("\t");
    const memberNames: [string, string, string, string] = [
      (cols[0] ?? "").trim(),
      (cols[1] ?? "").trim(),
      (cols[2] ?? "").trim(),
      (cols[3] ?? "").trim(),
    ];
    const colorCol = (cols[4] ?? "").trim();

    let error: string | null = null;
    let color = "";

    if (cols.length > 5) {
      error = "列が多すぎます (メンバー4人 + 色)";
    }

    if (!error) {
      if (colorCol) {
        if (!COLOR_PATTERN.test(colorCol)) {
          error = "色は #RRGGBB 形式で指定してください";
        } else {
          color = colorCol.toLowerCase();
        }
      } else {
        color =
          DEFAULT_COLORS[(currentTeamCount + validIndex) % DEFAULT_COLORS.length];
      }
    }

    const autoName = `チーム${currentTeamCount + validIndex + 1}`;
    if (!error) validIndex++;

    draftRows.push({ lineNo: i + 1, autoName, memberNames, color, error });
  }

  return draftRows;
}

export function BulkTeamPasteSection({
  currentTeamCount,
  onAddTeamsBulk,
}: Props) {
  const [rawText, setRawText] = useState("");

  const parsedRows = useMemo(
    () => parseRows(rawText, currentTeamCount),
    [rawText, currentTeamCount],
  );

  const validRows = parsedRows.filter((r) => !r.error);
  const hasError = parsedRows.some((r) => r.error);
  const canConfirm = parsedRows.length > 0 && !hasError;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const inputs: TeamInput[] = validRows.map((row) => ({
      color: row.color,
      memberNames: row.memberNames,
    }));
    onAddTeamsBulk(inputs);
    setRawText("");
  };

  return (
    <section className="hidden space-y-4 rounded-2xl border border-line bg-ink-2 p-5 lg:block">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-fg">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
          <span>Excel / スプレッドシートから一括追加</span>
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-3">
          paste.tsv
        </span>
      </div>

      <div className="space-y-1 text-xs text-fg-2">
        <p>セルをドラッグしてコピー → 下のテキストエリアに貼り付け。</p>
        <p className="font-mono text-[10px] text-fg-3">
          書式: メンバー1 [TAB] メンバー2 [TAB] メンバー3 [TAB] メンバー4 [TAB] #RRGGBB(任意)
        </p>
        <p className="text-[10px] text-fg-3">※ チーム名は自動採番 (チーム1, チーム2 …)</p>
      </div>

      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder={SAMPLE_TSV}
        rows={8}
        className="w-full rounded-lg border border-line-2 bg-ink-1 px-3 py-2 font-mono text-xs text-fg outline-none transition placeholder:text-fg-3/60 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/60 focus:shadow-[0_0_22px_rgba(34,211,238,0.55),0_0_8px_rgba(34,211,238,0.4)]"
      />

      {parsedRows.length > 0 && (
        <div className="max-h-72 overflow-auto rounded-lg border border-line bg-ink-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-ink-3 text-fg-2">
              <tr>
                <th className="w-12 px-2 py-2 text-left font-medium">行</th>
                <th className="px-2 py-2 text-left font-medium">チーム名</th>
                <th className="px-2 py-2 text-left font-medium">メンバー</th>
                <th className="w-12 px-2 py-2 text-left font-medium">色</th>
                <th className="px-2 py-2 text-left font-medium">状態</th>
              </tr>
            </thead>
            <tbody>
              {parsedRows.map((row) => (
                <tr
                  key={row.lineNo}
                  className={`border-t border-line/60 ${
                    row.error ? "bg-rose-500/10" : ""
                  }`}
                >
                  <td className="px-2 py-1.5 font-mono text-fg-3">
                    {row.lineNo}
                  </td>
                  <td className="px-2 py-1.5 text-fg-2">
                    {row.error ? (
                      <span className="text-fg-3">—</span>
                    ) : (
                      <>
                        {row.autoName}
                        <span className="ml-1 text-[10px] text-fg-3">(自動)</span>
                      </>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-fg-2">
                    {row.memberNames.map((m) => m || "…").join(" / ")}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.color ? (
                      <span
                        className="inline-block h-4 w-4 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                    ) : (
                      <span className="text-fg-3">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.error ? (
                      <span className="text-rose-400">⚠ {row.error}</span>
                    ) : (
                      <span className="text-emerald-400">✓ OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-2 text-sm font-bold text-white shadow-[0_0_30px_rgba(139,92,246,0.7),0_0_12px_rgba(34,211,238,0.5)] transition hover:brightness-125 hover:shadow-[0_0_44px_rgba(139,92,246,0.9),0_0_18px_rgba(34,211,238,0.6)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {validRows.length > 0 ? `${validRows.length} 件まとめて追加` : "まとめて追加"}
        </button>
      </div>
    </section>
  );
}
