type Size = "sm" | "md" | "lg";

type Props = {
  color: string;
  size?: Size;
  className?: string;
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-2 w-2",
  md: "h-3 w-3",
  lg: "h-4 w-4",
};

const SHADOW_FORMULA: Record<Size, (c: string) => string> = {
  sm: (c) => `0 0 14px ${c}, 0 0 4px ${c}`,
  md: (c) => `0 0 18px ${c}, 0 0 6px ${c}`,
  lg: (c) => `0 0 22px ${c}, 0 0 8px ${c}`,
};

/**
 * Reusable team-color glow dot.
 * Rendered as an inline-block span — safe in both server and client components.
 *
 * Size mapping:
 *   sm → h-2 w-2 (8px)  glow: 0 0 14px / 0 0 4px   — used in RankingTable
 *   md → h-3 w-3 (12px) glow: 0 0 18px / 0 0 6px   — used in MatchInputModal, TeamItem
 *   lg → h-4 w-4 (16px) glow: 0 0 22px / 0 0 8px   — used in leagues/[leagueId]/page
 */
export function TeamColorDot({ color, size = "md", className = "" }: Props) {
  return (
    <span
      className={`inline-block flex-shrink-0 rounded-full ${SIZE_CLASSES[size]}${className ? ` ${className}` : ""}`}
      style={{
        backgroundColor: color,
        boxShadow: SHADOW_FORMULA[size](color),
      }}
    />
  );
}
