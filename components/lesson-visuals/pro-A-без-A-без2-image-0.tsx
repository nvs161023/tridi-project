import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Верхняя дорожка из content: наружу через вытяжку, HEPA и угольный фильтр. */
const street = [
  { label: "принтер", x: 12, width: 52 },
  { label: "вытяжка", x: 74, width: 52 },
  { label: "HEPA", x: 136, width: 52 },
  { label: "угольный", x: 198, width: 52 },
  { label: "улица", x: 260, width: 52 },
];

/** Нижняя дорожка из content: закрытый бокс с фильтром и обратно в комнату. */
const room = [
  { label: "принтер", x: 12, width: 88 },
  { label: "фильтр-бокс", x: 120, width: 100 },
  { label: "комната", x: 240, width: 72 },
];

/**
 * Схема вентиляции — две дорожки из content урока: принтер → вытяжка → HEPA →
 * угольный фильтр → улица и принтер → фильтр-бокс → комната. Под фильтрами
 * подписано, что каждый ловит, а внизу — предупреждение урока: HEPA не держит
 * газы, угольный фильтр не держит частицы, поэтому нужны оба.
 *
 * От «Карты дефектов» и других сеток базового курса отличается приёмом: это блок-схема
 * из рамок и стрелок, где смысл несут порядок и подписи фильтров.
 */
export function ProABezABez2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Схема вентиляции: принтер, вытяжка, HEPA, угольный фильтр, улица — HEPA держит частицы, угольный держит газы; второй вариант: принтер, фильтр-бокс, комната"
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

        {/* Верхняя дорожка: на улицу */}
        {street.map((box) => (
          <g key={box.label}>
            <rect
              x={box.x}
              y="30"
              width={box.width}
              height="36"
              rx="5"
              fill="#0f172a"
              stroke="#38bdf8"
            />
            <text
              x={box.x + box.width / 2}
              y="52"
              fontSize="10"
              fill="#e2e8f0"
              textAnchor="middle"
            >
              {box.label}
            </text>
          </g>
        ))}
        {[64, 126, 188, 250].map((x) => (
          <g key={`arrow-${x}`}>
            <line x1={x} y1="48" x2={x + 6} y2="48" stroke="#38bdf8" strokeWidth="1.4" />
            <polygon points={`${x + 6},45 ${x + 12},48 ${x + 6},51`} fill="#38bdf8" />
          </g>
        ))}
        <text x="162" y="78" fontSize="10" fill="#6ee7b7" textAnchor="middle">
          частицы
        </text>
        <text x="224" y="78" fontSize="10" fill="#6ee7b7" textAnchor="middle">
          газы, запахи
        </text>

        {/* Нижняя дорожка: через бокс и обратно в комнату */}
        {room.map((box) => (
          <g key={`room-${box.label}`}>
            <rect
              x={box.x}
              y="100"
              width={box.width}
              height="36"
              rx="5"
              fill="#0f172a"
              stroke="#34d399"
              strokeDasharray={box.label === "комната" ? "5 4" : undefined}
            />
            <text
              x={box.x + box.width / 2}
              y="121"
              fontSize="10"
              fill="#e2e8f0"
              textAnchor="middle"
            >
              {box.label}
            </text>
          </g>
        ))}
        {[100, 220].map((x) => (
          <g key={`room-arrow-${x}`}>
            <line x1={x} y1="118" x2={x + 8} y2="118" stroke="#34d399" strokeWidth="1.4" />
            <polygon points={`${x + 8},115 ${x + 16},118 ${x + 8},121`} fill="#34d399" />
          </g>
        ))}

        {/* Предупреждение урока: одного фильтра мало */}
        <rect x="12" y="152" width="220" height="24" rx="6" fill="#1e293b" />
        <rect x="14" y="158" width="3" height="12" fill="#f59e0b" />
        <text x="24" y="168" fontSize="10" fill="#fcd34d">
          HEPA не держит газы, уголь — не частицы
        </text>
      </svg>
    </VisualWrapper>
  );
}
