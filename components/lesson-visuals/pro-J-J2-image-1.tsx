import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пример из content блока: деталь, её название и подпись про жёсткость. */
type Example = {
  /** Левый край панели 94×124. Все панели стоят на y=26, поэтому в деталях
   *  x — смещения от левого края панели, а y — координаты рамки. */
  x: number;
  /** Название детали — слово из content блока. */
  name: string;
  /** Подпись внизу панели — тоже слова из content блока. */
  caption: string;
  /** У каждой детали свой вид и свой тип рёбер. */
  kind: "bracket" | "housing" | "gear";
};

const EXAMPLES: Example[] = [
  { x: 12, name: "кронштейн", caption: "рёбра жёсткости", kind: "bracket" },
  { x: 114, name: "корпус", caption: "сотовая структура", kind: "housing" },
  { x: 216, name: "шестерня", caption: "крестовые рёбра", kind: "gear" },
];

const PANEL_W = 94;
const PANEL_H = 124;

/** Кронштейн: уголок 12 мм, рёбра по внутреннему углу, два отверстия. */
const PLATE: [number, number][] = [
  [20, 58],
  [32, 58],
  [32, 112],
  [78, 112],
  [78, 124],
  [20, 124],
];

/** Рёбра кронштейна: прямые, идут от полки к стойке под 45°. */
const BRACKET_RIBS: [number, number, number, number][] = [
  [34, 112, 48, 98],
  [42, 112, 56, 98],
  [50, 112, 64, 98],
];

/** Отверстия в стойке и в полке. */
const BOLT_HOLES: [number, number][] = [
  [26, 70],
  [66, 118],
];

/** Корпус: борт с сотовой структурой. */
const HOUSING = { dx: 18, dy: 64, w: 58, h: 60 };
const FLANGE = { dx: 14, dy: 58, w: 66, h: 6 };

/** Соты внутри борта: три ряда по два-три шестиугольника. */
const CELLS: [number, number][] = [
  [34, 78],
  [48, 78],
  [62, 78],
  [41, 90],
  [55, 90],
  [34, 102],
  [48, 102],
  [62, 102],
];

const CELL_RADIUS = 7;

/** Шестерня: 12 зубьев, ступица с отверстием и крестовые рёбра на диске. */
const GEAR = { dx: 49, dy: 92, body: 24, teeth: 30, hub: 7, bore: 3 };

const TOOTH_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

/** Точки шестиугольной соты: вершины через 60°, плоская грань сверху. */
function hexPoints(cx: number, cy: number): string {
  return [0, 60, 120, 180, 240, 300]
    .map((angle) => {
      const rad = (angle * Math.PI) / 180;
      return `${Math.round(cx + CELL_RADIUS * Math.cos(rad))},${Math.round(cy + CELL_RADIUS * Math.sin(rad))}`;
    })
    .join(" ");
}

/**
 * Деталь крупным планом: у кронштейна рёбра в углу, у корпуса соты в борту,
 * у шестерни крест на диске. Светятся ровно рёбра — тело детали серое.
 */
