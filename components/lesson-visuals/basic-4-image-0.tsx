import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три волны тепла под соплом — декоративные дуги, не текст. */
const heatWaves = [
  { d: "M60 78 q6 -7 12 0", key: "heat-1" },
  { d: "M63 85 q5 -6 10 0", key: "heat-2" },
  { d: "M66 91 q4 -5 8 0", key: "heat-3" },
];

/**
 * Температурные настройки: сопло и стол как две независимые настройки.
 *
 * Из content урока: «Сопло и стол. PLA: 210/60. PETG: 240/80», а точные диапазоны
 * берём из списка «Две температуры» того же урока: сопло PLA 200–210, PETG 230–240,
 * стол PLA 50–60, PETG 70–80. Внизу — поправка на первый слой (+5 °C), тоже из списка.
 *
 * От изометрической схемы принтера (урок 1) отличается тем, что это не устройство
 * целиком, а два отдельных «градусника»: горячий узел слева (оранжевый) и стол
 * справа (синий) — ровно та мысль урока, что горячий стол не спасёт, если сопло
 * слишком холодное.
 */
export function Basic4Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Температурные настройки: сопло PLA 200–210, PETG 230–240 °C и стол PLA 50–60, PETG 70–80 °C — две независимые настройки, первый слой на 5 °C горячее"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <rect
          x="0.5"
          y="0.5"
          width="319"
          height="179"
          rx="12"
          fill="#1e293b"
          fillOpacity="0.5"
          stroke="#475569"
        />

        {/* Разделитель: две настройки греются отдельно */}
        <line x1="160" y1="20" x2="160" y2="136" stroke="#334155" />

        {/* Сопло: горячий узел */}
        <text x="24" y="34" fontSize="11" fontWeight="bold" fill="#e2e8f0">
          Сопло
        </text>
        <rect x="52" y="46" width="36" height="16" rx="3" fill="#334155" stroke="#475569" />
        <polygon points="64,62 76,62 70,74" fill="#94a3b8" />
        <rect x="64" y="80" width="16" height="5" rx="2" fill="#f59e0b" />
        {heatWaves.map((wave) => (
          <path
            key={wave.key}
            d={wave.d}
            fill="none"
            stroke="#fb923c"
            strokeOpacity="0.75"
            strokeWidth="1.5"
          />
        ))}
        <text x="24" y="108" fontSize="10" fill="#fbbf24">
          PLA 200–210 °C
        </text>
        <text x="24" y="124" fontSize="10" fill="#f59e0b">
          PETG 230–240 °C
        </text>

        {/* Стол: подложка и первый слой */}
        <text x="178" y="34" fontSize="11" fontWeight="bold" fill="#e2e8f0">
          Стол
        </text>
        <rect x="200" y="58" width="88" height="8" rx="3" fill="#60a5fa" fillOpacity="0.85" />
        <rect x="196" y="66" width="96" height="8" rx="2" fill="#1e3a5f" stroke="#3b82f6" />
        <rect x="200" y="76" width="88" height="8" rx="3" fill="#f59e0b" fillOpacity="0.18" />
        <text x="178" y="108" fontSize="10" fill="#93c5fd">
          PLA 50–60 °C
        </text>
        <text x="178" y="124" fontSize="10" fill="#60a5fa">
          PETG 70–80 °C
        </text>

        {/* Поправки: первый слой и быстрая печать */}
        <text x="24" y="156" fontSize="10" fill="#94a3b8">
          Первый слой +5 °C
        </text>
        <text x="24" y="172" fontSize="10" fill="#94a3b8">
          Быстрая печать +5–10 °C
        </text>
      </svg>
    </VisualWrapper>
  );
}
