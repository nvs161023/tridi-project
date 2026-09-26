import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Прутья кристаллического: те же цепочки, но уложенные ровно в ряд. */
const packed = [178, 194, 210, 226, 242, 258, 274, 290];

/** Подписи под каждой структурой: примеры и что из строения следует. */
const notes = [
  { x: 14, accent: "#7dd3fc", example: "PLA, ABS, PETG", chain: "цепочки вразнобой", shrink: "усадка малая", effect: "детали держат форму" },
  { x: 178, accent: "#fcd34d", example: "PA, POM", chain: "цепочки в ряд", shrink: "усадка больше", effect: "прочность выше" },
];

/**
 * Структура полимеров — две схемы из content урока без рамок: слева аморфные
 * цепочки как спагетти, справа кристаллические как упакованные прутья. Цепочек
 * с обеих сторон одинаково — разница только в порядке, и это главная мысль урока.
 *
 * От «Структуры» в других модулях отличается предметом: разрезы узлов и схемы
 * движения показывают устройство, здесь — строение самого материала.
 */
export function ProE1E12Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Структура полимеров: слева аморфные цепочки — спутанные, как спагетти, это PLA, ABS и PETG с малой усадкой, детали держат форму; справа кристаллические — уложенные ровно в ряд прутья, это PA и POM с большей усадкой и большей прочностью"
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

        <text x="81" y="26" fontSize="10" fontWeight="bold" fill="#7dd3fc" textAnchor="middle">
          аморфный
        </text>
        <text x="234" y="26" fontSize="10" fontWeight="bold" fill="#fcd34d" textAnchor="middle">
          кристаллический
        </text>

        {/* Аморфные цепочки: спутанный клубок */}
        <path
          d="M18,52 C36,40 52,66 70,54 S104,66 124,50 S138,56 146,52"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M22,52 C40,66 60,96 96,90"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M18,84 C36,72 52,98 70,86 S104,98 124,82 S138,88 146,84"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M16,98 C34,86 50,104 68,94 S102,104 122,88"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M40,44 C58,74 74,96 116,58"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M30,102 C52,92 66,58 104,48"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M30,46 C48,60 64,38 84,48 S118,60 138,46"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Кристаллические: те же цепочки, уложенные в ряд */}
        {packed.map((x) => (
          <line
            key={x}
            x1={x}
            y1="44"
            x2={x}
            y2="106"
            stroke="#fcd34d"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ))}

        {/* Подписи: примеры, строение и что из него следует */}
        {notes.map((note) => (
          <g key={note.example}>
            <text x={note.x} y="126" fontSize="10" fontWeight="bold" fill={note.accent}>
              {note.example}
            </text>
            <text x={note.x} y="141" fontSize="10" fill="#cbd5e1">
              {note.chain}
            </text>
            <text x={note.x} y="156" fontSize="10" fill="#94a3b8">
              {note.shrink}
            </text>
            <text x={note.x} y="171" fontSize="10" fill="#94a3b8">
              {note.effect}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
