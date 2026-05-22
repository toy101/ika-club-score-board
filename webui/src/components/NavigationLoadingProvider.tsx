"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type NavigationLoadingContextValue = {
  /** Show the loading overlay for a navigation that is about to start. */
  startNavigating: () => void;
};

const NavigationLoadingContext =
  createContext<NavigationLoadingContextValue | null>(null);

/** Delay before the overlay appears, so instant navigations don't flash it. */
const SHOW_DELAY_MS = 150;
/** Safety net: force-hide the overlay if a navigation never resolves. */
const MAX_VISIBLE_MS = 15000;

/**
 * Access the navigation loading controls. Use `startNavigating()` right before
 * a programmatic navigation (e.g. `router.push`) so the overlay shows during
 * the destination page's data fetch. `<Link>` clicks are detected automatically.
 */
export function useNavigationLoading(): NavigationLoadingContextValue {
  const ctx = useContext(NavigationLoadingContext);
  if (!ctx) {
    throw new Error(
      "useNavigationLoading must be used within a NavigationLoadingProvider",
    );
  }
  return ctx;
}

export default function NavigationLoadingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const stopNavigating = useCallback(() => {
    clearTimers();
    setVisible(false);
  }, [clearTimers]);

  const startNavigating = useCallback(() => {
    clearTimers();
    showTimerRef.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    maxTimerRef.current = setTimeout(stopNavigating, MAX_VISIBLE_MS);
  }, [clearTimers, stopNavigating]);

  // The route segment is committed once `pathname` changes: navigation is done.
  useEffect(() => {
    stopNavigating();
  }, [pathname, stopNavigating]);

  // Detect `<Link>` (and plain anchor) navigations without touching each link.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      const url = new URL(anchor.href, window.location.href);
      // Different origin -> full page load, the browser handles feedback.
      if (url.origin !== window.location.origin) return;
      // Same route -> no transition (hash-only links land here too).
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      startNavigating();
    }

    document.addEventListener("click", onClick, { capture: true });
    return () =>
      document.removeEventListener("click", onClick, { capture: true });
  }, [startNavigating]);

  // Browser back/forward also triggers a server fetch on uncached routes.
  useEffect(() => {
    window.addEventListener("popstate", startNavigating);
    return () => window.removeEventListener("popstate", startNavigating);
  }, [startNavigating]);

  const value = useMemo(() => ({ startNavigating }), [startNavigating]);

  return (
    <NavigationLoadingContext.Provider value={value}>
      {children}
      {visible && (
        <div
          role="status"
          aria-live="polite"
          aria-label="読み込み中"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-ink-0/50 backdrop-blur-md animate-[nav-loading-fade-in_180ms_ease-out]"
        >
          <span className="h-12 w-12 animate-spin rounded-full border-[3px] border-line-2 border-t-violet-400 shadow-[0_0_24px_rgba(139,92,246,0.6)]" />
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-fg-2">
            読み込み中…
          </p>
        </div>
      )}
    </NavigationLoadingContext.Provider>
  );
}
