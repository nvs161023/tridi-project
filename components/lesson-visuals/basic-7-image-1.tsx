import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре плотности заполнения: пусто, редко, плотно и сплошной. */
const tiles = [
  { x: 14, percent: "0 %", kind: "empty" },
  { x: 88, percent: "15 %", kind: "sparse" },
  { x: 162, percent: "40 %", kind: "dense" },
  { x: 236, percent: "100 %", kind: "solid" },
];

/** Вертикали и горизонтали редкой решётки (15 %). */
const sparseVerticals = [22, 44];
const sparseHorizontals = [70, 88];

/** Шаг плотной решётки (40 %): линии каждые 8 px внутри плитки. */
const denseVerticals = [8, 16, 24, 32, 40, 48, 56];
const denseHorizontals = [52, 60, 68, 76, 84, 92, 100];

/**
 * Виды заполнения — четыре плитки с разной плотностью.
 *
 * Ровно по content урока: «0%, 15%, 40%, 100%». Плитка размера 66×66: у 0 % видны
 * только стенки (оболочка), у 15 % редкая решётка, у 40 % плотная, у 100 % сплошной
 * пластик. Внизу подписи из того же урока: проценты для игрушек и прочных деталей,
 * и что Gyroid прочнее, а Cubic берут для сжатия.
 *
 * От схемы потока (урок 6) отличается форматом: там три дорожки линий со шкалой
 * процентов, здесь четыре квадратные плитки с рисунком заполнения.
 */
export function Basic7Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Виды заполнения: 0 процентов — только стенки, 15 — редкая решётка для игрушек, 40 — плотная для прочных деталей, 100 — сплошной пластик"
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

        {tiles.map((tile) => (
          <g key={tile.percent}>
            <rect
              x={tile.x}
              y="44"
              width="66"
              height="66"
              rx="6"
              fill="#0f172a"
              stroke="#475569"
            />

            {/* 0 %: только стенки, внутри пусто */}
            {tile.kind === "empty" ? (
              <rect
                x={tile.x + 6}
                y="50"
                width="54"
                height="54"
                rx="3"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="3"
              />
            ) : null}

            {/* 15 %: редкая решётка */}
            {tile.kind === "sparse" ? (
              <>
                {sparseVerticals.map((offset) => (
                  <line
                    key={`sv-${offset}`}
                    x1={tile.x + offset}
                    y1="54"
                    x2={tile.x + offset}
                    y2="100"
                    stroke="#34d399"
                    strokeWidth="2"
                  />
                ))}
                {sparseHorizontals.map((y) => (
                  <line
                    key={`sh-${y}`}
                    x1={tile.x + 10}
                    y1={y}
                    x2={tile.x + 56}
                    y2={y}
                    stroke="#34d399"
                    strokeWidth="2"
                  />
                ))}
              </>
            ) : null}

            {/* 40 %: плотная решётка */}
            {tile.kind === "dense" ? (
              <>
                {denseVerticals.map((offset) => (
                  <line
                    key={`dv-${offset}`}
                    x1={tile.x + offset}
                    y1="52"
                    x2={tile.x + offset}
                    y2="100"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                ))}
                {denseHorizontals.map((y) => (
                  <line
                    key={`dh-${y}`}
                    x1={tile.x + 8}
                    y1={y}
                    x2={tile.x + 58}
                    y2={y}
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                ))}
              </>
            ) : null}

            {/* 100 %: сплошной пластик */}
            {tile.kind === "solid" ? (
              <>
                <rect x={tile.x + 6} y="50" width="54" height="54" rx="3" fill="#334155" />
                <rect x={tile.x + 14} y="58" width="38" height="38" rx="3" fill="#475569" />
              </>
            ) : null}

            <text
              x={tile.x + 33}
              y="126"
              fontSize="11"
              fontWeight="bold"
              fill="#e2e8f0"
              textAnchor="middle"
            >
              {tile.percent}
            </text>
          </g>
        ))}

        <text x="14" y="146" fontSize="10" fill="#94a3b8">
          15 % — игрушки, 40 % — прочные детали
        </text>
        <text x="14" y="162" fontSize="10" fill="#94a3b8">
          Gyroid прочнее, Cubic — для сжатия
        </text>
      </svg>
    </VisualWrapper>
  );
}
