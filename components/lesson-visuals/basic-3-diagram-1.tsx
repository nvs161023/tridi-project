import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Акцент кадра: Tg — температура стеклования. */
const ACCENT = "#3b82f6";

/** HDT — температура прогиба под нагрузкой, она всегда ниже Tg. */
const HOT = "#f59e0b";

/** Начало шкалы: 0 °C и конец шкалы, где стоит PC со своими 150 °C. */
const SCALE_X = 112;
const SCALE_MAX = 150;
const SCALE_WIDTH = 184;

/** Пикселей на градус: вся шкала от 0 до 150 °C умещается в 184 px. */
const PX_PER_C = SCALE_WIDTH / SCALE_MAX;

/** Отметки шкалы: 0, 50, 100 и 150 °C. */
const TICKS = [0, 50, 100, 150];

/** Верхняя граница оси и высота ряда. */
const AXIS_Y = 36;
const ROW_TOP = 48;
const ROW_STEP = 24;

/** Полоса «под капотом»: там деталь из PLA и PETG уже не держится. */
const ENGINE_BAY: [number, number] = [90, 120];

/**
 * Четыре материала в порядке урока: Tg и HDT в градусах Цельсия, затем имя.
 * Tg из подписи блока 10, HDT из текстовых блоков про каждый материал.
 */
const MATERIALS: { name: string; tg: [number, number]; hdt: [number, number] }[] = [
  { name: "PLA", tg: [55, 60], hdt: [50, 55] },
  { name: "PETG", tg: [75, 80], hdt: [70, 75] },
  { name: "ABS", tg: [100, 105], hdt: [90, 100] },
  { name: "PC", tg: [145, 150], hdt: [130, 140] },
];

/**
 * Кадр блока 10 урока L3 «Tg, HDT и почему это главные цифры материала».
 *
 * Компоновка — шкала температур: четыре материала идут строками, у каждого своя
 * полоса от нуля до его Tg. Внутри полосы двумя цветами показаны два порога:
 * синим Tg из подписи блока, янтарным HDT. HDT всегда ниже Tg, поэтому янтарная
 * полоса стоит левее синей — это и есть главный смысл кадра. Поверх строк идёт
 * полоса «под капотом»: под ней видно, что PLA с PETG её не переживают, ABS
 * стоит на границе, а PC проходит с запасом.
 *
 * Числа — Tg из подписи блока 10: PLA 55–60, PETG 75–80, ABS 100–105,
 * PC 145–150 °C, и та же подпись называет «под капотом 90-120 °C». HDT берётся из
 * текста про каждый материал: PLA 50–55 (блок 4), PETG 70–75 (блок 7), ABS
 * 90–100 (блок 11), PC 130–140 (блок 19). Ниже 0 °C шкала не продолжается: там
 * ни одного значения из урока нет.
 */
export function Basic3Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Шкала температур для четырёх материалов: у PLA температура стеклования 55–60 °C, у PETG 75–80 °C, у ABS 100–105 °C, у PC 145–150 °C, а температура прогиба под нагрузкой всегда ниже. Полоса «под капотом» занимает 90–120 °C: там PLA и PETG ползут, ABS стоит на границе, а PC работает с запасом"
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
          Tg и HDT, °C: главные цифры материала
        </text>

        {/* Ось температур: отметки 0, 50, 100 и 150 °C */}
        <line x1={SCALE_X} y1={AXIS_Y} x2={SCALE_X + SCALE_WIDTH} y2={AXIS_Y} stroke="#64748b" />
        {TICKS.map((tick) => {
          const x = SCALE_X + tick * PX_PER_C;

          return (
            <g key={tick}>
              <line x1={x} y1={AXIS_Y} x2={x} y2={AXIS_Y + 4} stroke="#64748b" />
              <text x={x - 9} y={AXIS_Y - 5} fontSize="10" fill="#94a3b8">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Полоса «под капотом»: 90–120 °C */}
        <rect
          x={SCALE_X + ENGINE_BAY[0] * PX_PER_C}
          y={AXIS_Y}
          width={(ENGINE_BAY[1] - ENGINE_BAY[0]) * PX_PER_C}
          height="112"
          fill={HOT}
          fillOpacity="0.18"
          stroke={HOT}
          strokeOpacity="0.5"
        />

        {/* Строки материалов: полоса до Tg, внутри синий Tg и янтарный HDT */}
        {MATERIALS.map((material, index) => {
          const top = ROW_TOP + index * ROW_STEP;

          return (
            <g key={material.name}>
              <text x="20" y={top + 11} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {material.name}
              </text>
              <text x="62" y={top + 11} fontSize="10" fill="#94a3b8">
                {material.tg[0]}–{material.tg[1]}
              </text>
              <rect
                x={SCALE_X}
                y={top}
                width={material.tg[1] * PX_PER_C}
                height="12"
                rx="2"
                fill="#0f172a"
                fillOpacity="0.5"
                stroke="#475569"
              />
              <rect
                x={SCALE_X + material.tg[0] * PX_PER_C}
                y={top + 1}
                width={(material.tg[1] - material.tg[0]) * PX_PER_C}
                height="4.5"
                fill={ACCENT}
              />
              <rect
                x={SCALE_X + material.hdt[0] * PX_PER_C}
                y={top + 6.5}
                width={(material.hdt[1] - material.hdt[0]) * PX_PER_C}
                height="4.5"
                fill={HOT}
              />
            </g>
          );
        })}

        {/* Легенда: два порога и полоса «под капотом» */}
        <rect x="20" y="156" width="8" height="8" rx="1" fill={ACCENT} />
        <text x="32" y="164" fontSize="10" fill="#cbd5e1">
          Tg
        </text>
        <rect x="66" y="156" width="8" height="8" rx="1" fill={HOT} />
        <text x="78" y="164" fontSize="10" fill="#cbd5e1">
          HDT
        </text>
        <rect x="116" y="156" width="8" height="8" rx="1" fill={HOT} fillOpacity="0.35" />
        <text x="128" y="164" fontSize="10" fill="#cbd5e1">
          под капотом 90–120 °C
        </text>
      </svg>
    </VisualWrapper>
  );
}
