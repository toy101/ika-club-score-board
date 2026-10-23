import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RankingRule } from "@/types/league";
import { LeagueSettingsEditor } from "./LeagueSettingsEditor";

const { refreshMock, updateLeagueMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  updateLeagueMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/lib/api", () => ({
  updateLeague: updateLeagueMock,
}));

const gameWinsRule: RankingRule = {
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  tiebreakers: ["head_to_head"],
  scoringMode: "game_wins",
  bestOf: 3,
  pointsPerGameWin: 1,
};

describe("LeagueSettingsEditor", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    updateLeagueMock.mockReset();
    updateLeagueMock.mockResolvedValue({});
  });

  it("saves the edited rule and refreshes the server-rendered league", async () => {
    const user = userEvent.setup();
    render(
      <LeagueSettingsEditor
        leagueId="league-1"
        initialRankingRule={gameWinsRule}
        hasMatches={false}
      />,
    );

    const pointsInput = screen.getByLabelText("1本あたりの勝点");
    await user.clear(pointsInput);
    await user.type(pointsInput, "2");
    await user.click(screen.getByRole("button", { name: "BO5" }));
    await user.click(screen.getByRole("button", { name: "設定を保存" }));

    expect(updateLeagueMock).toHaveBeenCalledWith("league-1", {
      rankingRule: { ...gameWinsRule, bestOf: 5, pointsPerGameWin: 2 },
    });
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(
      await screen.findByText("ランキングルールを保存しました"),
    ).toBeInTheDocument();
  });

  it("locks scoring mode and BO format after a result exists", () => {
    render(
      <LeagueSettingsEditor
        leagueId="league-1"
        initialRankingRule={gameWinsRule}
        hasMatches
      />,
    );

    expect(screen.getByRole("button", { name: "シリーズ勝敗" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "獲得本数" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "BO3" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "BO5" })).toBeDisabled();
    expect(screen.getByLabelText("1本あたりの勝点")).toBeEnabled();
    expect(
      screen.getByText(/対戦結果が登録済みのため/),
    ).toBeInTheDocument();
  });
});
