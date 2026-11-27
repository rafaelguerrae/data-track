const EMOJIS = [
  "🌡️", "❄️", "🧊", "🔥", "☀️", "💧", "🌿", "🌱",
  "🍎", "🥩", "🐟", "🥛", "🍞", "🧀", "🍷", "🍺",
  "💊", "💉", "🧪", "🔬", "🏭", "📦", "🚚", "🏠",
  "🏢", "🍳", "☕", "🐄", "🌾", "⚙️", "🔋", "⚠️",
];

export function EmojiPicker({ value, onChange }: { value: string | null; onChange: (icon: string | null) => void }) {
  return (
    <div role="radiogroup" aria-label="Ícone do sensor" className="grid grid-cols-8 gap-1">
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          role="radio"
          aria-checked={e === value}
          onClick={() => onChange(e === value ? null : e)}
          className={`grid aspect-square place-items-center rounded-lg text-xl transition ${e === value ? "bg-accent-soft ring-2 ring-accent" : "hover:bg-surface-2"}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
