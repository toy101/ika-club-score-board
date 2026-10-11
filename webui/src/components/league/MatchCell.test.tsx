import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CellStatus } from "@/lib/matches";
import type { Match } from "@/types/league";
import MatchCell from "@/components/league/MatchCell";

function makeMatch(
  homeScore: number,
  awayScore: number,
  id = "match-1",
): Match {
  return {
    id,
    homeTeamId: "team-a",
    awayTeamId: "team-b",
    homeScore,
    awayScore,
  };
}

describe("MatchCell — empty", () => {
  it("renders + and matches snapshot", () => {
    const status: CellStatus = { kind: "empty" };
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <MatchCell status={status} onClick={() => {}} />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText("+")).toBeInTheDocument();
    expect(container.querySelector("td")).toMatchSnapshot();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const status: CellStatus = { kind: "empty" };
    render(
      <table>
        <tbody>
          <tr>
            <MatchCell status={status} onClick={onClick} />
          </tr>
        </tbody>
      </table>,
    );
    await userEvent.click(screen.getByText("+"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("MatchCell — other_only", () => {
  it("renders 要申告 and matches snapshot", () => {
    const status: CellStatus = {
      kind: "other_only",
      otherMatch: makeMatch(1, 2),
    };
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <MatchCell status={status} onClick={() => {}} />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText("要申告")).toBeInTheDocument();
    expect(container.querySelector("td")).toMatchSnapshot();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const status: CellStatus = {
      kind: "other_only",
      otherMatch: makeMatch(1, 2),
    };
    render(
      <table>
        <tbody>
          <tr>
            <MatchCell status={status} onClick={onClick} />
          </tr>
        </tbody>
      </table>,
    );
    await userEvent.click(screen.getByText("要申告"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("MatchCell — reported", () => {
  it("renders score and 相手待ち and matches snapshot", () => {
    const status: CellStatus = { kind: "reported", match: makeMatch(3, 1) };
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <MatchCell status={status} onClick={() => {}} />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(container.querySelector("td")).toMatchSnapshot();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const status: CellStatus = { kind: "reported", match: makeMatch(3, 1) };
    render(
      <table>
        <tbody>
          <tr>
            <MatchCell status={status} onClick={onClick} />
          </tr>
        </tbody>
      </table>,
    );
    await userEvent.click(screen.getByText("3"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("MatchCell — confirmed", () => {
  it("renders score and 確定 and matches snapshot", () => {
    const status: CellStatus = { kind: "confirmed", match: makeMatch(2, 0) };
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <MatchCell status={status} onClick={() => {}} />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(container.querySelector("td")).toMatchSnapshot();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const status: CellStatus = { kind: "confirmed", match: makeMatch(2, 0) };
    render(
      <table>
        <tbody>
          <tr>
            <MatchCell status={status} onClick={onClick} />
          </tr>
        </tbody>
      </table>,
    );
    await userEvent.click(screen.getByText("2"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("MatchCell — mismatch", () => {
  it("renders score and 不一致 and matches snapshot", () => {
    // mine: A reports 3-1 from A's perspective
    // theirs: B reports home=B(2), away=A(3) => otherMatch.homeScore=2, otherMatch.awayScore=3
    const mine = makeMatch(3, 1, "mine");
    const theirs = makeMatch(2, 3, "theirs"); // B's report: homeScore=2(B), awayScore=3(A)
    const status: CellStatus = {
      kind: "mismatch",
      match: mine,
      otherMatch: theirs,
    };
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <MatchCell status={status} onClick={() => {}} />
          </tr>
        </tbody>
      </table>,
    );
    // 不一致 label
    expect(screen.getByText("⚠ 不一致")).toBeInTheDocument();
    expect(container.querySelector("td")).toMatchSnapshot();
  });

  it("title attribute shows opponent's claim correctly", () => {
    // theirs: otherMatch.homeScore = B's claim of themselves, awayScore = B's claim of A
    // title = `相手の申告: ${theirClaimOfMySelf} - ${theirClaimOfOpponent}`
    // theirClaimOfMySelf = otherMatch.awayScore, theirClaimOfOpponent = otherMatch.homeScore
    const mine = makeMatch(3, 1, "mine");
    const theirs = makeMatch(2, 3, "theirs"); // awayScore=3 (their claim of me), homeScore=2 (their claim of themselves)
    const status: CellStatus = {
      kind: "mismatch",
      match: mine,
      otherMatch: theirs,
    };
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <MatchCell status={status} onClick={() => {}} />
          </tr>
        </tbody>
      </table>,
    );
    const td = container.querySelector("td")!;
    // theirClaimOfMySelf = theirs.awayScore = 3, theirClaimOfOpponent = theirs.homeScore = 2
    expect(td.getAttribute("title")).toBe("相手の申告: 3 - 2");
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const status: CellStatus = {
      kind: "mismatch",
      match: makeMatch(3, 1, "mine"),
      otherMatch: makeMatch(2, 3, "theirs"),
    };
    render(
      <table>
        <tbody>
          <tr>
            <MatchCell status={status} onClick={onClick} />
          </tr>
        </tbody>
      </table>,
    );
    await userEvent.click(screen.getByText("⚠ 不一致"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
