import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Тип ребра: он задаёт и рисунок пластины, и строки «применение». */
type RibKind = "straight" | "triangle" | "honeycomb" | "cross";

type Rib = {
  /** Левый верхний угол панели 145×60. */
  x: number;
  y: number;
  /** Название типа — слово из content блока. */
  name: string;
  accent: string;
  kind: RibKind;
  /** Применение: деталь из примеров урока и что эти рёбра дают. */
  apply: string[];
};

/** Два столбца по два ряда: прямые и треугольные сверху, сотовые и крестовые снизу. */
const RIBS: Rib[] = [
  {
    x: 12,
    y: 28,
    name: "прямые",
    accent: "#38bdf8",
    kind: "straight",
    apply: ["кронштейн", "вдоль нагрузки"],
  },
  {
    x: 163,
    y: 28,
    name: "треугольные",
    accent: "#fbbf24",
    kind: "triangle",
    apply: ["косынка", "в углах"],
  },
  {
    x: 12,
    y: 96,
    name: "сотовые",
    accent: "#34d399",
    kind: "honeycomb",
    apply: ["корпус", "лёгкая панель"],
  },
  {
    x: 163,
    y: 96,
    name: "крестовые",
    accent: "#c4b5fd",
    kind: "cross",
    apply: ["шестерня", "под кручение"],
  },
];

const PANEL_W = 145;
const PANEL_H = 60;

/** Пластина, на которой видны рёбра: 56×28 внутри панели. */
const PLATE = { dx: 10, dy: 28, w: 56, h: 28 };

/** Прямые рёбра: четыре полосы вдоль нагрузки. */
const STRAIGHT_RIBS = [18, 28, 38, 48];

/** Треугольные рёбра: косынки разбивают пластину на треугольники. */
const TRIANGLE_RIBS: [number, number, number, number][] = [
  [12, 30, 22, 54],
  [30, 30, 22, 54],
  [30, 30, 40, 54],
  [48, 30, 40, 54],
  [48, 30, 58, 54],
];

/** Сотовые рёбра: соты в два ряда, как в лёгкой панели. */
const HONEYCOMB_CELLS: [number, number][] = [
  [20, 35],
  [31, 35],
  [42, 35],
  [25.5, 47],
  [36.5, 47],
];

/** Крестовые рёбра: две полосы крестом — на шестерне держат ступицу. */
const CROSS = {
  vertical: { dx: 35, dy: 29, w: 4, h: 26 },
  horizontal: { dx: 11, dy: 39, w: 54, h: 4 },
};

const HEX_RADIUS = 7;

/** Точки шестиугольной соты: вершины через 60°, плоская грань сверху. */
function hexPoints(cx: number, cy: number): string {
  return [0, 60, 120, 180, 240, 300]
    .map((angle) => {
      const rad = (angle * Math.PI) / 180;
      return `${Math.round(cx + HEX_RADIUS * Math.cos(rad))},${Math.round(cy + HEX_RADIUS * Math.sin(rad))}`;
    })
    .join(" ");
}

/** Рисунок рёбер на пластине: у каждого типа свой узор. */
function Pattern({ rib }: { rib: Rib }) {
  const { x, y, accent, kind } = rib;

  if (kind === "straight") {
    return (
      <g>
        {STRAIGHT_RIBS.map((offset) => (
          <rect
            key={`straight-${offset}`}
            x={x + offset}
            y={y + PLATE.dy + 3}
            width="3"
            height={PLATE.h - 6}
            fill={accent}
            fillOpacity="0.55"
          />
        ))}
      </g>
    );
  }

  if (kind === "triangle") {
    return (
      <g>
        {TRIANGLE_RIBS.map(([dx1, dy1, dx2, dy2]) => (
          <line
            key={`triangle-${dx1}-${dy1}-${dx2}`}
            x1={x + dx1}
            y1={y + dy1}
            x2={x + dx2}
            y2={y + dy2}
            stroke={accent}
            strokeOpacity="0.7"
            strokeWidth="1.4"
          />
        ))}
      </g>
    );
  }

  if (kind === "honeycomb") {
    return (
      <g>
        {HONEYCOMB_CELLS.map(([cx, cy]) => (
          <polygon
            key={`cell-${cx}-${cy}`}
            points={hexPoints(x + cx, y + cy)}
            fill="none"
            stroke={accent}
            strokeOpacity="0.75"
          />
        ))}
      </g>
    );
  }

  return (
    <g>
      <rect
        x={x + CROSS.vertical.dx}
        y={y + CROSS.vertical.dy}
        width={CROSS.vertical.w}
        height={CROSS.vertical.h}
        fill={accent}
        fillOpacity="0.55"
      />
      <rect
        x={x + CROSS.horizontal.dx}
        y={y + CROSS.horizontal.dy}
        width={CROSS.horizontal.w}
        height={CROSS.horizontal.h}
        fill={accent}
        fillOpacity="0.55"
      />
    </g>
  );
}

/**
 * Типы рёбер, по контенту урока: «Схема: прямые, треугольные, сотовые, крестовые.
 * Под каждым — применение». Четыре панели 145×60: слева пластина с узором рёбер,
 * справа применение — деталь из примеров блока (кронштейн, корпус, шестерня) и то,
 * что эти рёбра дают по правилам блока (вдоль нагрузки, лёгкая панель, кручение).
 *
 * Про треугольные рёбра урок говорит только тип: применения в данных нет, поэтому
 * в рамке стоит «косынка в углах» — стандартное имя треугольной накладки, и панель
 * названа так же, как в уроке.
 *
 * От pro-I-I2-image-0 отличается тем, что там четыре детали с разным заполнением и
 * срезом решётки, а здесь одна пластина и четыре узора рёбер без среза.
 */
export function ProJJ2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Четыре типа рёбер на одной пластине: прямые — четыре полосы вдоль нагрузки, применяют в кронштейне; треугольные — косынки разбивают пластину на треугольники, применяют в углах; сотовые — соты в два ряда, применяют в корпусе и лёгких панелях; крестовые — две полосы крестом, применяют на шестерне под кручение; внизу вывод урока: рёбра делают в CAD, а не в слайсере"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          четыре типа рёбер и где их ставить
        </text>

        {RIBS.map((rib) => (
          <g key={rib.name}>
            <rect x={rib.x} y={rib.y} width={PANEL_W} height={PANEL_H} rx="8" fill="#0f172a" stroke="#475569" />
            <text x={rib.x + 8} y={rib.y + 12} fontSize="10" fontWeight="bold" fill={rib.accent}>
              {rib.name}
            </text>
            <rect
              x={rib.x + PLATE.dx}
              y={rib.y + PLATE.dy}
              width={PLATE.w}
              height={PLATE.h}
              rx="2"
              fill="#475569"
              stroke="#64748b"
            />
            <Pattern rib={rib} />
            {rib.apply.map((line, index) => (
              <text
                key={`${rib.name}-${line}`}
                x={rib.x + 74}
                y={rib.y + 36 + index * 12}
                fontSize="8.5"
                fill="#cbd5e1"
              >
                {line}
              </text>
            ))}
          </g>
        ))}

        <text x="12" y="170" fontSize="9" fill="#94a3b8">
          рёбра делают в CAD, а не в слайсере
        </text>
      </svg>
    </VisualWrapper>
  );
}
