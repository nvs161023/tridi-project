import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре типа линии: те же акценты, что в кадрах L2 и L3. */
const PERIMETER = "#3b82f6";
const INFILL = "#f59e0b";
const TOP_LAYER = "#10b981";
const SUPPORT = "#f87171";

/**
 * Легенда: четыре типа линии из подписи блока 6. Порядок — как в подписи:
 * периметры, заполнение, потолки, поддержки.
 */
const LEGEND: { name: string; color: string; width: number; dash?: string }[] = [
  { name: "периметры", color: PERIMETER, width: 2 },
  { name: "заполнение", color: INFILL, width: 1 },
  { name: "потолки", color: TOP_LAYER, width: 1.8 },
  { name: "поддержки", color: SUPPORT, width: 1, dash: "4 3" },
];

/** Окно предпросмотра слева: 12…206 по X, 24…148 по Y. */
const WINDOW_X = 12;
const WINDOW_TOP = 24;
const WINDOW_W = 194;
const WINDOW_H = 124;

/** Стол внутри окна: деталь стоит на этой линии. */
const BED_Y = 140;

/**
 * Деталь в окне — схематичный кронштейн: стойка 34…74 по X и полка от 74 до 164
 * на высоте 56…78. Под полкой остаётся пустота, и туда идут поддержки: так на
 * кадре видно все четыре типа линии сразу.
 */
const PART_PATH = "M34 56 h130 v22 h-90 v62 h-40 z";

/** Верхние слои: три линии по верхней плоскости детали. */
const TOP_LINES = [60, 63, 66];

/** Заполнение в стойке: четыре волны, как решётка внутри контура. */
const INFILL_LINES = [84, 98, 112, 126];

/** Поддержки: область под полкой и восемь стоек внутри неё. */
const SUPPORT_TOP = 84;
const SUPPORT_LINES = [90, 99, 108, 117, 126, 135, 144, 153];

/** Легенда справа: заголовок и четыре строки. */
const LEGEND_X = 216;
const LEGEND_ROW_Y = [60, 82, 104, 126];

/**
 * Панель чисел из подписи блока 6: время, пластик, число слоёв. Координаты
 * подобраны так, чтобы пары «подпись — значение» не сходились между собой.
 */
const PANEL: { label: string; value: string; labelX: number; valueX: number }[] = [
  { label: "время", value: "3 ч 12 мин", labelX: 22, valueX: 62 },
  { label: "пластик", value: "78 г", labelX: 128, valueX: 178 },
  { label: "слоёв", value: "640", labelX: 222, valueX: 258 },
];

/**
 * Кадр блока 6 урока L4 «Предпросмотр: цвета по типу линии».
 *
 * Компоновка — имитация окна предпросмотра слева и легенда справа. В окне
 * схематичный кронштейн: синие периметры по контуру, зелёные верхние слои,
 * оранжевое заполнение в стойке и красные поддержки под полкой. Смысл кадра —
 * легенда, поэтому поддержки нарисованы как отдельная область с зазором от
 * детали: в предпросмотре они так и читаются.
 *
 * Числа, и только они, — из подписи блока 6: время 3 ч 12 мин, пластик 78 г,
 * 640 слоёв. Четыре типа линии — оттуда же. Форма детали схематичная: в подписи
 * блока она не названа, поэтому это «кронштейн», а не конкретная модель.
 */
export function Basic4Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Имитация окна предпросмотра слайсера: цвет линии показывает её тип — синие периметры, оранжевое заполнение, зелёные потолки и красные поддержки под нависающей полкой детали. В панели предпросмотра время печати 3 ч 12 мин, расход пластика 78 г и 640 слоёв"
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
          Предпросмотр: цвета по типу линии
        </text>

        {/* Окно предпросмотра: стол, деталь и поддержки под полкой */}
        <rect
          x={WINDOW_X}
          y={WINDOW_TOP}
          width={WINDOW_W}
          height={WINDOW_H}
          rx="10"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="20" y="38" fontSize="10" fill="#64748b">
          предпросмотр
        </text>
        <line x1={WINDOW_X + 12} y1={BED_Y} x2={WINDOW_X + WINDOW_W - 12} y2={BED_Y} stroke="#475569" />

        {/* Деталь: заливка корпуса, затем синий контур периметров */}
        <path d={PART_PATH} fill="#334155" />
        {SUPPORT_LINES.map((x) => (
          <line
            key={`support-${x}`}
            x1={x}
            y1={SUPPORT_TOP + 4}
            x2={x}
            y2={BED_Y - 2}
            stroke={SUPPORT}
            strokeOpacity="0.5"
          />
        ))}
        <rect
          x="82"
          y={SUPPORT_TOP}
          width="74"
          height={BED_Y - SUPPORT_TOP}
          rx="2"
          fill={SUPPORT}
          fillOpacity="0.12"
          stroke={SUPPORT}
          strokeOpacity="0.8"
          strokeDasharray="4 3"
        />
        {INFILL_LINES.map((y) => (
          <path
            key={`infill-${y}`}
            d={`M38 ${y} q 5.3 -5 10.7 0 q 5.3 5 10.6 0 q 5.3 -5 10.6 0`}
            fill="none"
            stroke={INFILL}
            strokeOpacity="0.8"
          />
        ))}
        {TOP_LINES.map((y) => (
          <line key={`top-${y}`} x1="36" y1={y} x2="162" y2={y} stroke={TOP_LAYER} strokeOpacity="0.9" />
        ))}
        <path d={PART_PATH} fill="none" stroke={PERIMETER} strokeWidth="1.6" />

        {/* Легенда: образец линии и её название */}
        <text x={LEGEND_X} y="38" fontSize="10" fill="#94a3b8">
          тип линии
        </text>
        {LEGEND.map((row, index) => (
          <g key={row.name}>
            <line
              x1={LEGEND_X}
              y1={LEGEND_ROW_Y[index] - 4}
              x2={LEGEND_X + 22}
              y2={LEGEND_ROW_Y[index] - 4}
              stroke={row.color}
              strokeWidth={row.width}
              strokeDasharray={row.dash}
            />
            <text x={LEGEND_X + 28} y={LEGEND_ROW_Y[index]} fontSize="10" fill="#cbd5e1">
              {row.name}
            </text>
          </g>
        ))}

        {/* Панель предпросмотра: время, пластик и число слоёв */}
        <rect x="12" y="154" width="296" height="18" rx="6" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        {PANEL.map((item) => (
          <g key={item.label}>
            <text x={item.labelX} y="167" fontSize="10" fill="#94a3b8">
              {item.label}
            </text>
            <text x={item.valueX} y="167" fontSize="10" fill="#e2e8f0">
              {item.value}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
