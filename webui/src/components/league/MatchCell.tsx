import type { CellStatus } from "@/lib/matches";

type Props = {
  status: CellStatus;
  onClick: () => void;
};

export default function MatchCell({ status, onClick }: Props) {
  switch (status.kind) {
    case "empty":
      return (
        <td
          className="cursor-pointer p-2 text-center transition-colors hover:bg-violet-500/10"
          onClick={onClick}
        >
          <span className="select-none text-xl leading-none text-fg-3/60">
            +
          </span>
        </td>
      );

    case "other_only":
      return (
        <td
          className="cursor-pointer p-2 text-center transition-colors hover:bg-amber-500/10"
          onClick={onClick}
          title="相手チームはすでに申告済み"
        >
          <span className="select-none text-xl leading-none text-amber-400">
            +
          </span>
          <div className="mt-0.5 text-xs leading-tight text-amber-400/80">
            要申告
          </div>
        </td>
      );

    case "reported":
      return (
        <td
          className="cursor-pointer p-2 text-center transition-colors hover:bg-violet-500/10"
          onClick={onClick}
        >
          <span className="font-mono text-sm font-bold text-fg">
            {status.match.homeScore}
            <span className="mx-0.5 text-fg-3">-</span>
            {status.match.awayScore}
          </span>
          <div className="mt-0.5 text-xs leading-tight text-fg-3">
            ⏳ 相手待ち
          </div>
        </td>
      );

    case "confirmed":
      return (
        <td
          className="cursor-pointer p-2 text-center transition-colors hover:bg-emerald-500/10"
          onClick={onClick}
        >
          <span className="font-mono text-sm font-bold text-fg">
            {status.match.homeScore}
            <span className="mx-0.5 text-fg-3">-</span>
            {status.match.awayScore}
          </span>
          <div className="mt-0.5 text-xs leading-tight text-emerald-400">
            ✓ 確定
          </div>
        </td>
      );

    case "mismatch": {
      const theirClaimOfMySelf = status.otherMatch.awayScore;
      const theirClaimOfOpponent = status.otherMatch.homeScore;
      return (
        <td
          className="cursor-pointer border border-amber-500/50 bg-amber-500/5 p-2 text-center transition-colors hover:bg-amber-500/15"
          onClick={onClick}
          title={`相手の申告: ${theirClaimOfMySelf} - ${theirClaimOfOpponent}`}
        >
          <span className="font-mono text-sm font-bold text-fg">
            {status.match.homeScore}
            <span className="mx-0.5 text-fg-3">-</span>
            {status.match.awayScore}
          </span>
          <div className="mt-0.5 text-xs leading-tight text-amber-400">
            ⚠ 不一致
          </div>
        </td>
      );
    }
  }
}
