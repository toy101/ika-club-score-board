"use client";

type Props = {
  name: string;
  onNameChange: (value: string) => void;
  nameError: string | null;
};

export function LeagueBasicInfoSection({
  name,
  onNameChange,
  nameError,
}: Props) {
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-ink-2 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-fg">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400" />
        基本情報
      </h2>

      <div className="space-y-1.5">
        <label
          htmlFor="league-name"
          className="block text-xs font-medium text-fg-2"
        >
          リーグ名 <span className="text-rose-400">*</span>
        </label>
        <input
          id="league-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={50}
          placeholder="例：2026春季オフライン交流会 ヤコリーグ"
          className={`w-full rounded-lg border bg-ink-1 px-3 py-2 text-sm text-fg outline-none transition placeholder:text-fg-3 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/60 focus:shadow-[0_0_22px_rgba(34,211,238,0.55),0_0_8px_rgba(34,211,238,0.4)] ${
            nameError ? "border-rose-500" : "border-line-2"
          }`}
        />
        {nameError && <p className="text-xs text-rose-400">{nameError}</p>}
        <p className="text-right font-mono text-xs text-fg-3">{name.length}/50</p>
      </div>
    </section>
  );
}