function Part({ example }: { example: Example }) {
  const { x, kind } = example;

  if (kind === "bracket") {
    return (
      <g>
        <polygon
          points={PLATE.map(([dx, y]) => `${x + dx},${y}`).join(" ")}
          fill="#475569"
          stroke="#64748b"
        />
        {BRACKET_RIBS.map(([dx1, y1, dx2, y2]) => (
          <line
            key={`rib-${dx1}`}
            x1={x + dx1}
            y1={y1}
            x2={x + dx2}
            y2={y2}
            stroke="#38bdf8"
            strokeOpacity="0.75"
            strokeWidth="1.6"
          />
        ))}
        {BOLT_HOLES.map(([dx, cy]) => (
          <circle key={`hole-${dx}`} cx={x + dx} cy={cy} r="3" fill="#0f172a" stroke="#64748b" />
        ))}
      </g>
    );
  }

  if (kind === "housing") {
    return (
      <g>
        <rect
          x={x + FLANGE.dx}
          y={FLANGE.dy}
          width={FLANGE.w}
          height={FLANGE.h}
          rx="2"
          fill="#64748b"
        />
        <rect
          x={x + HOUSING.dx}
          y={HOUSING.dy}
          width={HOUSING.w}
          height={HOUSING.h}
          rx="3"
          fill="none"
          stroke="#64748b"
          strokeWidth="1.4"
        />
        {CELLS.map(([cx, cy]) => (
          <polygon
            key={`cell-${cx}-${cy}`}
            points={hexPoints(x + cx, cy)}
            fill="none"
            stroke="#34d399"
            strokeOpacity="0.75"
          />
        ))}
      </g>
    );
  }

  const cx = x + GEAR.dx;
  const cy = GEAR.dy;

  return (
    <g>
      {TOOTH_ANGLES.map((angle) => (
        <rect
          key={`tooth-${angle}`}
          x={cx + GEAR.body}
          y={cy - 3}
          width={GEAR.teeth - GEAR.body}
          height="6"
          rx="1"
          fill="#64748b"
          transform={`rotate(${angle} ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r={GEAR.body} fill="#475569" stroke="#64748b" />
      <rect x={cx - 2.5} y={cy - GEAR.body} width="5" height={GEAR.body * 2} fill="#c4b5fd" fillOpacity="0.55" />
      <rect x={cx - GEAR.body} y={cy - 2.5} width={GEAR.body * 2} height="5" fill="#c4b5fd" fillOpacity="0.55" />
      <circle cx={cx} cy={cy} r={GEAR.hub} fill="#64748b" />
      <circle cx={cx} cy={cy} r={GEAR.bore} fill="#0f172a" />
    </g>
  );
}

/**
 * Примеры, по контенту урока: «Фото: кронштейн с рёбрами, корпус с сотовой
 * структурой, шестерня с крестовыми рёбрами». Три панели 94×124 — по одной детали,
 * как их нарисовал бы снимок: кронштейн-уголок с прямыми рёбрами по внутреннему углу
 * и двумя отверстиями, борт корпуса с сотовой структурой, шестерня с крестом на
 * диске. Подписи взяты из content блока, светится только жёсткость — рёбра и соты.
 *
 * Прототипы деталей те же, что в pro-J-J2-image-0, но там одна пластина и четыре
 * узора рёбер, а здесь сами детали. От pro-J-J5-image-0/1/2 отличается тем, что там
 * у каждой детали ещё схема нагрузки и параметры печати, а здесь только внешний вид.
 */
export function ProJJ2Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три примера деталей с рёбрами: кронштейн-уголок с прямыми рёбрами по внутреннему углу и двумя отверстиями; борт корпуса с сотовой структурой из восьми шестиугольных ячеек; шестерня с двенадцатью зубьями, ступицей с отверстием и крестовыми рёбрами на диске; внизу вывод урока: рёбра экономят 30–50% пластика"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          примеры: три детали с рёбрами
        </text>

        {EXAMPLES.map((example) => (
          <g key={example.name}>
            <rect
              x={example.x}
              y="26"
              width={PANEL_W}
              height={PANEL_H}
              rx="8"
              fill="#0f172a"
              stroke="#475569"
            />
            <text x={example.x + 8} y="39" fontSize="10" fontWeight="bold" fill="#e2e8f0">
              {example.name}
            </text>
            <Part example={example} />
            <text x={example.x + 47} y="142" fontSize="8.5" fill="#cbd5e1" textAnchor="middle">
              {example.caption}
            </text>
          </g>
        ))}

        <text x="12" y="164" fontSize="9" fill="#94a3b8">
          рёбра экономят 30–50% пластика
        </text>
      </svg>
    </VisualWrapper>
  );
}
