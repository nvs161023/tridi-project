import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Волна уровня жидкости в ванне: полилиния по ширине камеры. */
const LIQUID_LINE = [
  [38, 62],
  [58, 60],
  [78, 63],
  [98, 60],
  [118, 62],
  [138, 60],
  [158, 63],
  [182, 61],
];

/** Пьезо-излучатели на дне: центры и радиус. */
const EMITTERS = [
  { cx: 100, cy: 132 },
  { cx: 124, cy: 132 },
  { cx: 148, cy: 132 },
];

/** Прутья корзины: вертикальные линии. */
const BASKET_BARS = [96, 110, 124, 138];

/**
 * Ультразвуковая ванна в разрезе: корпус с уровнем жидкости, внутри корзина с
 * соплом и SLA-моделью, на дне пьезо-излучатели, справа панель с таймером и
 * нагревом, внизу перечёркнутая плата.
 *
 * Ровно по content урока: «Фото: ванна с соплами и моделями внутри», по list —
 * «Сопла от нагара, SLA-модели от смолы, инструменты от пластика, форсунки,
 * вентиляторы, металлические детали», по tip — «ванна 600–800 мл» и по warning —
 * «Не чисти электронику. Ультразвук разрушает пайку».
 *
 * От E-хим2 (маршруты утилизации отходов и тара) отличается предметом: там
 * канистры и стрелки маршрутов, здесь разрез прибора с пьезо-излучателями и
 * корзиной. Кадров-разрезов устройства в курсе ещё не было.
 */
export function ProMM5Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Ультразвуковая ванна в разрезе: корпус с уровнем жидкости, внутри корзина с соплом и SLA-моделью, на дне пьезо-излучатели, справа панель с таймером 3 минуты и 40 градусов, внизу перечёркнутая электронная плата с подписью, что чистить её нельзя"
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
          Ультразвуковая ванна: разрез
        </text>

        {/* Камера ванны: жидкость, стенки и дно */}
        <rect x="28" y="42" width="164" height="94" rx="4" fill="#1e3a5f" />
        <rect x="28" y="42" width="10" height="94" fill="#475569" />
        <rect x="182" y="42" width="10" height="94" fill="#475569" />
        <rect x="28" y="126" width="164" height="10" fill="#475569" />
        <polyline
          points={LIQUID_LINE.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="1.4"
        />

        {/* Корзина с деталями: сопло и SLA-модель */}
        <rect x="86" y="80" width="72" height="44" rx="3" fill="#1e3a5f" stroke="#64748b" />
        {BASKET_BARS.map((x) => (
          <line key={`bar-${x}`} x1={x} y1="84" x2={x} y2="120" stroke="#64748b" strokeWidth="0.9" />
        ))}
        <polygon
          points="98,112 110,112 110,108 106,108 106,100 102,100 102,108 98,108"
          fill="#94a3b8"
        />
        <rect x="124" y="104" width="12" height="8" fill="#94a3b8" />
        <polygon points="124,104 130,98 136,104" fill="#94a3b8" />

        {/* Пьезо-излучатели на дне */}
        {EMITTERS.map(({ cx, cy }) => (
          <circle
            key={`emitter-${cx}`}
            cx={cx}
            cy={cy}
            r="5"
            fill="#1e3a5f"
            stroke="#38bdf8"
            strokeWidth="1.2"
          />
        ))}

        {/* Выноски частей: от корзины и от излучателей вниз-влево */}
        <line x1="122" y1="124" x2="108" y2="142" stroke="#64748b" strokeWidth="1" />
        <line x1="100" y1="134" x2="92" y2="158" stroke="#64748b" strokeWidth="1" />

        <text x="40" y="78" fontSize="7.5" fill="#e2e8f0">
          жидкость
        </text>
        <text x="12" y="152" fontSize="7.5" fill="#e2e8f0">
          корзина с деталями
        </text>
        <text x="12" y="166" fontSize="7.5" fill="#94a3b8">
          излучатели на дне
        </text>


        {/* Панель: таймер и нагрев */}
        <rect x="204" y="38" width="100" height="66" rx="4" fill="#0f172a" />
        <text x="214" y="62" fontSize="14" fill="#7dd3fc">
          3 мин
        </text>
        <text x="214" y="84" fontSize="14" fill="#7dd3fc">
          40 °C
        </text>
        <text x="214" y="98" fontSize="7.5" fill="#94a3b8">
          таймер и нагрев
        </text>

        {/* Перечёркнутая плата: электронику чистить нельзя */}
        <rect x="204" y="112" width="88" height="28" rx="3" fill="#334155" stroke="#475569" />
        <rect x="212" y="118" width="16" height="10" rx="2" fill="#475569" />
        <rect x="234" y="118" width="10" height="16" rx="2" fill="#475569" />
        <rect x="252" y="120" width="20" height="8" rx="2" fill="#475569" />
        <line x1="210" y1="116" x2="286" y2="136" stroke="#ef4444" strokeWidth="2" />
        <line x1="210" y1="136" x2="286" y2="116" stroke="#ef4444" strokeWidth="2" />

        <text x="204" y="158" fontSize="7.5" fill="#f87171">
          не чисти электронику
        </text>
        <text x="204" y="172" fontSize="7.5" fill="#94a3b8">
          ультразвук разрушает пайку
        </text>
      </svg>
    </VisualWrapper>
  );
}
