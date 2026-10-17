import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Разрез детали: 20…168 по X, 36…116 по Y, стенка 10 px. */
const PART = { x: 20, y: 36, w: 148, h: 80 };
const SHELL = 10;
/** Четыре слоя крыши: 40, 45, 50, 55. */
const TOP_LAYERS = [4, 9, 14, 19];
/** Волны решётки между стенками: четыре линии по 12 точек. */
const LATTICE_X = [46, 76, 106, 136].map((x) =>
  Array.from({ length: 12 }, (_, index) => {
    const y = 60 + index * 4;
    const wave = 5 * Math.sin(index * 0.9);
    return `${(x + wave).toFixed(1)},${y}`;
  }).join(" "),
);

type Row = { label: string; value: string; key?: boolean };

/** Что видно в разрезе — блоки 6 и 12. */
const ROWS: Row[] = [
  { label: "периметры", value: "3 × 0,45 мм", key: true },
  { label: "заполнение", value: "20 %" },
  { label: "решётка", value: "gyroid" },
  { label: "верх", value: "4 слоя" },
];

/**
 * Кадр блока 7 урока C10 «Разрез детали: стенки и решётка».
 *
 * Макет из описания кадра `C10_infill_cut.png`: одна деталь в разрезе, по краям
 * стенки-периметры, сверху четыре слоя крыши, внутри волны гироида. Блок 12
 * говорит, что нагрузку несут периметры, а заполнение держит потолки и связывает
 * стенки: четвёртый периметр добавляет прочности больше, чем лишние 20 %.
 */
export function ConfidentC10Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Разрез детали: по краям стенки-периметры по 0,45 мм, сверху четыре сплошных слоя, внутри решётка гироида на 20 %. Стенки несут нагрузку, решётка держит потолок и связывает стенки. Четвёртый периметр добавляет прочности больше, чем лишние 20 % заполнения. В разрезе видно, где на самом деле пластик"
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
          разрез: стенки и решётка
        </text>

        {/* Внутренний объём */}
        <rect
          x={PART.x}
          y={PART.y}
          width={PART.w}
          height={PART.h}
          fill="#0f172a"
          fillOpacity="0.45"
        />

        {/* Стенки-периметры и дно */}
        <rect
          x={PART.x}
          y={PART.y}
          width={SHELL}
          height={PART.h}
          fill="#475569"
          stroke="#64748b"
        />
        <rect
          x={PART.x + PART.w - SHELL}
          y={PART.y}
          width={SHELL}
          height={PART.h}
          fill="#475569"
          stroke="#64748b"
        />
        <rect
          x={PART.x}
          y={PART.y + PART.h - SHELL}
          width={PART.w}
          height={SHELL}
          fill="#475569"
          stroke="#64748b"
        />

        {/* Крыша: четыре слоя между стенками */}
        {TOP_LAYERS.map((offset) => (
          <line
            key={offset}
            x1={PART.x + SHELL}
            y1={PART.y + offset}
            x2={PART.x + PART.w - SHELL}
            y2={PART.y + offset}
            stroke="#94a3b8"
            strokeOpacity="0.5"
          />
        ))}

        {/* Решётка внутри */}
        {LATTICE_X.map((points) => (
          <polyline
            key={points}
            points={points}
            fill="none"
            stroke="#10b981"
            strokeOpacity="0.6"
          />
        ))}

        {/* Числа справа */}
        {ROWS.map((row, index) => {
          const y = 52 + index * 22;
          return (
            <g key={row.label}>
              <text x="188" y={y} fontSize="10" fill="#cbd5e1">
                {row.label}
              </text>
              <text
                x="304"
                y={y}
                fontSize="10"
                fontWeight={row.key ? "700" : "400"}
                fill={row.key ? "#fcd34d" : "#e2e8f0"}
                textAnchor="end"
              >
                {row.value}
              </text>
            </g>
          );
        })}

        <text x="12" y="142" fontSize="10" fontWeight="700" fill="#e2e8f0">
          Стенки несут нагрузку, решётка держит потолок
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          Четвёртый периметр прочнее, чем +20 % заполнения
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          В разрезе видно, где на самом деле пластик
        </text>
      </svg>
    </VisualWrapper>
  );
}
