import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Панели: рябь 12…150, ручки 154…308, 20…102. */
const PANEL_TOP = 20;
const PANEL_H = 82;
const WALL = { x: 26, y: 44, w: 100, h: 44 };
const CORNER_X = 30;

/** Волны с постоянным шагом и затухающей амплитудой. */
const RIPPLES = [
  { x: 44, opacity: 0.95 },
  { x: 52, opacity: 0.7 },
  { x: 60, opacity: 0.45 },
  { x: 68, opacity: 0.25 },
];

const LEAD = "звон — это импульс от углов в раму и ремни";
const LEAD_NOTE = "шаг ряби: 100 мм/с ÷ 40 Гц = 2,5 мм";
const NOTES = [
  "60 мм/с и 3000 мм/с² — почти чисто; 150 и 6000 — рябь",
  "тест: башня резонанса · скорость ÷ шаг = частота",
];

type Fix = { name: string; color: string };

/** Порядок из проблемы 7: сначала гасим импульс, скорость — в самом конце. */
const FIXES: Fix[] = [
  { name: "1. input shaper (ADXL345)", color: "#10b981" },
  { name: "2. ремни, эксцентрики, рама", color: "#38bdf8" },
  { name: "3. ускорения −20–30 %", color: "#f59e0b" },
  { name: "4. скорость — последней", color: "#94a3b8" },
];

/**
 * Кадр блока 17 урока L7 «Звон: рябь уходит от углов».
 *
 * Слева стенка, от угла по ней расходится рябь с одинаковым шагом и затухающей
 * амплитудой. Справа ручки по порядку: input shaper по акселерометру или по
 * башне, механизм — ремни, эксцентрики, рама, затем ускорения и только потом
 * скорость.
 *
 * Числа — из проблемы 7: шаг вибрации равен скорости, делённой на частоту, при
 * 100 мм/с и резонансе 40 Гц это 2,5 мм; ускорения снижают на 20–30 %; на
 * 60 мм/с и 3000 мм/с² стенка почти чистая, на 150 мм/с и 6000 мм/с² рябь
 * видна всегда.
 */
export function Basic7Diagram6({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Звон и рябь после углов: от углов, отверстий и мест смены направления расходится рябь с одинаковым шагом и затухающей амплитудой. Причина — механические колебания: каретка разгоняется и тормозит на углу, импульс уходит в раму, ремни и ролики. Ручки: input shaper по акселерометру ADXL345 или по тесту с башней, затем ремни, эксцентрики и рама, затем ускорения минус 20–30 процентов, и только потом скорость. Шаг ряби равен скорости, делённой на частоту: 100 миллиметров в секунду и резонанс 40 герц дают 2,5 мм"
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
          Звон: рябь уходит от углов
        </text>

        {/* Рябь от угла: шаг постоянный, амплитуда падает */}
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
          рябь от угла
        </text>
        <rect
          x={WALL.x}
          y={WALL.y}
          width={WALL.w}
          height={WALL.h}
          fill="#3b82f6"
          fillOpacity="0.15"
          stroke="#3b82f6"
        />
        <line
          x1={CORNER_X}
          y1={WALL.y}
          x2={CORNER_X}
          y2={WALL.y + WALL.h}
          stroke="#64748b"
          strokeWidth="2"
        />
        <polygon points={`${CORNER_X},52 ${CORNER_X + 7},48.5 ${CORNER_X + 7},55.5`} fill="#64748b" />
        {RIPPLES.map((ripple) => (
          <line
            key={ripple.x}
            x1={ripple.x}
            y1={WALL.y + 2}
            x2={ripple.x}
            y2={WALL.y + WALL.h - 2}
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeOpacity={ripple.opacity}
          />
        ))}
        <text x="22" y="100" fontSize="10" fill="#f59e0b">
          шаг = скорость ÷ частота
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

        {/* Сноски: правило, шаг ряби и тест */}
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
