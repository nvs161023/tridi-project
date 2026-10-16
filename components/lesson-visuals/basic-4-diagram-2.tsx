import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Два режима различаются цветом: прямой тракт — синий, длинный — оранжевый. */
const DIRECT = "#3b82f6";
const BOWDEN = "#f59e0b";

/** Механика кадра: путь пластика, давление в сопле; паутина — дефект. */
const RETRACT = "#3b82f6";
const PRESSURE = "#f59e0b";
const STRINGING = "#f87171";

/** Панель схемы 12…168 и две полосы режимов 176…308. */
const LEFT_X = 12;
const LEFT_W = 156;
const RIGHT_X = 176;
const RIGHT_W = 132;
const PANEL_TOP = 24;
const PANEL_H = 120;
const MODE_H = 52;
const MODE_STEP = 64;

/** Стол на 140, две детали на нём и зазор 98…126 для холостого хода. */
const BED_Y = 140;
const PARTS_TOP = 104;
const PART_W = 34;
const LEFT_PART_X = 64;
const RIGHT_PART_X = 126;

/** Сопло по центру зазора: блок нагревателя 98…126, конус и путь пластика. */
const NOZZLE_X = 112;
const BLOCK_TOP = 46;
const BLOCK_BOTTOM = 68;
const TIP_Y = 88;
const FILAMENT_TOP = 50;
const ARROW_TIP_Y = 22;

/** Паутина между деталями: четыре нити с разным провисом. */
const STRINGS: string[] = [
  "M98 106 q 7 8 14 0 q 7 -8 14 0",
  "M98 110 q 7 10 14 0 q 7 -10 14 0",
  "M98 114 q 7 6 14 0 q 7 -6 14 0",
  "M98 118 q 7 9 14 0 q 7 -9 14 0",
];

/** Подписи внутри схемы: текст, выноска к узлу и цвет подписи. */
const CALLOUTS: { label: string; x: number; y: number; line?: [number, number, number]; color: string }[] = [
  { label: "откат", x: 22, y: 36, line: [50, 104, 33], color: RETRACT },
  { label: "давление", x: 22, y: 62, line: [70, 96, 59], color: PRESSURE },
  { label: "сопло", x: 22, y: 92, line: [52, 100, 89], color: "#94a3b8" },
  { label: "паутина", x: 22, y: 116, color: STRINGING },
];

/** Два режима ровно по подписи блока 22: Direct 0,8-1,2 мм, Bowden 4-7 мм. */
const MODES: { name: string; color: string; value: string; note: string }[] = [
  { name: "Direct", color: DIRECT, value: "0,8–1,2 мм", note: "экструдер над соплом" },
  { name: "Bowden", color: BOWDEN, value: "4–7 мм", note: "экструдер на раме" },
];

/**
 * Кадр блока 22 урока L4 «Ретракт: откат, подъём и паутина».
 *
 * Слева схема механизма: сопло по центру зазора, две детали на столе, между ними
 * паутина. В сопле откат показан как путь пластика: пунктир идёт вниз до самого
 * конуса, а синяя стрелка уходит вверх — нить втягивают назад. Два оранжевых
 * стрелки внутри блока — давление расплава, из которого и берётся самотёк.
 *
 * Справа два режима ровно по подписи блока 22: Direct — 0,8-1,2 мм, Bowden —
 * 4-7 мм. В сноске три числа из блока 21: трубка длинного тракта 30-50 см,
 * скорость отката 25-45 мм/с и подъём по Z (z-hop) 0,2-0,4 мм. Подъём по Z
 * снят со схемы, но стоит в сноске, потому что он есть в заголовке блока:
 * сопло приподнимается на переезде и не тянет нить за собой.
 *
 * Паутина нарисована красным как дефект. В кадре нет поддержек, поэтому с
 * красным цветом поддержек из кадра предпросмотра он не спорит.
 */
