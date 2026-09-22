import { useState } from "react";
import type { CharacterAppearance } from "@pixel-estates/shared";
import { CharacterSprite } from "./CharacterSprite";

const SKIN_TONES = ["#ffe0bd", "#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5a3825"];
const HAIR_COLORS = ["#0f172a", "#3b2519", "#7c4a1e", "#d4a017", "#e11d48", "#a78bfa", "#e5e7eb"];
const OUTFIT_COLORS = ["#4f7cff", "#e0559b", "#22c55e", "#f59e0b", "#a855f7", "#0ea5e9", "#1f2937"];
const ACCENT_COLORS = ["#ffd166", "#38bdf8", "#f97316", "#a3e635", "#f43f5e", "#94a3b8"];

const HAIR_STYLES: CharacterAppearance["hairStyle"][] = ["bald", "short", "long", "mohawk", "curly"];
const OUTFIT_STYLES: CharacterAppearance["outfitStyle"][] = ["casual", "formal", "explorer", "royal"];
const ACCESSORIES: CharacterAppearance["accessory"][] = ["none", "glasses", "hat", "cape", "backpack"];

function SwatchRow({
  colors,
  value,
  onChange,
}: {
  colors: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-7 h-7 rounded-full border-2 transition-transform ${
            value === c ? "border-brand-500 scale-110" : "border-white/50 dark:border-black/30"
          }`}
          style={{ backgroundColor: c }}
          aria-label={c}
        />
      ))}
    </div>
  );
}

function OptionRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`btn !px-3 !py-1.5 !text-xs capitalize ${
            value === opt ? "bg-brand-500 text-white" : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-200"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function CharacterCreator({
  initial,
  onSave,
  saving,
}: {
  initial: CharacterAppearance;
  onSave: (appearance: CharacterAppearance) => void;
  saving?: boolean;
}) {
  const [appearance, setAppearance] = useState<CharacterAppearance>(initial);

  function set<K extends keyof CharacterAppearance>(key: K, value: CharacterAppearance[K]) {
    setAppearance((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <div className="flex flex-col items-center justify-center panel !shadow-none bg-gradient-to-b from-brand-50 to-white dark:from-brand-900/20 dark:to-transparent p-6">
        <CharacterSprite appearance={appearance} size={140} animated />
        <p className="mt-3 text-xs text-slate-400 font-bold uppercase tracking-wide">Preview</p>
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <label className="label">Skin tone</label>
          <SwatchRow colors={SKIN_TONES} value={appearance.skinColor} onChange={(c) => set("skinColor", c)} />
        </div>
        <div>
          <label className="label">Hair style</label>
          <OptionRow options={HAIR_STYLES} value={appearance.hairStyle} onChange={(v) => set("hairStyle", v)} />
        </div>
        <div>
          <label className="label">Hair color</label>
          <SwatchRow colors={HAIR_COLORS} value={appearance.hairColor} onChange={(c) => set("hairColor", c)} />
        </div>
        <div>
          <label className="label">Outfit style</label>
          <OptionRow options={OUTFIT_STYLES} value={appearance.outfitStyle} onChange={(v) => set("outfitStyle", v)} />
        </div>
        <div>
          <label className="label">Outfit color</label>
          <SwatchRow colors={OUTFIT_COLORS} value={appearance.outfitColor} onChange={(c) => set("outfitColor", c)} />
        </div>
        <div>
          <label className="label">Accessory</label>
          <OptionRow options={ACCESSORIES} value={appearance.accessory} onChange={(v) => set("accessory", v)} />
        </div>
        <div>
          <label className="label">Accent color</label>
          <SwatchRow colors={ACCENT_COLORS} value={appearance.accentColor} onChange={(c) => set("accentColor", c)} />
        </div>

        <button className="btn-primary self-start mt-2" onClick={() => onSave(appearance)} disabled={saving}>
          {saving ? "Saving..." : "Save character"}
        </button>
      </div>
    </div>
  );
}
