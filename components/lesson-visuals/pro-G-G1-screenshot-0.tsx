import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Слои модели в разрезе: сверху тонкие (0,1 мм) для деталей, ниже средние
 * (0,2 мм), внизу толстые (0,3 мм) на ровных участках.
 */
const modelLayers = [
  ...Array.from({ length: 6 }, (_, index) => ({ y: 54 + index * 3, height: 2.6, tone: "#7dd3fc" })),
  ...Array.from({ length: 4 }, (_, index) => ({ y: 72 + index * 5, height: 4.6, tone: "#94a3b8" })),
  ...Array.from({ length: 4 }, (_, index) => ({ y: 92 + index * 8, height: 7.6, tone: "#fbbf24" })),
];

/** Выноски высот слоя: подпись, уровень и цвет. */
const heightMarks = [
  { y: 62, label: "0,1", tone: "#7dd3fc" },
  { y: 84, label: "0,2", tone: "#cbd5e1" },
  { y: 110, label: "0,3", tone: "#fbbf24" },
];

/**
 * Variable Layer Height в слайсере — оптика «разрез по Z»: модель показана
 * колонкой слоёв разной толщины с подписями 0,1 / 0,2 / 0,3 мм, а справа узкая
 * панель Layer height с ползунком диапазона и включённым Adaptive.
 *
 * Ровно по content урока: «Скриншот: от 0,1 до 0,3 мм. Adaptive — слайсер сам
 * определяет» и по совету «начни с Variable Layer Height».
 *
 * От схем интерфейсов в других уроках отличается оптикой: там общий вид окна с
 * панелями и кнопкой «Нарезать», здесь разрез по Z с числовыми метками высот и
 * одна узкая панель — не полное окно. От «Как создаётся рельеф» в этом же уроке
 * тем, что там две стенки сравниваются, а здесь одна модель и настройка.
 */
export function ProGG1Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Variable Layer Height в слайсере: модель в разрезе по Z из слоёв разной толщины с метками 0,1, 0,2 и 0,3 мм, справа панель Layer height с ползунком от 0,1 до 0,3 мм и включённым режимом Adaptive, который сам распределяет высоты"
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

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          разрез по Z: высота слоя 0,1–0,3 мм
        </text>

        {modelLayers.map((layer) => (
          <rect
            key={`layer-${layer.y}`}
            x="30"
            y={layer.y}
            width="56"
            height={layer.height}
            fill="#334155"
            stroke={layer.tone}
            strokeOpacity="0.8"
          />
        ))}

        {heightMarks.map((mark) => (
          <g key={`mark-${mark.label}`}>
            <line
              x1="86"
              y1={mark.y - 2}
              x2="92"
              y2={mark.y - 2}
              stroke={mark.tone}
              strokeOpacity="0.8"
            />
            <text x="96" y={mark.y} fontSize="9" fill={mark.tone}>
              {mark.label}
            </text>
          </g>
        ))}

        <rect x="168" y="44" width="140" height="88" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="176" y="62" fontSize="10" fontWeight="bold" fill="#93c5fd">
          Layer height
        </text>
        <line x1="182" y1="84" x2="294" y2="84" stroke="#475569" strokeWidth="3" />
        <line x1="182" y1="84" x2="250" y2="84" stroke="#38bdf8" strokeWidth="3" />
        <circle cx="250" cy="84" r="5" fill="#38bdf8" />
        <text x="182" y="106" fontSize="9" fill="#94a3b8">
          0,1 мм
        </text>
        <text x="294" y="106" fontSize="9" fill="#94a3b8" textAnchor="end">
          0,3 мм
        </text>
        <text x="176" y="124" fontSize="9" fill="#6ee7b7">
          Adaptive — включён
        </text>

        <text x="12" y="152" fontSize="10" fill="#e2e8f0">
          высота слоя: 0,1 — детали, 0,3 — ровные участки
        </text>
        <text x="12" y="168" fontSize="9" fill="#94a3b8">
          Adaptive — слайсер сам распределяет высоты
        </text>
      </svg>
    </VisualWrapper>
  );
}
