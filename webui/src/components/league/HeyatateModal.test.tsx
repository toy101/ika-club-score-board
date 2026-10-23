import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTeam, updateTeamRoomUrl } from "@/lib/api";
import type { Team } from "@/types/league";
import HeyatateModal from "./HeyatateModal";

vi.mock("@/lib/api", () => ({
  getTeam: vi.fn(),
  updateTeamRoomUrl: vi.fn(),
}));

const team: Team = {
  id: "alpha",
  name: "Alpha",
  color: "#ffffff",
  sortOrder: 1,
  members: [{ name: "P1" }, { name: "P2" }, { name: "P3" }, { name: "P4" }],
};

function renderModal(onClose = vi.fn()) {
  return {
    onClose,
    ...render(<HeyatateModal leagueId="league-a" team={team} onClose={onClose} />),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("HeyatateModal", () => {
  it("loads the latest team and registers a trimmed Nintendo room URL", async () => {
    const user = userEvent.setup();
    vi.mocked(getTeam).mockResolvedValue(team);
    vi.mocked(updateTeamRoomUrl).mockResolvedValue({
      ...team,
      roomUrl: "https://s.nintendo.com/room-123",
    });
    renderModal();

    const input = await screen.findByPlaceholderText("https://s.nintendo.com/...");
    await user.type(input, "  https://s.nintendo.com/room-123  ");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(updateTeamRoomUrl).toHaveBeenCalledWith(
      "league-a",
      "alpha",
      "https://s.nintendo.com/room-123",
    );
    const link = await screen.findByRole("link", { name: "ヘアタテリンクを使う" });
    expect(link).toHaveAttribute("href", "https://s.nintendo.com/room-123");
    expect(link).not.toHaveAttribute("target");
  });

  it.each([
    "http://s.nintendo.com/room",
    "https://s.nintendo.com.evil.example/room",
    "https://user@s.nintendo.com/room",
    "https://s.nintendo.com:444/room",
    "https://s.nintendo.com/",
    "https://s.nintendo.com\\evil.example/room",
  ])("rejects an unsafe URL without calling the update API: %s", async (roomUrl) => {
    const user = userEvent.setup();
    vi.mocked(getTeam).mockResolvedValue(team);
    renderModal();

    const input = await screen.findByPlaceholderText("https://s.nintendo.com/...");
    await user.type(input, roomUrl);
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(screen.getByRole("alert")).toHaveTextContent("s.nintendo.com");
    expect(updateTeamRoomUrl).not.toHaveBeenCalled();
  });

  it("keeps the registered link visible when deletion fails", async () => {
    const user = userEvent.setup();
    vi.mocked(getTeam).mockResolvedValue({
      ...team,
      roomUrl: "https://s.nintendo.com/current",
    });
    vi.mocked(updateTeamRoomUrl).mockRejectedValue(new Error("delete failed"));
    renderModal();

    const link = await screen.findByRole("link", { name: "ヘアタテリンクを使う" });
    await user.click(screen.getByRole("button", { name: "登録URLを削除する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("delete failed");
    expect(link).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登録URLを削除する" })).toBeEnabled();
  });

  it("deletes the registered URL and returns to the input form", async () => {
    const user = userEvent.setup();
    vi.mocked(getTeam).mockResolvedValue({
      ...team,
      roomUrl: "https://s.nintendo.com/current",
    });
    vi.mocked(updateTeamRoomUrl).mockResolvedValue({ ...team, roomUrl: "" });
    renderModal();

    await screen.findByRole("link", { name: "ヘアタテリンクを使う" });
    await user.click(screen.getByRole("button", { name: "登録URLを削除する" }));

    expect(updateTeamRoomUrl).toHaveBeenCalledWith("league-a", "alpha", "");
    expect(await screen.findByPlaceholderText("https://s.nintendo.com/...")).toHaveValue("");
    expect(screen.queryByRole("link", { name: "ヘアタテリンクを使う" })).not.toBeInTheDocument();
  });

  it("keeps the entered URL when registration fails", async () => {
    const user = userEvent.setup();
    vi.mocked(getTeam).mockResolvedValue(team);
    vi.mocked(updateTeamRoomUrl).mockRejectedValue(new Error("save failed"));
    renderModal();

    const input = await screen.findByPlaceholderText("https://s.nintendo.com/...");
    await user.type(input, "https://s.nintendo.com/retry-me");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("save failed");
    expect(input).toHaveValue("https://s.nintendo.com/retry-me");
    expect(screen.getByRole("button", { name: "登録する" })).toBeEnabled();
  });

  it.each([
    ["missing", team],
    ["mismatched", { ...team, roomUrl: "https://s.nintendo.com/different" }],
  ])("does not report registration success when roomUrl is %s in the response", async (_case, response) => {
    const user = userEvent.setup();
    vi.mocked(getTeam).mockResolvedValue(team);
    vi.mocked(updateTeamRoomUrl).mockResolvedValue(response);
    renderModal();

    const input = await screen.findByPlaceholderText("https://s.nintendo.com/...");
    await user.type(input, "https://s.nintendo.com/requested");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("更新結果を確認できませんでした");
    expect(input).toHaveValue("https://s.nintendo.com/requested");
    expect(screen.queryByRole("link", { name: "ヘアタテリンクを使う" })).not.toBeInTheDocument();
  });

  it.each([
    ["missing", team],
    ["not empty", { ...team, roomUrl: "https://s.nintendo.com/still-there" }],
  ])("keeps the link when roomUrl is %s after deletion", async (_case, response) => {
    const user = userEvent.setup();
    vi.mocked(getTeam).mockResolvedValue({
      ...team,
      roomUrl: "https://s.nintendo.com/current",
    });
    vi.mocked(updateTeamRoomUrl).mockResolvedValue(response);
    renderModal();

    const link = await screen.findByRole("link", { name: "ヘアタテリンクを使う" });
    await user.click(screen.getByRole("button", { name: "登録URLを削除する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("削除結果を確認できませんでした");
    expect(link).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("https://s.nintendo.com/...")).not.toBeInTheDocument();
  });

  it("does not treat a failed fetch as unregistered and can retry", async () => {
    const user = userEvent.setup();
    vi.mocked(getTeam)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(team);
    renderModal();

    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    expect(screen.queryByPlaceholderText("https://s.nintendo.com/...")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "再試行" }));

    expect(await screen.findByPlaceholderText("https://s.nintendo.com/...")).toBeInTheDocument();
    expect(getTeam).toHaveBeenCalledTimes(2);
  });

  it("traps focus, closes with Escape, and restores focus", async () => {
    const user = userEvent.setup();
    vi.mocked(getTeam).mockResolvedValue(team);
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const { onClose, unmount } = renderModal();

    await screen.findByPlaceholderText("https://s.nintendo.com/...");
    await waitFor(() => expect(screen.getByRole("button", { name: "閉じる" })).toHaveFocus());
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "登録する" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
