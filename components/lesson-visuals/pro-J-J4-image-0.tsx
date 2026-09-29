import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Крупный план втулки-уголка: по ней и разложена карта напряжений. */
const PART = "40,48 66,48 66,102 180,102 180,128 40,128";

/** Зоны от максимума к минимуму: красная у корня полки, зелёная у свободного конца. */
const ZONES = [
  { points: "40,48 66,48 66,102 40,102", fill: "#38bdf8", opacity: 0.28 },
  { points: "66,102 106,102 106,128 66,128", fill: "#ef4444", opacity: 0.72 },
  { points: "106,102 134,102 134,128 106,128", fill: "#fb923c", opacity: 0.6 },
  { points: "134,102 158,102 158,128 134,128", fill: "#fbbf24", opacity: 0.5 },
  { points: "158,102 180,102 180,128 158,128", fill: "#34d399", opacity: 0.45 },
];

/** Врезка «что делать»: тот же уголок с ребром в углу. */
const INSET = { x: 196, y: 122, w: 112, h: 46 };
const INSET_WALL = { x: 206, y: 142, w: 8, h: 18 };
const INSET_ARM = { x: 206, y: 154, w: 62, h: 6 };
const INSET_RIB = "214,154 214,160 232,160";

/**
 * Результат расчёта, по контенту урока: «Скриншот: карта напряжений. Красная зона —
 * где сломается. Оптимизация: добавить ребро». В кадре одна деталь крупно: карта
 * напряжений от синего к красному, выноска «здесь сломается» в красную зону у корня
 * полки и врезка «добавить ребро» — тот же уголок с ребром в углу. Внизу оговорка из
 * важного урока: симуляция не учитывает анизотропию, запас ×2.
 *
 * От pro-J-J4-screenshot-0 отличается тем, что там весь расчёт целиком — крепление,
 * стрелка силы, шкала в МПа и зоны вдоль полки, — а здесь крупный план одной карты,
 * куда она ломается и что с этим делать: выноска и врезка с ребром.
 */
export function ProJJ4Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Карта напряжений крупным планом: уголок с зонами от синего на стойке к красному у корня полки, пунктирная выноска ведёт от подписи здесь сломается прямо в красную зону, справа врезка с тем же уголком, у которого в углу добавлено ребро, подпись добавить ребро; внизу подписи: симуляция не учитывает анизотропию, запас прочности ×2"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          карта напряжений: красная зона — где сломается
        </text>

        {/* Деталь крупно и карта напряжений на ней */}
        <polygon points={PART} fill="#334155" stroke="#64748b" />
        {ZONES.map((zone) => (
          <polygon key={zone.points} points={zone.points} fill={zone.fill} fillOpacity={zone.opacity} />
        ))}

        {/* Выноска в красную зону */}
        <line x1="114" y1="112" x2="185" y2="112" stroke="#f87171" strokeDasharray="4 3" />
        <text x="196" y="110" fontSize="9" fontWeight="bold" fill="#f87171">
          здесь сломается
        </text>

        {/* Врезка: то же место, но с ребром */}
        <rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} rx="6" fill="#0f172a" stroke="#34d399" />
        <text x="206" y="136" fontSize="9" fill="#6ee7b7">
          добавить ребро
        </text>
        <rect
          x={INSET_WALL.x}
          y={INSET_WALL.y}
          width={INSET_WALL.w}
          height={INSET_WALL.h}
          fill="#475569"
          stroke="#64748b"
        />
        <rect x={INSET_ARM.x} y={INSET_ARM.y} width={INSET_ARM.w} height={INSET_ARM.h} fill="#475569" stroke="#64748b" />
        <polygon points={INSET_RIB} fill="#34d399" fillOpacity="0.7" />

        <text x="12" y="150" fontSize="9" fill="#94a3b8">
          симуляция не учитывает анизотропию
        </text>
        <text x="12" y="168" fontSize="9" fill="#cbd5e1">
          запас прочности ×2
        </text>
      </svg>
    </VisualWrapper>
  );
}
