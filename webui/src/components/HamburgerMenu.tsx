"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/leagues", label: "リーグ一覧" },
  { href: "/leagues/create", label: "リーグを作成" },
];

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="メニューを開く"
        aria-expanded={open}
        className="fixed right-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-line-2 bg-ink-2/80 text-fg-2 backdrop-blur-md transition hover:text-fg active:scale-95 lg:right-6 lg:top-5"
      >
        <span className="flex flex-col gap-[5px]">
          <span className="h-0.5 w-5 rounded-full bg-current" />
          <span className="h-0.5 w-5 rounded-full bg-current" />
          <span className="h-0.5 w-5 rounded-full bg-current" />
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="メニュー"
          className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <nav className="flex h-full w-64 flex-col gap-2 border-l border-line bg-ink-1 p-5 shadow-[0_0_72px_rgba(139,92,246,0.45)]">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-fg-3">
                menu
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="メニューを閉じる"
                className="rounded-full p-1 text-fg-3 transition hover:text-fg"
              >
                ✕
              </button>
            </div>
            {LINKS.map((link) => {
              const active =
                link.href === "/leagues"
                  ? pathname === "/leagues"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                    active
                      ? "border-violet-500/60 bg-violet-500/15 font-bold text-fg"
                      : "border-line bg-ink-2 text-fg-2 hover:border-violet-500/40 hover:text-fg"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
