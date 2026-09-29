import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Уголок под нагрузкой: стойка слева, полка справа. Тело серое — цвет несёт карта. */
const PART = "64,64 94,64 94,96 178,96 178,110 64,110";

/** Зоны карты напряжений: красный — максимум у корня полки, синий — покой на стойке. */
const ZONES = [
  { points: "64,64 94,64 94,96 64,96", fill: "#38bdf8", opacity: 0.3 },
  { points: "94,96 120,96 120,110 94,110", fill: "#ef4444", opacity: 0.75 },
  { points: "120,96 144,96 144,110 120,110", fill: "#fb923c", opacity: 0.6 },
  { points: "144,96 162,96 162,110 144,110", fill: "#fbbf24", opacity: 0.5 },
  { points: "162,96 178,96 178,110 162,110", fill: "#34d399", opacity: 0.45 },
];

/** Штриховка крепления на левой кромке стойки: по этой грани деталь закреплена. */
const FIXED_EDGE = { x: 56, y1: 68, y2: 106 };
const FIXED_HATCH = [72, 80, 88, 96, 104];

/** Легенда: вертикальная шкала от 0 до 50 МПа, красный — вверху, за ним максимум. */
const LEGEND = { x: 288, y: 50, w: 14, h: 90 };
const LEGEND_TICKS = [
  { label: "50", y: 56 },
  { label: "25", y: 98 },
  { label: "0", y: 140 },
];

/**
 * Симуляция в Fusion, по контенту урока: «Скриншот: модель, крепления, нагрузка.
 * Результат: цветная карта напряжений (красный — максимум)» и по шагам урока:
 * материал, крепления (fixed), нагрузка, запуск. В кадре сам расчёт без окон
 * программы: серый уголок, на левой кромке штриховка крепления, у свободного конца
 * стрелка силы «50 Н», по полке радуга зон от синего к красному, выноска к красной
 * зоне «максимум», пунктир увеличенной деформации и справа шкала в МПа.
 *
 * От окон программ в модулях F и U отличается тем, что там интерфейс с панелями и
 * списками, а здесь только модель и результат расчёта. От pro-J-J4-image-0 — тем,
 * что там крупно одна карта с выноской и врезкой «добавить ребро», а здесь весь
 * расчёт целиком: крепление, сила, шкала и зоны вдоль всей полки.
 */
export function ProJJ4Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Результат статического расчёта: серый уголок с закреплённой левой кромкой и стрелкой силы 50 ньютонов у свободного конца, по полке карта напряжений из зон от синего до красного, выноска максимум указывает на красную зону у корня полки, пунктир показывает увеличенную деформацию, справа шкала напряжений в мегапаскалях от 0 до 50, внизу подписи: расчёт до печати экономит пластик, деформация увеличена"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <linearGradient id="v-jj4s-stress" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#38bdf8" />
            <stop offset="0.35" stopColor="#34d399" />
            <stop offset="0.7" stopColor="#fbbf24" />
            <stop offset="1" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          симуляция: крепления, нагрузка, напряжения
        </text>
        <text x="234" y="38" fontSize="8.5" fill="#94a3b8">
          напряжение, МПа
        </text>

        {/* Модель и карта напряжений */}
        <polygon points={PART} fill="#334155" stroke="#64748b" />
        {ZONES.map((zone) => (
          <polygon key={zone.points} points={zone.points} fill={zone.fill} fillOpacity={zone.opacity} />
        ))}

        {/* Крепление: штриховка по левой кромке стойки */}
        <line x1={FIXED_EDGE.x} y1={FIXED_EDGE.y1} x2={FIXED_EDGE.x} y2={FIXED_EDGE.y2} stroke="#94a3b8" />
        {FIXED_HATCH.map((y) => (
          <line key={`fixed-${y}`} x1={FIXED_EDGE.x} y1={y} x2={FIXED_EDGE.x - 6} y2={y} stroke="#94a3b8" strokeOpacity="0.8" />
        ))}
        <text x="12" y="52" fontSize="9" fill="#cbd5e1">
          крепление
        </text>

        {/* Выноска к красной зоне — там максимум напряжения */}
        <line x1="107" y1="62" x2="107" y2="94" stroke="#f87171" />
        <text x="86" y="46" fontSize="9" fontWeight="bold" fill="#f87171">
          максимум
        </text>

        {/* Нагрузка на свободном конце */}
        <line x1="170" y1="86" x2="170" y2="92" stroke="#94a3b8" strokeWidth="1.4" />
        <polygon points="166,92 174,92 170,96" fill="#94a3b8" />
        <text x="188" y="88" fontSize="9" fill="#e2e8f0">
          50 Н
        </text>

        {/* Увеличенная деформация: пунктирный прогиб полки */}
        <path
          d="M178,114 Q150,126 118,116"
          fill="none"
          stroke="#facc15"
          strokeWidth="1.2"
          strokeDasharray="4 3"
          strokeOpacity="0.85"
        />
        <text x="120" y="145" fontSize="8.5" fill="#facc15">
          деформация увеличена
        </text>
        <text x="12" y="163" fontSize="8.5" fill="#94a3b8">
          расчёт до печати экономит пластик
        </text>

        {/* Шкала напряжений */}
        <rect x={LEGEND.x} y={LEGEND.y} width={LEGEND.w} height={LEGEND.h} fill="url(#v-jj4s-stress)" stroke="#475569" />
        {LEGEND_TICKS.map((tick) => (
          <text key={tick.label} x="278" y={tick.y} fontSize="8.5" fill="#cbd5e1" textAnchor="end">
            {tick.label}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
