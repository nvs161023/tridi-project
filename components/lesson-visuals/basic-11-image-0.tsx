import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три стадии дорожки: номер, цвет, подпись (content урока, слово в слово). */
const stages = [
  { cx: 56, accent: "#3b82f6", caption: "после печати", kind: "print" },
  { cx: 160, accent: "#34d399", caption: "после шкурки", kind: "sand" },
  { cx: 264, accent: "#f59e0b", caption: "после лака", kind: "gloss" },
];

/** Кубик 56×50: полуширина и полная высота (верхнее ребро — вершина верхней грани). */
const HALF_W = 28;
const CUBE_HEIGHT = 50;

/** Риски слоёв на боковых гранях: смещение вниз от верхнего ребра. */
const layerOffsets = [6, 12, 18, 24];

/** Пыль после шкурки и блики после лака — смещения от вершины кубика. */
const dust = [
  { dx: -32, dy: -16 },
  { dx: -20, dy: 48 },
  { dx: 30, dy: -14 },
  { dx: 22, dy: 46 },
  { dx: 36, dy: 20 },
];

const sparkles = [
  { dx: 22, dy: 2 },
  { dx: -26, dy: 32 },
];

/** Четырёхлучевой блик. */
function sparkle(cx: number, cy: number) {
  return `${cx},${cy - 5} ${cx + 1.5},${cy - 1.5} ${cx + 5},${cy} ${cx + 1.5},${cy + 1.5} ${cx},${cy + 5} ${cx - 1.5},${cy + 1.5} ${cx - 5},${cy} ${cx - 1.5},${cy - 1.5}`;
}

/**
 * Кубик на столе панели: `kind` меняет только отделку поверхности.
 *
 * print — видны риски слоёв и рядом стоит столбик поддержек;
 * sand — слои сглажены, вокруг пыль от шкурки;
 * gloss — гладкие грани и блики лака.
 *
 * ox, oy — центр верхнего ребра кубика (вершина верхней грани).
 */
function stageCube(kind: string, ox: number, oy: number) {
  const top = oy + 10;
  const bottom = oy + CUBE_HEIGHT;

  return (
    <>
      {/* Стол печати */}
      <line
        x1={ox - 34}
        y1={bottom + 2}
        x2={ox + 34}
        y2={bottom + 2}
        stroke="#334155"
        strokeWidth="2"
      />

      {/* Верхняя грань */}
      <polygon
        points={`${ox - HALF_W},${top} ${ox},${oy} ${ox + HALF_W},${top} ${ox},${top + 10}`}
        fill="#334155"
        stroke="#475569"
      />

      {/* Левая и правая боковые грани */}
      <polygon
        points={`${ox - HALF_W},${top} ${ox},${top + 10} ${ox},${bottom} ${ox - HALF_W},${bottom - 10}`}
        fill="#1e293b"
        stroke="#475569"
      />
      <polygon
        points={`${ox},${top + 10} ${ox + HALF_W},${top} ${ox + HALF_W},${bottom - 10} ${ox},${bottom}`}
        fill="#0f172a"
        stroke="#475569"
      />

      {kind === "print"
        ? layerOffsets.map((offset) => (
            <g key={offset}>
              <line
                x1={ox - HALF_W}
                y1={top + offset}
                x2={ox}
                y2={top + 10 + offset}
                stroke="#64748b"
              />
              <line
                x1={ox}
                y1={top + 10 + offset}
                x2={ox + HALF_W}
                y2={top + offset}
                stroke="#64748b"
              />
            </g>
          ))
        : null}

      {/* Поддержки рядом с деталью — снимать кусачками (блок «Что сделать») */}
      {kind === "print" ? (
        <>
          <rect x={ox + 30} y={bottom - 26} width="7" height="28" rx="1" fill="#475569" />
          <line
            x1={ox + 30}
            y1={bottom - 18}
            x2={ox + 37}
            y2={bottom - 18}
            stroke="#1e293b"
          />
          <line
            x1={ox + 30}
            y1={bottom - 8}
            x2={ox + 37}
            y2={bottom - 8}
            stroke="#1e293b"
          />
        </>
      ) : null}

      {kind === "sand"
        ? dust.map((spot) => (
            <circle
              key={`${spot.dx}-${spot.dy}`}
              cx={ox + spot.dx}
              cy={oy + spot.dy}
              r="1.4"
              fill="#94a3b8"
            />
          ))
        : null}

      {kind === "gloss" ? (
        <>
          <polygon
            points={`${ox - 20},${top - 1} ${ox - 6},${oy + 2} ${ox + 2},${oy + 5} ${ox - 12},${top + 2}`}
            fill="#f8fafc"
            fillOpacity="0.5"
          />
          <polygon
            points={`${ox - 24},${top + 12} ${ox - 17},${top + 15} ${ox - 19},${bottom - 12} ${ox - 26},${bottom - 15}`}
            fill="#f8fafc"
            fillOpacity="0.25"
          />
          {sparkles.map((spot) => (
            <polygon
              key={`${spot.dx}-${spot.dy}`}
              points={sparkle(ox + spot.dx, oy + spot.dy)}
              fill="#fbbf24"
              fillOpacity="0.85"
            />
          ))}
        </>
      ) : null}
    </>
  );
}

/**
 * До и после — горизонтальная дорожка из трёх стадий постобработки.
 *
 * Ровно по content урока: «После печати → после шкурки → после лака». Первая
 * панель — кубик с рисками слоёв и поддержками рядом (блок «Что сделать»: убрать
 * поддержки кусачками), вторая — сглаженные грани и пыль от шкурки (P200 → P1000),
 * третья — глянец и блики лака.
 *
 * От остальных визуализаций отличается форматом: единственная дорожка со
 * стрелками между стадиями. Кубик в уроке 9 показывали крупно и целиком, здесь он
 * маленький и меняется от панели к панели — видно, что даёт каждый шаг.
 */
export function Basic11Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="До и после: после печати кубик с рисками слоёв и поддержками, после шкурки — сглаженный и с пылью, после лака — гладкий и блестящий"
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

        {/* Дорожка со стрелками между стадиями */}
        <line x1="40" y1="48" x2="280" y2="48" stroke="#334155" strokeWidth="2" />
        {stages.slice(0, -1).map((stage, index) => {
          const tip = stages[index + 1].cx - 22;

          return (
            <g key={stage.caption}>
              <line
                x1={stage.cx + 22}
                y1="48"
                x2={tip}
                y2="48"
                stroke="#64748b"
                strokeWidth="2"
              />
              <polygon points={`${tip - 8},43 ${tip},48 ${tip - 8},53`} fill="#64748b" />
            </g>
          );
        })}

        {stages.map((stage, index) => (
          <g key={stage.caption}>
            <rect
              x={stage.cx - 10}
              y="38"
              width="20"
              height="20"
              rx="6"
              fill="#0f172a"
              stroke={stage.accent}
              strokeWidth="1.6"
            />
            <text
              x={stage.cx}
              y="52"
              fontSize="11"
              fontWeight="bold"
              fill={stage.accent}
              textAnchor="middle"
            >
              {index + 1}
            </text>
            <rect
              x={stage.cx - 42}
              y="64"
              width="84"
              height="82"
              rx="8"
              fill="#0f172a"
              stroke="#334155"
            />
            {stageCube(stage.kind, stage.cx, 84)}
            <text x={stage.cx} y="162" fontSize="10" fill="#e2e8f0" textAnchor="middle">
              {stage.caption}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
