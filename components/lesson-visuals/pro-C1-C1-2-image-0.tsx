import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Точки обслуживания из content урока: «Схема принтера с отмеченными точками:
 * ремни, валы, винт Z, сопло, вентиляторы, разъёмы, стол».
 *
 * Тот же набор узлов, что в базовом уроке 14, поэтому оптика намеренно другая:
 * там принтер сбоку и шесть номерных меток с лупой, здесь — вид СВЕРХУ (в курсе
 * принтера в плане больше нет) и цвет метки означает периодичность: синяя —
 * каждая печать, янтарная — раз в месяц, серая — раз в год. Легенда справа
 * даёт время работ: «30 минут в месяц» из урока и 2 мин / 2 ч по частоте.
 *
 * Узлы читаются по силуэту (каретка с соплом и вентилятором, стол, ремни и валы
 * по бокам, винт Z в правом углу, разъёмы сзади, кабель-петля), а не по выноскам
 * — выноски и лупа остались у базового кадра.
 */
const EVERY_PRINT = "#60a5fa";
const MONTHLY = "#fbbf24";
const YEARLY = "#94a3b8";

/** Восемь меток: координаты из плана, цвет — периодичность работ. */
const MARKERS = [
  { id: "cables", cx: 58, cy: 32, r: 4.5, fill: YEARLY },
  { id: "connectors", cx: 170, cy: 37, r: 4.5, fill: YEARLY },
  { id: "nozzle", cx: 64, cy: 57, r: 5, fill: EVERY_PRINT },
  { id: "fan", cx: 86, cy: 57, r: 3.6, fill: MONTHLY },
  { id: "bed", cx: 120, cy: 108, r: 5, fill: EVERY_PRINT },
  { id: "belt", cx: 26.5, cy: 118, r: 5, fill: MONTHLY },
  { id: "rods", cx: 39, cy: 88, r: 5, fill: MONTHLY },
  { id: "screw", cx: 182, cy: 60, r: 5, fill: MONTHLY },
];

const PINS = [144, 152, 160];
const FAN_BLADES = [
  { x1: 86, y1: 57, x2: 86, y2: 48 },
  { x1: 86, y1: 57, x2: 86, y2: 66 },
  { x1: 86, y1: 57, x2: 77, y2: 57 },
  { x1: 86, y1: 57, x2: 95, y2: 57 },
];

/** «Карта ТО в плане» — где что проверять и как часто. */
export function ProC1C12Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Карта обслуживания: принтер видом сверху с восемью цветными метками на узлах — синие сопло и стол чистят каждую печать, янтарные ремни, валы, винт Z и вентилятор раз в месяц, серые разъёмы и кабели раз в год, справа легенда с временем работ"
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

        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          Карта ТО: принтер в плане
        </text>

        {/* Корпус принтера сверху */}
        <rect x="18" y="30" width="170" height="118" rx="8" fill="#0f172a" stroke="#475569" />

        {/* Кабель-петля сзади и разъёмы платы */}
        <path d="M46,38 q0,-10 12,-10 q12,0 12,10" fill="none" stroke="#64748b" />
        <rect x="138" y="32" width="40" height="10" rx="2" fill="#334155" stroke="#64748b" />
        {PINS.map((x) => (
          <rect key={`pin-${x}`} x={x} y="35" width="6" height="4" fill="#64748b" />
        ))}

        {/* Ремни по левому краю и валы рядом с ними */}
        <line x1="26.5" y1="42" x2="26.5" y2="138" stroke="#64748b" strokeDasharray="4 3" />
        <line x1="37" y1="42" x2="37" y2="138" stroke="#64748b" />
        <line x1="41" y1="42" x2="41" y2="138" stroke="#64748b" />

        {/* Портал Y и каретка с соплом и вентилятором обдува */}
        <rect x="44" y="48" width="118" height="10" rx="3" fill="#334155" />
        <rect x="52" y="44" width="46" height="26" rx="4" fill="#475569" stroke="#64748b" />
        {FAN_BLADES.map((blade) => (
          <line
            key={`blade-${blade.x2}-${blade.y2}`}
            x1={blade.x1}
            y1={blade.y1}
            x2={blade.x2}
            y2={blade.y2}
            stroke="#94a3b8"
          />
        ))}
        <circle cx="86" cy="57" r="9" fill="#1e293b" stroke="#94a3b8" />

        {/* Стол */}
        <rect x="76" y="84" width="88" height="48" rx="4" fill="#1e3a5f" stroke="#3b82f6" />

        {/* Винт Z в правом углу рамы */}
        <rect x="178" y="36" width="8" height="106" rx="3" fill="#334155" stroke="#64748b" />
        <polyline
          points="183,110 180,116 186,122 180,128 186,134"
          fill="none"
          stroke="#64748b"
        />

        {/* Метки: цвет = как часто проверять */}
        {MARKERS.map((marker) => (
          <circle
            key={marker.id}
            cx={marker.cx}
            cy={marker.cy}
            r={marker.r}
            fill={marker.fill}
          />
        ))}

        {/* Легенда частот с временем работ */}
        <text x="196" y="42" fontSize="9" fill="#94a3b8">
          периодичность
        </text>

        <circle cx="202" cy="58" r="5" fill={EVERY_PRINT} />
        <text x="212" y="60" fontSize="8.5" fill="#e2e8f0">
          каждая печать
        </text>
        <text x="212" y="74" fontSize="8" fill="#94a3b8">
          сопло, стол — 2 мин
        </text>

        <circle cx="202" cy="92" r="5" fill={MONTHLY} />
        <text x="212" y="94" fontSize="8.5" fill="#e2e8f0">
          раз в месяц
        </text>
        <text x="212" y="108" fontSize="8" fill="#94a3b8">
          ремни, валы, винт Z,
        </text>
        <text x="212" y="122" fontSize="8" fill="#94a3b8">
          вентиляторы — 30 мин
        </text>

        <circle cx="202" cy="138" r="5" fill={YEARLY} />
        <text x="212" y="140" fontSize="8.5" fill="#e2e8f0">
          раз в год
        </text>
        <text x="212" y="154" fontSize="8" fill="#94a3b8">
          разъёмы, кабели — 2 ч
        </text>

        <text x="12" y="172" fontSize="9" fill="#e2e8f0">
          30 минут в месяц: механика → смазка → электрика
        </text>
      </svg>
    </VisualWrapper>
  );
}
