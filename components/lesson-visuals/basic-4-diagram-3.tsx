import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Три ориентации читаются как шкала риска: плашмя — синий, на боку —
 * оранжевый, стоя — красный с меткой отрыва.
 */
const SAFE = "#3b82f6";
const SIDE = "#f59e0b";
const DANGER = "#f87171";

/** Три полосы по 40 px и зазор 3 px: 24…64, 67…107, 110…150. */
const ROW_TOP = 24;
const ROW_HEIGHT = 40;
const ROW_GAP = 3;

/** Строки внутри полосы: название ориентации сверху, числа поддержек под ней. */
const NAME_Y = 16;
const DETAIL_Y = 31;

/** Стол в каждой полосе — на 36 px от её верха, детали стоят на нём. */
const BED_OFFSET = 36;

/** Текстовые столбцы: название, счётчик поддержек и метка риска. */
const NAME_X = 68;
const VALUE_X = 134;
const RISK_X = 190;

type Orientation = {
  name: string;
  color: string;
  supports: string;
  risk?: string;
  /** Силуэт детали в полосе: плашмя, на боку и стоя. */
  shape: "flat" | "side" | "standing";
};

/** Три строки ровно по подписи блока 30. */
const ORIENTATIONS: Orientation[] = [
  { name: "Плашмя", color: SAFE, supports: "нет", shape: "flat" },
  { name: "На боку", color: SIDE, supports: "12 %", shape: "side" },
  { name: "Вертикально", color: DANGER, supports: "25 %", risk: "риск отрыва", shape: "standing" },
];

/** Силуэт кронштейна в трёх разворотах: плита лежит, встала на кромку, стоит. */
function Bracket({ kind, top }: { kind: Orientation["shape"]; top: number }) {
  const bed = top + BED_OFFSET;

  if (kind === "flat") {
    return (
      <g>
        <rect x="26" y={bed - 8} width="34" height="8" rx="1" fill="#334155" stroke="#64748b" />
        <circle cx="43" cy={bed - 4} r="2" fill="#0f172a" stroke="#64748b" />
      </g>
    );
  }

  if (kind === "side") {
    return (
      <polygon
        points={`26,${bed} 26,${bed - 8} 48,${bed - 8} 48,${bed - 28} 56,${bed - 28} 56,${bed}`}
        fill="#334155"
        stroke="#64748b"
      />
    );
  }

  return (
    <g>
      <polygon
        points={`28,${bed} 28,${top + 6} 44,${top + 6} 44,${top + 14} 36,${top + 14} 36,${bed}`}
        fill="#334155"
        stroke="#64748b"
      />
      {/* Метка отрыва: узкое основание тянет вверх от стола */}
      <line x1="50" y1={bed} x2="50" y2={top + 22} stroke={DANGER} />
      <polygon points={`50,${top + 18} 46,${top + 26} 54,${top + 26}`} fill={DANGER} />
    </g>
  );
}

/**
 * Кадр блока 30 урока L4 «Три ориентации одной детали».
 *
 * Три полосы: одна и та же деталь лежит плашмя, встала на кромку и стоит
 * вертикально. Силуэт меняется, а стол остаётся на месте — по нему видно, как
 * сужается пятно контакта. Отсюда и разница в цифрах: плашмя поддержки не
 * нужны, на боку их 12 %, вертикально 25 % и основание легко оторвать.
 *
 * Числа — из подписи блока 30. Проценты — это процент поддержек: блок 31
 * советует смотреть после разворота «общее время, процент поддержек, пятно
 * контакта». Сноска — из блока 31: нависания до 45-50° от вертикали печатаются
 * без поддержек, круче — уже нужны (блок 32).
 */
export function Basic4Diagram3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три ориентации одного кронштейна: плашмя — поддержки не нужны, на боку — 12 процентов поддержек, вертикально — 25 процентов и риск отрыва от стола. Нависания до 45-50 градусов от вертикали печатаются без поддержек"
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
          Три ориентации одной детали
        </text>

        {/* Три полосы: силуэт на столе и цифры поддержек */}
        {ORIENTATIONS.map((orientation, index) => {
          const top = ROW_TOP + index * (ROW_HEIGHT + ROW_GAP);

          return (
            <g key={orientation.name}>
              <rect
                x="12"
                y={top}
                width="296"
                height={ROW_HEIGHT}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <line x1="20" y1={top + BED_OFFSET} x2="62" y2={top + BED_OFFSET} stroke="#475569" strokeWidth="1.5" />
              <Bracket kind={orientation.shape} top={top} />

              <text x={NAME_X} y={top + NAME_Y} fontSize="12" fontWeight="700" fill={orientation.color}>
                {orientation.name}
              </text>
              <text x={NAME_X} y={top + DETAIL_Y} fontSize="10" fill="#94a3b8">
                поддержек
              </text>
              <text x={VALUE_X} y={top + DETAIL_Y} fontSize="10" fill="#e2e8f0">
                {orientation.supports}
              </text>
              {orientation.risk ? (
                <text x={RISK_X} y={top + DETAIL_Y} fontSize="10" fill={DANGER}>
                  {orientation.risk}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* Сноска из блока 31: где нависание ещё печатается само */}
        <rect x="12" y="156" width="296" height="16" rx="6" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="22" y="168" fontSize="10" fill="#94a3b8">
          нависания до 45–50° печатаются без поддержек
        </text>
      </svg>
    </VisualWrapper>
  );
}
