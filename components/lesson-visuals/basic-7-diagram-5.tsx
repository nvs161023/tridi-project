import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Панели: стенка 12…150, ручки 154…308, 20…102. */
const PANEL_TOP = 20;
const PANEL_H = 82;
const WALL = { x: 26, y: 44, w: 100, h: 44 };
const LAYER_Y = [52, 60, 68, 76, 84];
const SEAM_X = 120;
const BLOBS: [number, number][] = [
  [34, 58],
  [50, 68],
  [66, 80],
  [86, 52],
  [104, 72],
  [118, 62],
];

const LEAD = "точки и наплывы — это давление в сопле";
const LEAD_NOTE = "шов: выровненный в угол, «ближайший» за ребро";
const NOTES = [
  "тест: линия с изгибом — бугор мало, разрыв много",
  "куб с четырьмя стенками · плоский торец сопла меняют",
];

type Fix = { name: string; color: string };

/** Порядок из проблемы 6: сначала давление, шов — последним. */
const FIXES: Fix[] = [
  { name: "1. компенсация давления", color: "#10b981" },
  { name: "2. скорости внешней стенки", color: "#38bdf8" },
  { name: "3. ретракт и сушка", color: "#f59e0b" },
  { name: "4. поток −1–2 %", color: "#94a3b8" },
];

/**
 * Кадр блока 15 урока L7 «Наплывы и точки на стенке».
 *
 * Слева стенка с бугорками, тёмными точками и шишкой на шве. Справа ручки по
 * порядку: компенсация давления (pressure advance или linear advance), ровные
 * скорости внешней стенки, ретракт и сушка, поток вниз на 1–2 %.
 *
 * Числа — из проблемы 6: pressure advance в Klipper и linear advance в Marlin,
 * поток минус 1–2 % по тесту № 2 из урока 6, шов в трёх режимах (выровненный,
 * «ближайший», случайный), тест линией с изгибом и куб с четырьмя стенками.
 */
export function Basic7Diagram5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Наплывы и точки на стенке: бугорки blobs и тёмные точки zits на углах, у отверстий и там, где слайсер меняет скорость, плюс шишка на вертикальном шве. Причина — скачок давления в сопле. Ручки по порядку: компенсация давления (pressure advance в Klipper, linear advance в Marlin), ровные скорости внешней стенки, ретракт и сушка, поток вниз на 1–2 процента. Работа со швом — последней. Тесты: линия с изгибом и куб с четырьмя стенками; изношенное сопло с плоским торцом меняют"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
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

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          Наплывы и точки на стенке
        </text>

        {/* Стенка с бугорками, точками и шишкой на шве */}
        <rect
          x="12"
          y={PANEL_TOP}
          width="138"
          height={PANEL_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="34" fontSize="10" fill="#94a3b8">
          стенка: бугорки и точки
        </text>
        <rect
          x={WALL.x}
          y={WALL.y}
          width={WALL.w}
          height={WALL.h}
          fill="#3b82f6"
          fillOpacity="0.18"
          stroke="#3b82f6"
        />
        {LAYER_Y.map((y) => (
          <line
            key={y}
            x1={WALL.x}
            y1={y}
            x2={WALL.x + WALL.w}
            y2={y}
            stroke="#3b82f6"
            strokeOpacity="0.5"
          />
        ))}
        {BLOBS.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.5" fill="#f87171" />
        ))}
        <line
          x1={SEAM_X}
          y1={WALL.y}
          x2={SEAM_X}
          y2={WALL.y + WALL.h}
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray="3 2"
        />
        <text x="26" y="94" fontSize="10" fill="#f87171">
          бугорки, точки
        </text>
        <text x="104" y="94" fontSize="10" fill="#f59e0b">
          шов-шишка
        </text>

        {/* Ручки по порядку */}
        <rect
          x="154"
          y={PANEL_TOP}
          width="154"
          height={PANEL_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="164" y="34" fontSize="10" fill="#94a3b8">
          ручки по порядку
        </text>
        {FIXES.map((fix, index) => (
          <text
            key={fix.name}
            x="164"
            y={50 + index * 14}
            fontSize="10"
            fontWeight={index === 0 ? "700" : "400"}
            fill={fix.color}
          >
            {fix.name}
          </text>
        ))}

        {/* Сноски: правило, шов и тесты */}
        <rect
          x="12"
          y="106"
          width="296"
          height="24"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="118" fontSize="10" fontWeight="700" fill="#e2e8f0">
          {LEAD}
        </text>
        <text x="22" y="128" fontSize="10" fill="#94a3b8">
          {LEAD_NOTE}
        </text>
        {NOTES.map((note, index) => (
          <g key={note}>
            <rect
              x="12"
              y={134 + index * 24}
              width="296"
              height={index === 1 ? 18 : 20}
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text x="22" y={147 + index * 24} fontSize="10" fill="#94a3b8">
              {note}
            </text>
          </g>
        ))}

      </svg>
    </VisualWrapper>
  );
}
