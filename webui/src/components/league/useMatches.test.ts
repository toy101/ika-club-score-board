import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listMatches } from "@/lib/api";
import type { Match } from "@/types/league";
import { useMatches } from "./useMatches";

vi.mock("@/lib/api", () => ({ listMatches: vi.fn() }));

const match: Match = {
  id: "match-a", homeTeamId: "a", awayTeamId: "b", homeScore: 3, awayScore: 1,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.mocked(listMatches).mockReset().mockResolvedValue([match]);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => vi.restoreAllMocks());

describe("useMatches refresh", () => {
  it("tracks successful fetch time and keeps results and time on refresh failure", async () => {
    const { result } = renderHook(() => useMatches("league-a"));
    await waitFor(() => expect(result.current.lastUpdatedAt).toBeInstanceOf(Date));
    const lastUpdatedAt = result.current.lastUpdatedAt;
    const pending = deferred<Match[]>();
    vi.mocked(listMatches).mockReturnValueOnce(pending.promise);
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refetch(); });
    expect(result.current.refreshing).toBe(true);
    expect(result.current.matches).toEqual([match]);
    await act(async () => { pending.reject(new Error("offline")); await refresh; });
    expect(result.current.matches).toEqual([match]);
    expect(result.current.lastUpdatedAt).toBe(lastUpdatedAt);
    expect(result.current.refreshError).toContain("最新ではない可能性");
    expect(result.current.refreshing).toBe(false);
    await act(() => result.current.refetch());
    expect(result.current.refreshError).toBeNull();
  });

  it("refreshes on visible focus and tab return and skips hidden events", async () => {
    const { result } = renderHook(() => useMatches("league-a"));
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    act(() => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(listMatches).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(listMatches).toHaveBeenCalledTimes(2);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await waitFor(() => expect(listMatches).toHaveBeenCalledTimes(3));
  });

  it("coalesces simultaneous focus and visibility events while fetching", async () => {
    const pending = deferred<Match[]>();
    vi.mocked(listMatches).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useMatches("league-a"));
    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(listMatches).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve([match]); });
    expect(result.current.refreshing).toBe(false);
  });

  it("ignores an older response after a newer refresh completes", async () => {
    const old = deferred<Match[]>();
    vi.mocked(listMatches).mockReturnValueOnce(old.promise);
    const { result } = renderHook(() => useMatches("league-a"));
    const oldSignal = vi.mocked(listMatches).mock.calls[0][1];
    const updated = { ...match, homeScore: 5 };
    vi.mocked(listMatches).mockResolvedValueOnce([updated]);
    await act(() => result.current.refetch());
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { old.resolve([match]); });
    expect(result.current.matches).toEqual([updated]);
  });

  it("resets data for a different league and ignores the old league response", async () => {
    const { result, rerender } = renderHook(({ id }) => useMatches(id), {
      initialProps: { id: "league-a" },
    });
    await waitFor(() => expect(result.current.matches).toEqual([match]));
    const old = deferred<Match[]>();
    vi.mocked(listMatches).mockReturnValueOnce(old.promise);
    act(() => { void result.current.refetch(); });
    const next = deferred<Match[]>();
    vi.mocked(listMatches).mockReturnValueOnce(next.promise);
    rerender({ id: "league-b" });
    expect(result.current.matches).toEqual([]);
    expect(result.current.lastUpdatedAt).toBeNull();
    await act(async () => { old.resolve([match]); });
    expect(result.current.matches).toEqual([]);
    await act(async () => { next.resolve([]); });
    expect(result.current.lastUpdatedAt).toBeInstanceOf(Date);
  });

  it("aborts and removes return listeners on unmount", async () => {
    const pending = deferred<Match[]>();
    vi.mocked(listMatches).mockReturnValueOnce(pending.promise);
    const { unmount } = renderHook(() => useMatches("league-a"));
    const signal = vi.mocked(listMatches).mock.calls[0][1];
    unmount();
    expect(signal?.aborted).toBe(true);
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(listMatches).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve([match]); });
  });
});
