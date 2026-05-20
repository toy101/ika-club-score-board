"use client";

import { useState, useEffect, useCallback } from "react";
import type { Match } from "@/types/league";
import { listMatches } from "@/lib/api";

type UseMatchesResult = {
  matches: Match[];
  refetch: () => Promise<void>;
};

export function useMatches(leagueId: string): UseMatchesResult {
  const [matches, setMatches] = useState<Match[]>([]);

  const refetch = useCallback(async () => {
    try {
      const data = await listMatches(leagueId);
      setMatches(data);
    } catch {
      // 失敗時は空のまま表示
    }
  }, [leagueId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回ロード（leagueId 変化時の再フェッチ含む）
    refetch();
  }, [refetch]);

  return { matches, refetch };
}
