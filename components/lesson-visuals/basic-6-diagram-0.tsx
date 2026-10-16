import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Шапка-сравнение: две панели по 146 px, 20…84. */
const COMPARE_TOP = 20;
const COMPARE_H = 64;
const COMPARE_PAD = 10;
const COMPARE_TITLE_Y = 12;
const COMPARE_LINE_STEP = 11;

/** Пять полос-причин по 16 px и зазор 2 px: 88…104 … 160…176. */
const ROW_TOP = 88;
const ROW_H = 16;
const ROW_GAP = 2;
const ROW_NAME_X = 28;
const ROW_DETAIL_X = 150;
const ROW_TEXT_Y = 11;

type Compare = { x: number; title: string; color: string; lines: string[] };

/**
 * Шапка кадра — числа из блоков 1 и 3. На первом слое принтер идёт 15–20 мм/с
 * с прижимом линии 0,5–0,6 мм, потоком около 2 мм³/с (пятая часть того, что
 * умеет хотэнд) и выключенным обдувом; стол на первом слое держат на 5 °C выше.
 * В объёме — 60–100 мм/с, линия 0,45 мм, запрос 5–9 мм³/с и рабочий обдув.
 */
const COMPARE: Compare[] = [
  {
    x: 12,
    title: "первый слой 0,2 мм",
    color: "#f59e0b",
    lines: ["скорость 15–20 мм/с", "линия 0,5–0,6 мм", "поток ~2 мм³/с", "обдув 0 %, стол +5 °C"],
  },
  {
    x: 162,
    title: "в объёме",
    color: "#10b981",
    lines: ["скорость 60–100 мм/с", "линия 0,45 мм", "поток 5–9 мм³/с", "обдув рабочий"],
  },
];

type Reason = { name: string; detail: string; color: string };

/**
 * Пять причин ровно по блоку 1: прилипать к столу больше не нужно (связь идёт
 * сплавлением слоёв), прижим не нужен (0,5–0,6 мм нужны были только для
 * микрорельефа покрытия), включается обдув со 2–3-го слоя, у хотэнда есть запас
 * по потоку, а медленный ход был нужен по всей площади первого слоя.
 */
const REASONS: Reason[] = [
  { name: "Прилипать не нужно", detail: "связь идёт сплавлением слоёв", color: "#3b82f6" },
  { name: "Прижим не нужен", detail: "0,5–0,6 → 0,45 мм ширины", color: "#38bdf8" },
  { name: "Включается обдув", detail: "со 2–3-го слоя, охлаждение", color: "#10b981" },
  { name: "Запас по потоку", detail: "2 → 5–9 мм³/с запроса", color: "#f59e0b" },
  { name: "Ход по всей площади", detail: "участков опоры больше нет", color: "#f87171" },
];

/**
 * Кадр блока 2 урока L6 «Пять причин ускорения после первых 0,2 мм».
 *
 * Компоновка — шапка-сравнение из двух панелей (первый слой против объёма) и
 * пять полос-причин под ней. Полоса — замок, который снимается после первого
 * слоя: прилипание, прижим, обдув, запас потока и площадь хода.
 *
 * Числа — из блоков 1 и 3: 15–20 мм/с против 60–100, линия 0,5–0,6 мм против
 * 0,45 мм, поток около 2 против 5–9 мм³/с, стол на первом слое на 5 °C выше.
 */
export function Basic6Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пять причин ускорения после первого слоя: прилипать к столу больше не нужно, и связь идёт сплавлением слоёв; прижим не нужен, ширина линии падает с 0,5–0,6 до 0,45 мм; со второго-третьего слоя включается обдув; у хотэнда есть запас по потоку с 2 до 5–9 кубических миллиметров в секунду; медленный ход был нужен по всей площади первого слоя. На первом слое скорость 15–20 мм в секунду, линия 0,5–0,6 мм, поток около 2 и обдув 0 процентов при столе на 5 градусов выше, в объёме — 60–100 мм в секунду, линия 0,45 мм и поток 5–9"
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
          Пять причин ускорения после 0,2 мм
        </text>

        {/* Шапка-сравнение: первый слой против объёма */}
        {COMPARE.map((panel) => (
          <g key={panel.title}>
            <rect
              x={panel.x}
              y={COMPARE_TOP}
              width="146"
              height={COMPARE_H}
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text
              x={panel.x + COMPARE_PAD}
              y={COMPARE_TOP + COMPARE_TITLE_Y}
              fontSize="10"
              fontWeight="700"
              fill={panel.color}
            >
              {panel.title}
            </text>
            {panel.lines.map((line, index) => (
              <text
                key={line}
                x={panel.x + COMPARE_PAD}
                y={COMPARE_TOP + COMPARE_TITLE_Y + (index + 1) * COMPARE_LINE_STEP}
                fontSize="10"
                fill="#94a3b8"
              >
                {line}
              </text>
            ))}
          </g>
        ))}

        {/* Пять полос-причин: цветная засечка, название и пояснение */}
        {REASONS.map((reason, index) => {
          const top = ROW_TOP + index * (ROW_H + ROW_GAP);

          return (
            <g key={reason.name}>
              <rect
                x="12"
                y={top}
                width="296"
                height={ROW_H}
                rx="4"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <rect x="18" y={top + 3} width="3" height="10" rx="1.5" fill={reason.color} />
              <text
                x={ROW_NAME_X}
                y={top + ROW_TEXT_Y}
                fontSize="10"
                fontWeight="700"
                fill={reason.color}
              >
                {reason.name}
              </text>
              <text x={ROW_DETAIL_X} y={top + ROW_TEXT_Y} fontSize="10" fill="#94a3b8">
                {reason.detail}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
