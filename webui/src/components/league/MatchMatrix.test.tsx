import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMatch, getTeam, listMatches, updateMatch, updateTeamRoomUrl } from "@/lib/api";
import type { Match, RankingRule, Team } from "@/types/league";
import MatchMatrix from "./MatchMatrix";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/lib/api", () => ({
  listMatches: vi.fn(), createMatch: vi.fn(), updateMatch: vi.fn(),
  getTeam: vi.fn(), updateTeamRoomUrl: vi.fn(),
}));

const teams: Team[] = ["Alpha", "Beta"].map((name, index): Team => ({
  id: name, name, color: "#ffffff", sortOrder: index + 1,
  members: [{ name: "P1" }, { name: "P2" }, { name: "P3" }, { name: "P4" }],
}));
const rankingRule: RankingRule = {
  pointsWin: 3, pointsDraw: 1, pointsLoss: 0, tiebreakers: ["head_to_head"],
};
const mine: Match = {
  id: "a-b", homeTeamId: "Alpha", awayTeamId: "Beta", homeScore: 3, awayScore: 1,
};
const theirs: Match = {
  id: "b-a", homeTeamId: "Beta", awayTeamId: "Alpha", homeScore: 1, awayScore: 3,
};

function mount() {
  return render(<MatchMatrix leagueId="league-a" teams={teams} rankingRule={rankingRule} />);
}

function alphaRankingRow() {
  const ranking = screen.getAllByRole("table")[0];
  return within(ranking).getByText("Alpha").closest("tr")!;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listMatches).mockResolvedValue([mine]);
  vi.mocked(getTeam).mockImplementation(async (_leagueId, teamId) =>
    teams.find((team) => team.id === teamId)!,
  );
  vi.mocked(updateTeamRoomUrl).mockImplementation(async (_leagueId, teamId, roomUrl) => ({
    ...teams.find((team) => team.id === teamId)!,
    roomUrl,
  }));
});

describe("MatchMatrix result refresh", () => {
  it("opens the selected SELF team's Heyatate modal", async () => {
    mount();

    const buttons = screen.getAllByRole("button", { name: "ヘヤタテ" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);

    expect(await screen.findByRole("dialog", { name: "Betaのヘヤタテ" })).toBeInTheDocument();
    expect(getTeam).toHaveBeenCalledWith("league-a", "Beta", expect.any(AbortSignal));
  });

  it("updates pending, mismatch and confirmed status together with ranking", async () => {
    mount();
    await screen.findByText("⏳ 相手待ち");
    expect(within(alphaRankingRow()).getAllByRole("cell")[9]).toHaveTextContent("0");
    vi.mocked(listMatches).mockResolvedValueOnce([mine, { ...theirs, awayScore: 2 }]);
    fireEvent.click(screen.getByRole("button", { name: "結果を更新" }));
    await screen.findByText(/1件のスコア不一致/);
    expect(screen.getAllByText("⚠ 不一致")).toHaveLength(2);
    expect(within(alphaRankingRow()).getAllByRole("cell")[9]).toHaveTextContent("0");
    vi.mocked(listMatches).mockResolvedValueOnce([mine, theirs]);
    fireEvent.click(screen.getByRole("button", { name: "結果を更新" }));
    await waitFor(() => expect(screen.getAllByText("✓ 確定")).toHaveLength(2));
    expect(screen.queryByText("⏳ 相手待ち")).not.toBeInTheDocument();
    expect(screen.queryByText("⚠ 不一致")).not.toBeInTheDocument();
    expect(within(alphaRankingRow()).getAllByRole("cell")[9]).toHaveTextContent("3");
  });

  it("shows loading and keeps the previous results and timestamp on failure", async () => {
    const { container } = mount();
    await screen.findByText("⏳ 相手待ち");
    const timestamp = container.querySelector("time")?.dateTime;
    let reject!: (reason: Error) => void;
    vi.mocked(listMatches).mockReturnValueOnce(new Promise((_, rej) => { reject = rej; }));
    fireEvent.click(screen.getByRole("button", { name: "結果を更新" }));
    expect(screen.getByText("結果を更新中…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "結果を更新" })).toBeDisabled();
    reject(new Error("offline"));
    expect(await screen.findByRole("alert")).toHaveTextContent("最新ではない可能性");
    expect(screen.getByText("⏳ 相手待ち")).toBeInTheDocument();
    expect(container.querySelector("time")?.dateTime).toBe(timestamp);
    expect(screen.getByRole("button", { name: "結果を更新" })).toBeEnabled();
  });

  it("preserves draft scores and the open modal when returning to the window", async () => {
    mount();
    await screen.findByText("⏳ 相手待ち");
    fireEvent.click(screen.getByText("⏳ 相手待ち"));
    const self = screen.getByRole("spinbutton", { name: "Alphaのスコア" });
    const opponent = screen.getByRole("spinbutton", { name: "Betaのスコア" });
    fireEvent.change(self, { target: { value: "7" } });
    fireEvent.change(opponent, { target: { value: "4" } });
    vi.mocked(listMatches).mockResolvedValueOnce([mine, theirs]);
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(screen.getAllByText("✓ 確定")).toHaveLength(2));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(self).toHaveValue(7);
    expect(opponent).toHaveValue(4);
  });

  it("closes and shows the saved score without waiting for a slow refresh", async () => {
    mount();
    await screen.findByText("⏳ 相手待ち");
    fireEvent.click(screen.getByText("⏳ 相手待ち"));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Alphaのスコア" }), {
      target: { value: "5" },
    });
    const saved = { ...mine, homeScore: 5 };
    vi.mocked(updateMatch).mockResolvedValueOnce(saved);
    let resolveRefresh!: (matches: Match[]) => void;
    vi.mocked(listMatches).mockReturnValueOnce(new Promise((resolve) => {
      resolveRefresh = resolve;
    }));
    fireEvent.click(screen.getByRole("button", { name: "更新する" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("結果を更新中…")).toBeInTheDocument();
    fireEvent.click(screen.getByText("⏳ 相手待ち"));
    expect(screen.getByRole("spinbutton", { name: "Alphaのスコア" })).toHaveValue(5);
    await act(async () => { resolveRefresh([saved]); });
  });

  it("keeps the draft open and permits retry when saving fails", async () => {
    mount();
    await screen.findByText("⏳ 相手待ち");
    fireEvent.click(screen.getByText("⏳ 相手待ち"));
    vi.mocked(updateMatch).mockRejectedValueOnce(new Error("save failed"));
    fireEvent.click(screen.getByRole("button", { name: "更新する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("save failed");
    expect(screen.getByRole("spinbutton", { name: "Alphaのスコア" })).toHaveValue(3);
    expect(screen.getByRole("button", { name: "更新する" })).toBeEnabled();
    expect(listMatches).toHaveBeenCalledTimes(1);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("reports refresh failure separately after a successful score save", async () => {
    vi.mocked(listMatches).mockResolvedValueOnce([]);
    mount();
    await waitFor(() => expect(screen.getByRole("button", { name: "結果を更新" })).toBeEnabled());
    fireEvent.click(screen.getAllByText("+")[0]);
    vi.mocked(createMatch).mockResolvedValueOnce(mine);
    vi.mocked(listMatches).mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("結果を更新できませんでした");
    expect(createMatch).toHaveBeenCalledTimes(1);
    expect(refreshMock).toHaveBeenCalledOnce();
  });
});
