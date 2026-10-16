import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Комната: 12…188 и 20…120, стол на y=104, сопло на x=54. */
const ROOM_LEFT = 12;
const ROOM_RIGHT = 188;
const ROOM_TOP = 20;
const FLOOR_Y = 104;
const NOZZLE_X = 54;

/** Точки в воздухе: справа от зонта, в толще комнаты и у пола. */
const TOP_DOTS: [number, number][] = [
  [104, 40],
  [118, 36],
  [132, 42],
  [146, 38],
  [160, 42],
];
const MID_DOTS: [number, number][] = [
  [110, 50],
  [134, 56],
];
const FLOOR_DOTS: [number, number][] = [
  [60, 114],
  [92, 117],
  [124, 114],
  [156, 117],
];

const WHY = [
  "у сопла — максимум",
  "в метре — во много",
  "раз меньше",
  "висят часами —",
  "почти не оседают",
  "уходят с воздухом",
];

const NOTES = [
  "часть потока ловит вытяжка, остальное висит",
  "у пола вдобавок оседает пыль",
  "уходят только вместе с воздухом — вытяжка или створка",
];

/**
 * Кадр блока 8 урока C1 «Как частицы расходятся по комнате».
 *
 * Разрез комнаты: над соплом поднимается факел тёплого воздуха, часть потока
 * ловит вытяжка, остальное расходится под потолком и живёт в воздухе. Числа и
 * подписи — из блока 1 (у сопла частиц огромное число, в метре уже во много раз
 * меньше, висят они часами и почти не оседают под собственным весом, уходят
 * только вместе с воздухом) и блока 11 (у пола вдобавок оседает пыль).
 */
export function ConfidentC1Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Как частицы расходятся по комнате: разрез комнаты. Над соплом поднимается факел тёплого воздуха, его часть ловит вытяжка, остальное расходится под потолком. У сопла частиц максимум, в метре уже во много раз меньше; висят они часами и почти не оседают под собственным весом, а у пола вдобавок оседает пыль. Уходят частицы только вместе с воздухом — проветриванием или вытяжкой"
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
          Как частицы расходятся по комнате
        </text>

        {/* Комната: потолок, пол и стена с отводом на улицу */}
        <line x1={ROOM_LEFT} y1={ROOM_TOP} x2={ROOM_RIGHT} y2={ROOM_TOP} stroke="#475569" />
        <line x1={ROOM_RIGHT} y1={ROOM_TOP} x2={ROOM_RIGHT} y2="120" stroke="#475569" />
        <line x1={ROOM_LEFT} y1="120" x2={ROOM_RIGHT} y2="120" stroke="#475569" />
        <line x1="26" y1={FLOOR_Y} x2="86" y2={FLOOR_Y} stroke="#475569" />
        <line x1="30" y1={FLOOR_Y} x2="30" y2="118" stroke="#475569" strokeOpacity="0.7" />
        <line x1="82" y1={FLOOR_Y} x2="82" y2="118" stroke="#475569" strokeOpacity="0.7" />

        {/* Принтер и сопло */}
        <rect
          x="34"
          y="84"
          width="40"
          height="20"
          fill="#334155"
          fillOpacity="0.5"
          stroke="#475569"
        />
        <line x1="34" y1="90" x2="74" y2="90" stroke="#64748b" strokeOpacity="0.8" />
        <path
          d={`M${NOZZLE_X - 5} ${FLOOR_Y} L${NOZZLE_X + 5} ${FLOOR_Y} L${NOZZLE_X} ${FLOOR_Y + 7} Z`}
          fill="#f59e0b"
          fillOpacity="0.8"
        />

        {/* Факел тёплого воздуха: от сопла вверх, прямо в зонт вытяжки */}
        <path
          d="M50 108 C42 98 58 90 52 80 C44 70 60 64 54 54 C48 44 58 38 54 30"
          fill="none"
          stroke="#f59e0b"
          strokeOpacity="0.55"
          strokeWidth="1.2"
        />
        <path
          d="M62 108 C70 98 54 90 62 80 C70 70 54 64 62 54 C70 44 58 38 62 30"
          fill="none"
          stroke="#f59e0b"
          strokeOpacity="0.35"
        />

        {/* Частицы: под потолком, в толще комнаты и у пола */}
        {TOP_DOTS.map(([x, y]) => (
          <circle key={`top-${x}`} cx={x} cy={y} r="1.8" fill="#3b82f6" fillOpacity="0.85" />
        ))}
        {MID_DOTS.map(([x, y]) => (
          <circle key={`mid-${x}`} cx={x} cy={y} r="1.6" fill="#3b82f6" fillOpacity="0.6" />
        ))}
        {FLOOR_DOTS.map(([x, y]) => (
          <circle key={`floor-${x}`} cx={x} cy={y} r="1.8" fill="#f87171" fillOpacity="0.7" />
        ))}

        {/* Вытяжка прямо над принтером: зонт и отвод через стену */}
        <path d="M40 24 L46 34 L92 34 L98 24 Z" fill="#334155" fillOpacity="0.5" stroke="#475569" />
        <rect x="98" y="26" width="90" height="6" fill="#334155" fillOpacity="0.5" stroke="#475569" />
        <text x="124" y="55" fontSize="10" fill="#10b981" textAnchor="middle">
          вытяжка на улицу
        </text>
        <text x="76" y="66" fontSize="10" fill="#94a3b8">
          факел тёплого
        </text>
        <text x="76" y="77" fontSize="10" fill="#94a3b8">
          воздуха вверх
        </text>

        {/* Почему у сопла частиц больше всего */}
        <rect
          x="196"
          y="20"
          width="112"
          height="100"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="204" y="32" fontSize="10" fontWeight="700" fill="#e2e8f0">
          почему так
        </text>
        {WHY.map((line, index) => (
          <text key={line} x="204" y={46 + index * 12} fontSize="10" fill="#94a3b8">
            {line}
          </text>
        ))}

        {/* Что с частицами дальше */}
        <rect
          x="12"
          y="128"
          width="296"
          height="42"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="22"
            y={141 + index * 12}
            fontSize="10"
            fontWeight={index === 0 ? "700" : "400"}
            fill={index === 0 ? "#e2e8f0" : "#94a3b8"}
          >
            {note}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
