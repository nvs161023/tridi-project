import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Верхняя панель с правилом выбора: 20…46. */
const HEAD_TOP = 20;
const HEAD_H = 26;

/** Четыре ступени по 54 px и зазор 22 px: 24…78, 100…154, 176…230, 252…306. */
const BAR_BOTTOM = 144;
const BAR_W = 54;
const BAR_X = [24, 100, 176, 252];
const BAR_CENTER = [51, 127, 203, 279];

/** Образец линии на верхушке ступени — 36 px в ширину. */
const MARK_OFFSET = 9;
const MARK_TOP = 16;

/** Подписи под ступенями: скорость и вердикт. */
const SPEED_Y = 158;
const VERDICT_Y = 170;

type Kind = "smooth" | "wave" | "gaps" | "missing";

type Step = { speed: string; verdict: string; color: string; height: number; kind: Kind };

/**
 * Четыре ступени лестницы скорости из подписи блока 24: 60 — норма, 90 — звоны,
 * 120 — щели, 150 — пропуски. Рабочая ступень — та, что перед первой дефектной.
 */
const STEPS: Step[] = [
  { speed: "60 мм/с", verdict: "норма", color: "#10b981", height: 36, kind: "smooth" },
  { speed: "90 мм/с", verdict: "звоны", color: "#f59e0b", height: 52, kind: "wave" },
  { speed: "120 мм/с", verdict: "щели", color: "#f87171", height: 68, kind: "gaps" },
  { speed: "150 мм/с", verdict: "пропуски", color: "#dc2626", height: 84, kind: "missing" },
];

/** Образец линии на ступени: ровная, волнистая, с щелями или с пропусками. */
function Mark({ kind, x, y, color }: { kind: Kind; x: number; y: number; color: string }) {
  const start = x + MARK_OFFSET;

  if (kind === "smooth") {
    return <rect x={start} y={y - 3} width="36" height="6" rx="3" fill={color} fillOpacity="0.85" />;
  }

  if (kind === "wave") {
    return (
      <path
        d={`M${start} ${y} q4.5 -5 9 0 q4.5 5 9 0 q4.5 -5 9 0 q4.5 5 9 0`}
        fill="none"
        stroke={color}
        strokeWidth="3"
      />
    );
  }

  if (kind === "gaps") {
    return (
      <g>
        {[0, 12, 24].map((offset) => (
          <rect
            key={offset}
            x={start + offset}
            y={y - 3}
            width="9"
            height="6"
            rx="3"
            fill={color}
            fillOpacity="0.85"
          />
        ))}
      </g>
    );
  }

  return (
    <g>
      {[0, 9, 18, 27].map((offset) => (
        <rect
          key={offset}
          x={start + offset}
          y={y - 3}
          width="5"
          height="6"
          rx="2.5"
          fill={color}
          fillOpacity="0.9"
        />
      ))}
    </g>
  );
}

/**
 * Кадр блока 24 урока L6 «Лестница скорости: где появляются звоны и пропуски».
 *
 * Компоновка — четыре ступени с ростом скорости: 60, 90, 120 и 150 мм/с. На
 * верхушке каждой ступени образец линии: ровная, волнистая (звоны после углов),
 * с щелями (недодача) и с пропусками подачи. Сверху правило: рабочая ступень —
 * до первой дефектной.
 *
 * Числа — из блоков 23 и 24: ступени по 10 мм, шаг 60/90/120/150, поток для
 * 150 мм/с равен 13,5 мм³/с, внешняя стенка потом идёт на 20–30 % ниже.
 */
export function Basic6Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Лестница скорости из четырёх ступеней: 60 мм в секунду — норма, линия ровная; 90 — звоны, линия идёт волной после углов; 120 — щели между линиями, недодача; 150 — пропуски подачи. Рабочая ступень — ступень до первой дефектной, её и ставят для заполнения и внутренних стенок"
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
          Лестница скорости: 60 / 90 / 120 / 150
        </text>

        {/* Верхняя панель: правило выбора рабочей ступени */}
        <rect
          x="12"
          y={HEAD_TOP}
          width="296"
          height={HEAD_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="33" fontSize="10" fill="#e2e8f0">
          рабочая ступень — до первой дефектной
        </text>
        <text x="22" y="43" fontSize="10" fill="#94a3b8">
          шаг скоростей 60, 90, 120, 150 мм/с
        </text>

        {/* Четыре ступени с образцом линии на верхушке */}
        {STEPS.map((step, index) => {
          const x = BAR_X[index];
          const top = BAR_BOTTOM - step.height;

          return (
            <g key={step.speed}>
              <rect
                x={x}
                y={top}
                width={BAR_W}
                height={step.height}
                rx="4"
                fill={step.color}
                fillOpacity="0.25"
                stroke={step.color}
              />
              <Mark kind={step.kind} x={x} y={top + MARK_TOP} color={step.color} />
              <text
                x={BAR_CENTER[index]}
                y={SPEED_Y}
                fontSize="11"
                fontWeight="700"
                fill="#e2e8f0"
                textAnchor="middle"
              >
                {step.speed}
              </text>
              <text
                x={BAR_CENTER[index]}
                y={VERDICT_Y}
                fontSize="10"
                fontWeight="700"
                fill={step.color}
                textAnchor="middle"
              >
                {step.verdict}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
