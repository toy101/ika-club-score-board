"use client";

import { useEffect, useRef, useState } from "react";
import { getTeam, updateTeamRoomUrl } from "@/lib/api";
import type { Team } from "@/types/league";
import { TeamColorDot } from "./TeamColorDot";

type Props = {
  leagueId: string;
  team: Team;
  onClose: () => void;
};

type LoadState = "loading" | "ready" | "error";

const URL_GUIDANCE = "https://s.nintendo.com/... の形式で入力してね〜";

function normalizeHeyatateUrl(value: string): string {
  const trimmed = value.trim();
  if (
    !/^https:\/\/s\.nintendo\.com\//i.test(trimmed) ||
    /[\u0000-\u001f\u007f\\]/.test(trimmed)
  ) {
    throw new Error(URL_GUIDANCE);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(URL_GUIDANCE);
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "s.nintendo.com" ||
    parsed.host !== "s.nintendo.com" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname === "/"
  ) {
    throw new Error(URL_GUIDANCE);
  }

  return parsed.href;
}

export default function HeyatateModal({ leagueId, team, onClose }: Props) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [roomUrl, setRoomUrl] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusyState] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const busyRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  function setBusy(next: boolean) {
    busyRef.current = next;
    setBusyState(next);
  }

  useEffect(() => {
    const controller = new AbortController();

    void getTeam(leagueId, team.id, controller.signal)
      .then((latestTeam) => {
        if (controller.signal.aborted) return;
        const latestUrl = latestTeam.roomUrl?.trim() ?? "";
        if (latestUrl === "") {
          setRoomUrl("");
          setDraft("");
        } else {
          const normalized = normalizeHeyatateUrl(latestUrl);
          setRoomUrl(normalized);
          setDraft(normalized);
        }
        setLoadState("ready");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "ヘヤタテURLを取得できませんでした",
        );
        setLoadState("error");
      });

    return () => controller.abort();
  }, [leagueId, reloadKey, team.id]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled])',
        ) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  async function handleSave(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;

    let normalized: string;
    try {
      normalized = normalizeHeyatateUrl(draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : URL_GUIDANCE);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const updated = await updateTeamRoomUrl(leagueId, team.id, normalized);
      if (typeof updated.roomUrl !== "string") {
        throw new Error("URLの更新結果を確認できませんでした");
      }
      const savedUrl = normalizeHeyatateUrl(updated.roomUrl);
      if (savedUrl !== normalized) {
        throw new Error("URLの更新結果を確認できませんでした");
      }
      setRoomUrl(savedUrl);
      setDraft(savedUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busyRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateTeamRoomUrl(leagueId, team.id, "");
      if (updated.roomUrl !== "") {
        throw new Error("URLの削除結果を確認できませんでした");
      }
      setRoomUrl("");
      setDraft("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="heyatate-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busyRef.current) onClose();
      }}
    >
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-ink-2 p-6 shadow-[0_0_72px_rgba(139,92,246,0.55),0_0_24px_rgba(139,92,246,0.35)]">
        <div className="flex items-start justify-between gap-2">
          <h3
            id="heyatate-modal-title"
            className="flex min-w-0 items-center gap-2 text-sm font-bold text-fg"
          >
            <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
            <TeamColorDot color={team.color} size="sm" />
            <span className="truncate">{team.name}のヘヤタテ</span>
          </h3>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="閉じる"
            className="-mr-1 -mt-1 rounded-full p-1 text-fg-3 transition hover:text-fg disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {loadState === "loading" && (
          <p role="status" className="py-4 text-center text-sm text-fg-3">
            URLを確認中…
          </p>
        )}

        {loadState === "error" && (
          <div className="space-y-3">
            {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
            <button
              type="button"
              onClick={() => {
                setLoadState("loading");
                setError(null);
                setReloadKey((key) => key + 1);
              }}
              className="w-full rounded-lg border border-line-2 bg-ink-3/50 py-2 text-sm text-fg-2 transition hover:bg-ink-3"
            >
              再試行
            </button>
          </div>
        )}

        {loadState === "ready" && roomUrl === "" && (
          <form noValidate onSubmit={handleSave} className="space-y-3">
            <label className="block space-y-1.5 text-xs text-fg-2">
              ヘヤタテURL
              <input
                type="url"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (error) setError(null);
                }}
                disabled={busy}
                placeholder="https://s.nintendo.com/..."
                autoComplete="off"
                className="mt-1.5 w-full rounded-lg border border-line-2 bg-ink-1 px-3 py-2 text-sm text-fg outline-none transition placeholder:text-fg-3 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/60"
              />
            </label>
            {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 py-2 text-sm font-bold text-white shadow-[0_0_30px_rgba(139,92,246,0.7),0_0_12px_rgba(34,211,238,0.5)] transition hover:brightness-125 disabled:opacity-50"
            >
              {busy ? "登録中…" : "登録する"}
            </button>
          </form>
        )}

        {loadState === "ready" && roomUrl !== "" && (
          <div className="space-y-3">
            <a
              href={roomUrl}
              className="block w-full rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 py-2 text-center text-sm font-bold text-white shadow-[0_0_30px_rgba(139,92,246,0.7),0_0_12px_rgba(34,211,238,0.5)] transition hover:brightness-125"
            >
              ヘアタテリンクを使う
            </a>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={busy}
              className="w-full rounded-lg border border-rose-500/40 bg-rose-500/10 py-2 text-sm text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              {busy ? "削除中…" : "登録URLを削除する"}
            </button>
            {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