export function Basic4Diagram2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Схема ретракта: в сопле расплав под давлением, нить втягивается назад откатом, между двумя деталями остаётся паутина. Для прямого тракта Direct хватает отката 0,8-1,2 мм, для длинного тракта Bowden нужно 4-7 мм: пластик идёт по трубке 30-50 см, скорость отката 25-45 мм в секунду, подъём по Z z-hop 0,2-0,4 мм"
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
          Ретракт: откат, подъём и паутина
        </text>

        {/* Схема слева: стол, две детали, сопло и паутина между деталями */}
        <rect
          x={LEFT_X}
          y={PANEL_TOP}
          width={LEFT_W}
          height={PANEL_H}
          rx="10"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <line x1="20" y1={BED_Y} x2="164" y2={BED_Y} stroke="#475569" strokeWidth="1.5" />
        <rect x={LEFT_PART_X} y={PARTS_TOP} width={PART_W} height={BED_Y - PARTS_TOP} fill="#334155" stroke={DIRECT} />
        <rect x={RIGHT_PART_X} y={PARTS_TOP} width={PART_W} height={BED_Y - PARTS_TOP} fill="#334155" stroke={DIRECT} />

        {STRINGS.map((d) => (
          <path key={d} d={d} fill="none" stroke={STRINGING} strokeOpacity="0.85" />
        ))}

        {/* Сопло: блок нагревателя, конус, путь пластика и стрелка отката */}
        <rect x={NOZZLE_X - 14} y={BLOCK_TOP} width="28" height={BLOCK_BOTTOM - BLOCK_TOP} rx="2" fill="#334155" stroke="#475569" />
        <polygon
          points={`${NOZZLE_X - 10},${BLOCK_BOTTOM} ${NOZZLE_X + 10},${BLOCK_BOTTOM} ${NOZZLE_X + 6},${TIP_Y} ${NOZZLE_X - 6},${TIP_Y}`}
          fill="#334155"
          stroke="#475569"
        />
        <circle cx={NOZZLE_X} cy={TIP_Y + 2} r="1.5" fill="#94a3b8" />
        <line
          x1={NOZZLE_X}
          y1={FILAMENT_TOP}
          x2={NOZZLE_X}
          y2={TIP_Y - 4}
          stroke={RETRACT}
          strokeDasharray="4 3"
        />
        <line x1={NOZZLE_X} y1={BLOCK_TOP} x2={NOZZLE_X} y2={ARROW_TIP_Y + 7} stroke={RETRACT} />
        <polygon points={`${NOZZLE_X},${ARROW_TIP_Y} ${NOZZLE_X - 4},${ARROW_TIP_Y + 8} ${NOZZLE_X + 4},${ARROW_TIP_Y + 8}`} fill={RETRACT} />

        {/* Давление расплава: две стрелки вниз внутри блока */}
        {[NOZZLE_X - 8, NOZZLE_X + 8].map((x) => (
          <g key={`pressure-${x}`}>
            <line x1={x} y1={BLOCK_TOP + 6} x2={x} y2={BLOCK_BOTTOM - 10} stroke={PRESSURE} />
            <polygon points={`${x},${BLOCK_BOTTOM - 2} ${x - 3.5},${BLOCK_BOTTOM - 11} ${x + 3.5},${BLOCK_BOTTOM - 11}`} fill={PRESSURE} />
          </g>
        ))}

        {CALLOUTS.map((callout) => (
          <g key={callout.label}>
            {callout.line ? (
              <line x1={callout.line[0]} y1={callout.line[2]} x2={callout.line[1]} y2={callout.line[2]} stroke="#475569" strokeOpacity="0.75" />
            ) : null}
            <text x={callout.x} y={callout.y} fontSize="10" fill={callout.color}>
              {callout.label}
            </text>
          </g>
        ))}

        {/* Два режима справа: имя, величина отката и где стоит экструдер */}
        {MODES.map((mode, index) => {
          const top = PANEL_TOP + 4 + index * MODE_STEP;

          return (
            <g key={mode.name}>
              <rect
                x={RIGHT_X}
                y={top}
                width={RIGHT_W}
                height={MODE_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text x={RIGHT_X + 10} y={top + 16} fontSize="12" fontWeight="700" fill={mode.color}>
                {mode.name}
              </text>
              <text x={RIGHT_X + 10} y={top + 32} fontSize="10" fill="#94a3b8">
                откат
              </text>
              <text x={RIGHT_X + 46} y={top + 32} fontSize="10" fill="#e2e8f0">
                {mode.value}
              </text>
              <text x={RIGHT_X + 10} y={top + 46} fontSize="10" fill="#94a3b8">
                {mode.note}
              </text>
            </g>
          );
        })}

        {/* Сноска из блока 21: трубка Bowden, скорость отката и подъём по Z */}
        <rect x="12" y="150" width="296" height="26" rx="6" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="22" y="160" fontSize="10" fill="#94a3b8">
          путь Bowden 30–50 см · скорость отката 25–45 мм/с
        </text>
        <text x="22" y="171" fontSize="10" fill="#94a3b8">
          подъём (z-hop) 0,2–0,4 мм
        </text>
      </svg>
    </VisualWrapper>
  );
}
