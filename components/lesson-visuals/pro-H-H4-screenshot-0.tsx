import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Углы верхней грани плиты в изометрии: A — левый, B — верхний, C — правый, D — нижний. */
const A = { x: 50, y: 60 };
const B = { x: 112, y: 40 };
const C = { x: 152, y: 62 };
const D = { x: 90, y: 82 };
const THICKNESS = 22;

/** Плоская зона: ровный участок, толстый слой 0,28 мм. */
const smoothZone = "71.7,68.7 99,59.9 117,69.8 89.7,78.6";

/** Зона деталировки: мелкие детали, тонкий слой 0,12 мм. */
const detailZone = "88.1,51.2 112.3,43.4 126.3,51.1 102.1,58.9";

/** Строки панели: параметр Adaptive и его значения. */
const panelRows = [
  { y: 96, label: "Smooth", value: "0,28 мм" },
  { y: 118, label: "Detail", value: "0,12 мм" },
];

/**
 * Variable Layer Height — оптика «изометрия»: плита показана объёмно, на её
 * верхней грани подсвечены две зоны — ровный участок с толстым слоем 0,28 мм и
 * деталировка с тонким 0,12 мм, справа узкая панель Variable layer height из
 * двух строк и плашка про экономию времени.
 *
 * Ровно по content урока: «Скриншот Orca: модель с разной высотой слоя. На
 * ровных участках — 0,28 мм, на деталях — 0,12 мм» и по тексту «Экономия
 * времени 30% при том же качестве».
 *
 * От «Layer height» в модуле G отличается ракурсом: там разрез по Z полосой
 * слоёв с метками высот и ползунком, здесь объёмная плита, зоны на её верхней
 * грани и две строки настроек — никакого разреза и ползунка.
 */
export function ProHH4Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Variable Layer Height: объёмная плита, на верхней грани подсвечены две зоны — ровный участок с толстым слоем 0,28 мм и деталировка с тонким слоем 0,12 мм, справа панель Variable layer height со строками Smooth 0,28 и Detail 0,12 и включённым Adaptive, экономия времени 30 процентов"
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
          изометрия детали: зоны высоты слоя
        </text>

        <rect x="236" y="26" width="72" height="20" rx="4" fill="#0f172a" stroke="#475569" />
        <text x="272" y="39" fontSize="9" fill="#6ee7b7" textAnchor="middle">
          −30% времени
        </text>

        {/* Плита в изометрии: верхняя грань, левая и правая боковины */}
        <polygon
          points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y} ${D.x},${D.y}`}
          fill="#475569"
          stroke="#94a3b8"
        />
        <polygon
          points={`${A.x},${A.y} ${D.x},${D.y} ${D.x},${D.y + THICKNESS} ${A.x},${A.y + THICKNESS}`}
          fill="#334155"
          stroke="#64748b"
        />
        <polygon
          points={`${D.x},${D.y} ${C.x},${C.y} ${C.x},${C.y + THICKNESS} ${D.x},${D.y + THICKNESS}`}
          fill="#1e293b"
          stroke="#64748b"
        />

        {/* Две зоны-подсветки на верхней грани */}
        <polygon points={smoothZone} fill="#fbbf24" fillOpacity="0.22" stroke="#fbbf24" />
        <polygon points={detailZone} fill="#7dd3fc" fillOpacity="0.22" stroke="#7dd3fc" />
        <ellipse cx="106" cy="53" rx="4" ry="2" fill="#7dd3fc" fillOpacity="0.5" />
        <ellipse cx="114" cy="48.5" rx="3" ry="1.6" fill="#7dd3fc" fillOpacity="0.5" />

        {/* Маркеры высот под плитой */}
        <rect x="12" y="122" width="8" height="8" fill="#fbbf24" />
        <text x="26" y="130" fontSize="9" fill="#fbbf24">
          0,28 мм — ровные участки
        </text>

        <rect x="12" y="144" width="8" height="8" fill="#7dd3fc" />
        <text x="26" y="152" fontSize="9" fill="#7dd3fc">
          0,12 мм — мелкие детали
        </text>

        <text x="12" y="172" fontSize="9" fill="#94a3b8">
          ровные участки — быстрее, детали — точнее
        </text>

        {/* Панель Variable layer height */}
        <rect x="168" y="56" width="140" height="92" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="176" y="72" fontSize="9" fontWeight="bold" fill="#93c5fd">
          Variable layer height
        </text>
        {panelRows.map((row) => (
          <g key={`panel-${row.label}`}>
            <text x="176" y={row.y} fontSize="10" fill="#94a3b8">
              {row.label}
            </text>
            <text x="300" y={row.y} fontSize="10" fill="#e2e8f0" textAnchor="end">
              {row.value}
            </text>
          </g>
        ))}
        <text x="176" y="140" fontSize="9" fill="#6ee7b7">
          Adaptive — включён
        </text>
      </svg>
    </VisualWrapper>
  );
}
