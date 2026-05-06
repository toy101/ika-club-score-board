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
    <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      <h2 className="text-base font-semibold text-gray-700">基本情報</h2>

      <div className="space-y-1">
        <label
          htmlFor="league-name"
          className="block text-sm font-medium text-gray-600"
        >
          リーグ名 <span className="text-red-500">*</span>
        </label>
        <input
          id="league-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={30}
          placeholder="例：2026春季オフライン交流会 ヤコリーグ"
          className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 bg-white outline-none transition focus:ring-2 focus:ring-indigo-400 ${
            nameError ? "border-red-400" : "border-gray-300"
          }`}
        />
        {nameError && <p className="text-xs text-red-500">{nameError}</p>}
        <p className="text-xs text-gray-400 text-right">{name.length}/50</p>
      </div>
    </section>
  );
}
