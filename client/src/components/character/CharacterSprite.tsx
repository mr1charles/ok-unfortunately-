import type { CharacterAppearance } from "@pixel-estates/shared";

const ACCESSORY_EMOJI: Record<CharacterAppearance["accessory"], string> = {
  none: "",
  glasses: "🕶️",
  hat: "🎩",
  cape: "🧣",
  backpack: "🎒",
};

const HAIR_SHAPE: Record<CharacterAppearance["hairStyle"], string> = {
  bald: "",
  short: "rounded-t-full h-[38%] top-0",
  long: "rounded-t-full h-[55%] top-0",
  mohawk: "rounded-full w-[18%] h-[45%] top-0 left-1/2 -translate-x-1/2",
  curly: "rounded-full h-[42%] top-0",
};

export function CharacterSprite({
  appearance,
  size = 56,
  animated = false,
  label,
}: {
  appearance: CharacterAppearance;
  size?: number;
  animated?: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: size }}>
      <div
        className={`relative select-none ${animated ? "animate-[bob_1.6s_ease-in-out_infinite]" : ""}`}
        style={{ width: size, height: size }}
      >
        <style>{`@keyframes bob { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-6%);} }`}</style>
        {/* outfit / body */}
        <div
          className="absolute bottom-0 left-1/2 w-[70%] h-[55%] -translate-x-1/2 rounded-2xl shadow-inner"
          style={{ backgroundColor: appearance.outfitColor }}
        />
        {/* head */}
        <div
          className="absolute left-1/2 top-[8%] w-[62%] h-[52%] -translate-x-1/2 rounded-full border-2 border-black/10"
          style={{ backgroundColor: appearance.skinColor }}
        />
        {/* hair */}
        {appearance.hairStyle !== "bald" && (
          <div
            className={`absolute w-[62%] left-1/2 -translate-x-1/2 ${HAIR_SHAPE[appearance.hairStyle]}`}
            style={{ backgroundColor: appearance.hairColor }}
          />
        )}
        {/* accent (belt/shoes) */}
        <div
          className="absolute bottom-0 left-1/2 w-[70%] h-[10%] -translate-x-1/2 rounded-b-xl"
          style={{ backgroundColor: appearance.accentColor }}
        />
        {/* accessory */}
        {appearance.accessory !== "none" && (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[1.1em] leading-none" style={{ fontSize: size * 0.32 }}>
            {ACCESSORY_EMOJI[appearance.accessory]}
          </div>
        )}
      </div>
      {label && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 text-white truncate max-w-full">
          {label}
        </span>
      )}
    </div>
  );
}
