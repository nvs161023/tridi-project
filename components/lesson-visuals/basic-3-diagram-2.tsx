import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Акцент кадра: усадка — тот же синий базового курса. */
const ACCENT = "#3b82f6";

/** Шкала усадки: 0 % и 1,5 % — верхняя граница ABS из подписи блока. */
const SCALE_X = 100;
const SCALE_MAX = 1.5;
const SCALE_WIDTH = 196;

/** Пикселей на процент усадки. */
const PX_PER_PERCENT = SCALE_WIDTH / SCALE_MAX;

/** Отметки шкалы: 0, 0,5, 1,0 и 1,5 %. */
const TICKS = [0, 0.5, 1, 1.5];

/** Верхняя граница оси и шаг строк: четыре материала встают просторно. */
const AXIS_Y = 40;
const ROW_TOP = 56;
const ROW_STEP = 26;

/**
 * Четыре материала в порядке подписи блока 22: усадка в процентах от размера
 * детали. ASA в кадр не попал: в подписи блока его нет, диапазон 0,4–0,7 % стоит
 * только в тексте про ASA.
 */
const MATERIALS: { name: string; shrink: [number, number] }[] = [
  { name: "PLA", shrink: [0.3, 0.5] },
  { name: "ABS", shrink: [0.5, 1.5] },
  { name: "PA", shrink: [0.6, 1] },
  { name: "PC", shrink: [0.5, 0.7] },
];

/**
 * Кадр блока 22 урока L3 «Усадка: почему деталь ведёт и коробит».
 *
 * Компоновка — шкала в процентах: четыре материала идут строками, у каждого
 * нарисован его диапазон усадки. Диапазон, а не полоса от нуля, потому что
 * значения урока заданы интервалом, и видно, что у ABS интервал втрое шире, чем
 * у PLA или PC. Под каждой строкой идёт тонкая дорожка от нуля до верхней
 * границы шкалы, чтобы место диапазона читалось однозначно.
 *
 * Числа — из подписи блока 22: PLA 0,3–0,5 %, ABS 0,5–1,5 %, PA 0,6–1 %,
 * PC 0,5–0,7 %. Строка «слой ложится при 250–270 °C» тоже из подписи блока и
 * стоит в кадре дословно: это не вывод визуализации, а фраза урока.
 */
export function Basic3Diagram2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Шкала усадки в процентах от размера детали: у PLA 0,3–0,5 %, у ABS 0,5–1,5 %, у PA 0,6–1 %, у PC 0,5–0,7 %. Шире всего разброс у ABS, поэтому его и коробит сильнее всех; слой ложится при 250–270 °C"
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
          Усадка, %: почему деталь ведёт и коробит
        </text>

        {/* Ось усадки: отметки 0, 0,5, 1,0 и 1,5 % */}
        <line x1={SCALE_X} y1={AXIS_Y} x2={SCALE_X + SCALE_WIDTH} y2={AXIS_Y} stroke="#64748b" />
        {TICKS.map((tick) => {
          const x = SCALE_X + tick * PX_PER_PERCENT;

          return (
            <g key={tick}>
              <line x1={x} y1={AXIS_Y} x2={x} y2={AXIS_Y + 4} stroke="#64748b" />
              <text x={x - 12} y={AXIS_Y - 5} fontSize="10" fill="#94a3b8">
                {String(tick).replace(".", ",")}
              </text>
            </g>
          );
        })}



        {/* Строки материалов: дорожка от нуля и диапазон усадки */}
        {MATERIALS.map((material, index) => {
          const top = ROW_TOP + index * ROW_STEP;

          return (
            <g key={material.name}>
              <text x="20" y={top + 10} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {material.name}
              </text>
              <text x="50" y={top + 10} fontSize="10" fill="#94a3b8">
                {String(material.shrink[0]).replace(".", ",")}–
                {String(material.shrink[1]).replace(".", ",")} %
              </text>
              <line x1={SCALE_X} y1={top + 4} x2={SCALE_X + SCALE_WIDTH} y2={top + 4} stroke="#475569" strokeOpacity="0.7" strokeDasharray="3 3" />
              <rect
                x={SCALE_X + material.shrink[0] * PX_PER_PERCENT}
                y={top}
                width={(material.shrink[1] - material.shrink[0]) * PX_PER_PERCENT}
                height="9"
                rx="2"
                fill={ACCENT}
                fillOpacity="0.85"
              />
            </g>
          );
        })}

        {/* Строка из подписи блока: температура, при которой ложится слой */}
        <text x="20" y="162" fontSize="10" fill="#94a3b8">
          слой ложится при 250–270 °C
        </text>
      </svg>
    </VisualWrapper>
  );
}
