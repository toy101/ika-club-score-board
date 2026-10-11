"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Match } from "@/types/league";
import { listMatches } from "@/lib/api";

type UseMatchesResult = {
  matches: Match[];
  refreshing: boolean;
  lastUpdatedAt: Date | null;
  refreshError: string | null;
  refetch: () => Promise<void>;
};

export function useMatches(leagueId: string): UseMatchesResult {
  const [matches, setMatches] = useState<Match[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    // 保存後の再取得は、保存前に開始した取得より必ず新しくする。
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const data = await listMatches(leagueId, controller.signal);
      if (controller.signal.aborted) return;
      setMatches(data);
      setLastUpdatedAt(new Date());
    } catch {
      if (controller.signal.aborted) return;
      setRefreshError(
        "結果を更新できませんでした。表示中の結果は最新ではない可能性があります。もう一度更新してください。",
      );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setRefreshing(false);
      }
    }
  }, [leagueId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- リーグ変更時に前のリーグの表示をリセットする
    setMatches([]);
    setLastUpdatedAt(null);
    void refetch();

    function refreshOnReturn() {
      if (document.visibilityState === "visible" && !requestRef.current) {
        void refetch();
      }
    }

    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [refetch]);

  return { matches, refreshing, lastUpdatedAt, refreshError, refetch };
}
