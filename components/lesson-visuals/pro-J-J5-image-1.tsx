import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Шестерня: тело, двенадцать зубьев, ступица с отверстием. */
const GEAR = { cx: 96, cy: 86, body: 26, teeth: 32, hub: 8, bore: 4 };

const TOOTH_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

/** Слои идут вдоль оси: горизонтальные линии внутри тела, как слои на боку диска. */
const LAYERS = [68, 74, 80, 92, 98, 104];

/** Ось вращения — та же горизонталь, что и слои: поэтому ориентация и прочная. */
const AXIS = { x1: 56, x2: 136, y: 86 };

/** Сжатие: стрелки сверху и снизу давят на зубья. */
const PUSH_TOP = { x: 96, y1: 42, y2: 50, arrow: "92,50 100,50 96,56" };
const PUSH_BOTTOM = { x: 96, y1: 132, y2: 124, arrow: "92,124 100,124 96,118" };

/**
 * Шестерня, по контенту урока: «Фото: шестерня. Схема нагрузки. Параметры» и по
 * тексту блока: «Нагрузка на сжатие и кручение. Ориентация: слои вдоль оси.
 * Заполнение 60 % Cubic. 4 стенки. Материал: POM или PA. Для тихоходных — PLA».
 * В кадре колесо с двенадцатью зубьями: внутри тела линии слоёв, через центр —
 * ось, сверху и снизу стрелки сжатия, справа дуговая стрелка кручения; справа
 * список параметров, внизу строка про материал.
 *
 * От pro-J-J5-image-0 отличается деталью и нагрузкой: там кронштейн на разрыв и
 * изгиб, здесь колесо на сжатие и кручение. От pro-J-J2-image-1 — тем, что там
 * колесо показано только внешним видом, без оси, слоёв и чисел.
 */
export function ProJJ5Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Шестерня под нагрузкой: колесо с двенадцатью зубьями и ступицей, внутри тела горизонтальные линии слоёв вдоль оси, через центр проходит ось, сверху и снизу стрелки сжатия, справа дуговая стрелка кручения; в правой колонке параметры: ориентация слои вдоль оси, заполнение 60 процентов Cubic, 4 стенки; внизу материал POM или PA, тихоходным PLA"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          шестерня: сжатие и кручение
        </text>

        {/* Деталь: колесо, ось и слои вдоль неё */}
        <rect x="12" y="26" width="180" height="110" rx="8" fill="#0f172a" stroke="#475569" />
        <line x1={AXIS.x1} y1={AXIS.y} x2={AXIS.x2} y2={AXIS.y} stroke="#94a3b8" strokeDasharray="5 4" />
        <text x="30" y="90" fontSize="9" fill="#cbd5e1">
          ось
        </text>
        {TOOTH_ANGLES.map((angle) => (
          <rect
            key={`tooth-${angle}`}
            x={GEAR.cx + GEAR.body}
            y={GEAR.cy - 3}
            width={GEAR.teeth - GEAR.body}
            height="6"
            rx="1"
            fill="#64748b"
            transform={`rotate(${angle} ${GEAR.cx} ${GEAR.cy})`}
          />
        ))}
        <circle cx={GEAR.cx} cy={GEAR.cy} r={GEAR.body} fill="#475569" stroke="#64748b" />
        {LAYERS.map((y) => (
          <line
            key={`layer-${y}`}
            x1={GEAR.cx - 16}
            y1={y}
            x2={GEAR.cx + 16}
            y2={y}
            stroke="#38bdf8"
            strokeOpacity="0.5"
          />
        ))}
        <circle cx={GEAR.cx} cy={GEAR.cy} r={GEAR.hub} fill="#64748b" />
        <circle cx={GEAR.cx} cy={GEAR.cy} r={GEAR.bore} fill="#0f172a" />

        {/* Нагрузка: сжатие сверху и снизу, кручение вокруг оси */}
        <line x1={PUSH_TOP.x} y1={PUSH_TOP.y1} x2={PUSH_TOP.x} y2={PUSH_TOP.y2} stroke="#f87171" strokeWidth="1.5" />
        <polygon points={PUSH_TOP.arrow} fill="#f87171" />
        <line
          x1={PUSH_BOTTOM.x}
          y1={PUSH_BOTTOM.y1}
          x2={PUSH_BOTTOM.x}
          y2={PUSH_BOTTOM.y2}
          stroke="#f87171"
          strokeWidth="1.5"
        />
        <polygon points={PUSH_BOTTOM.arrow} fill="#f87171" />
        <text x="52" y="46" fontSize="9" fill="#f87171">
          сжатие
        </text>
        <path d="M126,72 Q146,86 126,100" fill="none" stroke="#c4b5fd" strokeWidth="1.4" />
        <polygon points="126,100 134,94 136,103" fill="#c4b5fd" />
        <text x="126" y="60" fontSize="9" fill="#c4b5fd">
          кручение
        </text>

        {/* Параметры печати из текста блока */}
        <rect x="202" y="26" width="106" height="114" rx="8" fill="#0f172a" stroke="#475569" />
        <text x="210" y="52" fontSize="8.5" fill="#94a3b8">
          ориентация
        </text>
        <text x="210" y="69" fontSize="9" fill="#e2e8f0">
          слои вдоль оси
        </text>
        <text x="210" y="90" fontSize="8.5" fill="#94a3b8">
          заполнение
        </text>
        <text x="210" y="107" fontSize="9" fill="#e2e8f0">
          60 % Cubic
        </text>
        <text x="210" y="128" fontSize="9" fill="#e2e8f0">
          4 стенки
        </text>

        <text x="12" y="160" fontSize="10" fill="#e2e8f0">
          материал: POM или PA, тихоходным — PLA
        </text>
      </svg>
    </VisualWrapper>
  );
}
