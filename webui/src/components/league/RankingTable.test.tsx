import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Team, Match, RankingRule } from "@/types/league";
import RankingTable from "@/components/league/RankingTable";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTeam(id: string, name: string, sortOrder: number): Team {
  return {
    id,
    name,
    color: "#ffffff",
    sortOrder,
    members: [{ name: "P1" }, { name: "P2" }, { name: "P3" }, { name: "P4" }],
  };
}

function confirmedPair(
  homeId: string,
  awayId: string,
  homeScore: number,
  awayScore: number,
): Match[] {
  return [
    {
      id: `${homeId}-vs-${awayId}`,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeScore,
      awayScore,
    },
    {
      id: `${awayId}-vs-${homeId}`,
      homeTeamId: awayId,
      awayTeamId: homeId,
      homeScore: awayScore,
      awayScore: homeScore,
    },
  ];
}

const defaultRule: RankingRule = {
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  tiebreakers: ["head_to_head", "goal_difference", "goals_scored"],
};

const A = "00000000-0000-4000-a000-000000000001";
const B = "00000000-0000-4000-a000-000000000002";
const C = "00000000-0000-4000-a000-000000000003";
const D = "00000000-0000-4000-a000-000000000004";

const teams: Team[] = [
  makeTeam(A, "Alpha", 1),
  makeTeam(B, "Beta", 2),
  makeTeam(C, "Gamma", 3),
  makeTeam(D, "Delta", 4),
];

const matches: Match[] = [
  ...confirmedPair(A, B, 3, 1), // A beats B
  ...confirmedPair(A, C, 2, 0), // A beats C
  ...confirmedPair(A, D, 1, 0), // A beats D
  ...confirmedPair(B, C, 1, 0), // B beats C
  ...confirmedPair(B, D, 2, 1), // B beats D
  ...confirmedPair(C, D, 1, 1), // C draws D
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RankingTable", () => {
  it("returns null when teams.length < 2", () => {
    const { container } = render(
      <RankingTable
        teams={[makeTeam(A, "Solo", 1)]}
        matches={[]}
        rankingRule={defaultRule}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when teams array is empty", () => {
    const { container } = render(
      <RankingTable teams={[]} matches={[]} rankingRule={defaultRule} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the section heading 現在のランキング", () => {
    render(
      <RankingTable teams={teams} matches={matches} rankingRule={defaultRule} />,
    );
    expect(screen.getByText("現在のランキング")).toBeInTheDocument();
  });

  it("renders all expected column headers: #, team, 試, 勝, 分, 敗, 得, 失, 差, 勝点", () => {
    render(
      <RankingTable teams={teams} matches={matches} rankingRule={defaultRule} />,
    );
    const expectedHeaders = ["#", "team", "試", "勝", "分", "敗", "得", "失", "差", "勝点"];
    for (const header of expectedHeaders) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }
  });

  it("renders ranked rows in correct order (A 1st, B 2nd, C 3rd, D 4th)", () => {
    render(
      <RankingTable teams={teams} matches={matches} rankingRule={defaultRule} />,
    );
    const rows = screen.getAllByRole("row");
    // rows[0] = thead row; rows[1..4] = tbody rows
    expect(rows[1].textContent).toContain("Alpha");
    expect(rows[2].textContent).toContain("Beta");
    expect(rows[3].textContent).toContain("Gamma");
    expect(rows[4].textContent).toContain("Delta");
  });

  it("rank numbers are correct (1, 2, 3, 4)", () => {
    render(
      <RankingTable teams={teams} matches={matches} rankingRule={defaultRule} />,
    );
    const rows = screen.getAllByRole("row");
    // First cell in each tbody row is the rank
    expect(rows[1].cells[0].textContent).toBe("1");
    expect(rows[2].cells[0].textContent).toBe("2");
    expect(rows[3].cells[0].textContent).toBe("3");
    expect(rows[4].cells[0].textContent).toBe("4");
  });

  it("stats for Alpha (3W 0D 0L, 6pts, gd+6) are correct", () => {
    render(
      <RankingTable teams={teams} matches={matches} rankingRule={defaultRule} />,
    );
    const rows = screen.getAllByRole("row");
    const alphaRow = rows[1];
    // columns: #, team, 試(played), 勝(wins), 分(draws), 敗(losses), 得(gf), 失(ga), 差(gd), 勝点(pts)
    expect(alphaRow.cells[2].textContent).toBe("3"); // played
    expect(alphaRow.cells[3].textContent).toBe("3"); // wins
    expect(alphaRow.cells[4].textContent).toBe("0"); // draws
    expect(alphaRow.cells[5].textContent).toBe("0"); // losses
    expect(alphaRow.cells[9].textContent).toBe("9"); // points
  });

  it("snapshot of the full rendered table", () => {
    const { container } = render(
      <RankingTable teams={teams} matches={matches} rankingRule={defaultRule} />,
    );
    expect(container).toMatchSnapshot();
  });
});
