import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три круга: центры 42, 94 и 146 на высоте 78, радиус 24. */
const CIRCLES = [42, 94, 146];
const CY = 78;
const R = 24;
/** Колонка допусков: подписи 190…308, три строки через 36. */
const STAT_X = 190;
const STAT_TOP = 58;
const STAT_STEP = 36;

type Tolerance = { value: string; sides: number; color: string; note: string };

/** Три допуска из описания кадра `C8_circle_segments.png`: 0,1, 0,05 и 0,01 мм. */
const TOLERANCES: Tolerance[] = [
  { value: "0,1 мм", sides: 8, color: "#f87171", note: "грани видно" },
  { value: "0,05 мм", sides: 18, color: "#f59e0b", note: "рабочий компромисс" },
  { value: "0,01 мм", sides: 0, color: "#10b981", note: "круг, тяжёлый файл" },
];

/** Правильный многоугольник: вершина наверху, дальше по часовой стрелке. */
function polygon(cx: number, cy: number, radius: number, sides: number) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / sides;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
}

/**
 * Кадр блока 22 урока C8 «Окружность из сегментов».
 *
 * Круг при трёх допусках из описания кадра `C8_circle_segments.png`: 0,1 мм
 * оставляет восемь видимых граней, 0,05 мм — восемнадцать, а 0,01 мм даёт
 * гладкий круг и тяжёлый файл. Справа — цена каждого допуска (блок 21), внизу —
 * проверка с блока 21: круг Ø30 на просвет должен попадать в один ровный зазор,
 * а мельче допуск — больше строк G-кода.
 */
export function ConfidentC8Diagram2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Окружность из сегментов. Круг при допуске 0,1 миллиметра — восемь видимых граней. При 0,05 миллиметра — восемнадцать граней, это рабочий компромисс. При 0,01 миллиметра контур гладкий, но файл тяжёлый. Круг 30 миллиметров на просвет должен попадать в один ровный зазор. Мельче допуск — больше строк G-кода"
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
          круг при трёх допусках
        </text>

        {/* Три контура: восемь граней, восемнадцать и гладкий круг */}
        {TOLERANCES.map((tolerance, index) => {
          const cx = CIRCLES[index];
          return (
            <g key={tolerance.value}>
              {tolerance.sides === 0 ? (
                <circle
                  cx={cx}
                  cy={CY}
                  r={R}
                  fill={tolerance.color}
                  fillOpacity="0.14"
                  stroke={tolerance.color}
                  strokeWidth="1.6"
                />
              ) : (
                <polygon
                  points={polygon(cx, CY, R, tolerance.sides)}
                  fill={tolerance.color}
                  fillOpacity="0.14"
                  stroke={tolerance.color}
                  strokeWidth="1.6"
                />
              )}
              <text
                x={cx}
                y="116"
                fontSize="10"
                fontWeight="700"
                fill={tolerance.color}
                textAnchor="middle"
              >
                {tolerance.value}
              </text>
            </g>
          );
        })}

        <text x="12" y="134" fontSize="10" fill="#64748b">
          Ø30, вид сверху
        </text>

        {/* Цена каждого допуска */}
        {TOLERANCES.map((tolerance, index) => {
          const y = STAT_TOP + index * STAT_STEP;
          return (
            <g key={tolerance.value}>
              <text x={STAT_X} y={y} fontSize="10" fontWeight="700" fill={tolerance.color}>
                {tolerance.value}
              </text>
              <text x={STAT_X} y={y + 12} fontSize="10" fill="#94a3b8">
                {tolerance.note}
              </text>
            </g>
          );
        })}

        <text x="12" y="160" fontSize="10" fontWeight="700" fill="#e2e8f0">
          Ø30 на просвет — один ровный зазор
        </text>
        <text x="12" y="171" fontSize="10" fill="#94a3b8">
          Мельче допуск — больше строк G-кода
        </text>
      </svg>
    </VisualWrapper>
  );
}
