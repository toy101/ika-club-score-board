import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RankingRule, Team } from "@/types/league";
import MatchInputModal from "./MatchInputModal";

function makeTeam(id: string, name: string): Team {
  return {
    id,
    name,
    color: "#ffffff",
    sortOrder: 1,
    members: [
      { name: "P1" },
      { name: "P2" },
      { name: "P3" },
      { name: "P4" },
    ],
  };
}

const gameWinsRule: RankingRule = {
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  tiebreakers: ["head_to_head"],
  scoringMode: "game_wins",
  bestOf: 3,
  pointsPerGameWin: 1,
};

describe("MatchInputModal", () => {
  it("rejects an unfinished BO3 score before calling the API handler", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <MatchInputModal
        homeTeam={makeTeam("a", "Alpha")}
        awayTeam={makeTeam("b", "Beta")}
        rankingRule={gameWinsRule}
        saving={false}
        error={null}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "BO3は、どちらかが2本を先取したスコア",
    );
  });

  it("accepts a completed 2-1 BO3 score", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <MatchInputModal
        homeTeam={makeTeam("a", "Alpha")}
        awayTeam={makeTeam("b", "Beta")}
        rankingRule={gameWinsRule}
        saving={false}
        error={null}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Alphaのスコアを1増やす" }));
    await user.click(screen.getByRole("button", { name: "Alphaのスコアを1増やす" }));
    await user.click(screen.getByRole("button", { name: "Betaのスコアを1増やす" }));
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(onSave).toHaveBeenCalledWith(2, 1);
  });
});
