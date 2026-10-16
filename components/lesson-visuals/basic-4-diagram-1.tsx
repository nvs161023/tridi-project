import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Те же цвета, что в кадре предпросмотра: синий — периметры, оранжевый —
 * заполнение, зелёный — потолки. Один язык на весь урок.
 */
const PERIMETER = "#3b82f6";
const INFILL = "#f59e0b";
const TOP_LAYER = "#10b981";

/** Две панели: слева разрез стенки 12…148, справа три выноски 156…308. */
const PANEL_TOP = 24;
const PANEL_H = 128;
const LEFT_X = 12;
const LEFT_W = 136;
const RIGHT_X = 156;
const RIGHT_W = 152;

/** Стенка в разрезе: от верха 46 до низа 140, три периметра идут через 4 px. */
const WALL_TOP = 46;
const WALL_BOTTOM = 140;
const LEFT_PERIMETERS = [36, 40, 44];
const RIGHT_PERIMETERS = [124, 120, 116];

/** Потолки: три верхних слоя по всей ширине стенки. */
const TOP_LAYERS = [50, 53, 56];

/** Решётка gyroid между периметрами: четыре волны на столбик. */
const GYROID_X = [52, 64, 76, 88, 100, 112];
const GYROID_TOP = 62;

/** Три выноски справа: образец линии и две строки текста. */
const CALLOUT_TOP = 36;
const CALLOUT_STEP = 34;
const SWATCH_X = 166;
const TEXT_X = 186;

type SwatchKind = "perimeters" | "infill" | "top";

/**
 * Три выноски ровно по подписи блока 13: «3 периметра × 0,45 = 1,35 мм»,
 * «решётка gyroid, заполнение 20 %» и «потолки в 3 слоя».
 */
const CALLOUTS: { kind: SwatchKind; line1: string; line2: string }[] = [
  { kind: "perimeters", line1: "3 периметра × 0,45", line2: "= 1,35 мм" },
  { kind: "infill", line1: "решётка gyroid", line2: "заполнение 20 %" },
  { kind: "top", line1: "потолки", line2: "в 3 слоя" },
];

/** Образец линии в выноске: тот же рисунок, что и в разрезе стенки. */
function CalloutSwatch({ kind, top }: { kind: SwatchKind; top: number }) {
  if (kind === "perimeters") {
    return (
      <g>
        {[0, 5, 10].map((dx) => (
          <line
            key={dx}
            x1={SWATCH_X + dx}
            y1={top + 8}
            x2={SWATCH_X + dx}
            y2={top + 26}
            stroke={PERIMETER}
            strokeWidth="1.2"
          />
        ))}
      </g>
    );
  }

  if (kind === "infill") {
    return (
      <path
        d={`M${SWATCH_X} ${top + 18} q 4 -6 8 0 q 4 6 8 0`}
        fill="none"
        stroke={INFILL}
        strokeWidth="1.2"
      />
    );
  }

  return (
    <g>
      {[0, 4, 8].map((dy) => (
        <line
          key={dy}
          x1={SWATCH_X}
          y1={top + 14 + dy}
          x2={SWATCH_X + 18}
          y2={top + 14 + dy}
          stroke={TOP_LAYER}
          strokeWidth="1.2"
        />
      ))}
    </g>
  );
}

/**
 * Кадр блока 13 урока L4 «Разрез детали: периметры, заполнение, потолки».
 *
 * Компоновка — разрез стенки слева и три выноски справа. В разрезе с каждой
 * стороны идёт группа из трёх периметров (три линии по 4 px), между ними —
 * волнистая решётка gyroid, а сверху стенку закрывают три верхних слоя. Это тот
 * же язык, что в кадре предпросмотра: синие периметры, оранжевое заполнение,
 * зелёные потолки, поэтому кадры читаются вместе.
 *
 * Числа — из подписи блока 13: 3 периметра × 0,45 = 1,35 мм, решётка gyroid с
 * заполнением 20 %, потолки в 3 слоя. Формула в сноске — из блока 12, где та же
 * связь названа словами: толщина стенки — это число периметров, умноженное на
 * ширину линии. Ширина линии 0,45 мм — из ориентиров блока 12.
 */
export function Basic4Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Разрез стенки детали: с каждой стороны по три периметра шириной 0,45 мм, вместе 1,35 мм, между ними волнистая решётка gyroid с заполнением 20 %, а сверху стенку закрывают три верхних слоя. Толщина стенки равна числу периметров, умноженному на ширину линии 0,45 мм"
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

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          Разрез детали: периметры, заполнение, потолки
        </text>

        {/* Разрез стенки: тело, три периметра с каждой стороны, решётка и потолки */}
        <rect
          x={LEFT_X}
          y={PANEL_TOP}
          width={LEFT_W}
          height={PANEL_H}
          rx="10"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <rect x="44" y="56" width="72" height="84" fill="#334155" fillOpacity="0.35" />
        <rect x="36" y={WALL_TOP} width="8" height={WALL_BOTTOM - WALL_TOP} fill="#334155" />
        <rect x="116" y={WALL_TOP} width="8" height={WALL_BOTTOM - WALL_TOP} fill="#334155" />
        {GYROID_X.map((x) => (
          <path
            key={`gyroid-${x}`}
            d={`M${x} ${GYROID_TOP} q 5 9.5 0 19 q -5 9.5 0 19 q 5 9.5 0 19 q -5 9.5 0 19`}
            fill="none"
            stroke={INFILL}
            strokeOpacity="0.8"
          />
        ))}
        {TOP_LAYERS.map((y) => (
          <line key={`top-${y}`} x1="36" y1={y} x2="124" y2={y} stroke={TOP_LAYER} strokeWidth="1.2" />
        ))}
        {LEFT_PERIMETERS.map((x) => (
          <line key={`left-${x}`} x1={x} y1={WALL_TOP} x2={x} y2={WALL_BOTTOM} stroke={PERIMETER} strokeWidth="1.2" />
        ))}
        {RIGHT_PERIMETERS.map((x) => (
          <line key={`right-${x}`} x1={x} y1={WALL_TOP} x2={x} y2={WALL_BOTTOM} stroke={PERIMETER} strokeWidth="1.2" />
        ))}
        <line x1="36" y1={WALL_BOTTOM} x2="124" y2={WALL_BOTTOM} stroke={PERIMETER} strokeWidth="1.2" />

        {/* Три выноски справа: образец линии и две строки с числами */}
        <rect
          x={RIGHT_X}
          y={PANEL_TOP}
          width={RIGHT_W}
          height={PANEL_H}
          rx="10"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {CALLOUTS.map((callout, index) => {
          const top = CALLOUT_TOP + index * CALLOUT_STEP;

          return (
            <g key={callout.line1}>
              <CalloutSwatch kind={callout.kind} top={top} />
              <text x={TEXT_X} y={top + 18} fontSize="10" fill="#e2e8f0">
                {callout.line1}
              </text>
              <text x={TEXT_X} y={top + 32} fontSize="10" fill="#e2e8f0">
                {callout.line2}
              </text>
            </g>
          );
        })}

        {/* Сноска-формула из блока 12 */}
        <rect x="12" y="156" width="296" height="16" rx="6" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="22" y="168" fontSize="10" fill="#94a3b8">
          толщина стенки = число периметров × 0,45 мм
        </text>
      </svg>
    </VisualWrapper>
  );
}
