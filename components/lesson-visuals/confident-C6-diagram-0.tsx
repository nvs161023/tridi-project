import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Кронштейн-уголок: полка 34…140 на 36…60, стойка 34…52 на 36…120. */
const BRACKET = "34,36 140,36 140,60 52,60 52,120 34,120";
/** Зона нагрузки вокруг отверстия под болт: центр 118,48. */
const BOSS = { cx: 118, cy: 48, r: 15 };
/** Зона без поддержек под полкой: 66…134 на 66…96. */
const BLOCKED = { x: 66, y: 66, w: 68, h: 30 };
/** Колонка зон: подписи 176…308, три строки через 34. */
const ROW_X = 176;
const ROW_TOP = 44;
const ROW_STEP = 34;

type Zone = { name: string; value: string; color: string };

/** Три зоны кронштейна — блоки 3, 5, 7 и 13. */
const ZONES: Zone[] = [
  { name: "Зона нагрузки", value: "60 %, 4 стенки", color: "#10b981" },
  { name: "Тело детали", value: "15 %, 2–3 стенки", color: "#60a5fa" },
  { name: "Под полкой", value: "поддержки выкл.", color: "#f87171" },
];

const NOTES = [
  "Две-три настройки на зону, не больше",
  "Границу прячь за ребром формы",
  "Модификатор меняет печать, не геометрию",
];

/**
 * Кадр блока 4 урока C6 «Три зоны одной детали».
 *
 * Кронштейн из описания кадра `C6_modifier_zones.png` и блоков 3, 5, 7, 13:
 * у отверстия под болт стоит цилиндр-модификатор с заполнением 60 % и четырьмя
 * стенками, остальное тело печатается на 15 % с двумя-тремя стенками, а под
 * полкой работает блокировщик поддержек — опора там не нужна и мешает (блок 7).
 * Один приём решает три задачи: прочность, вес и поддержки. Нижние строки —
 * блоки 5, 11 и 3: на зону ставят две-три настройки, границу настроек прячут за
 * ребром формы, а форма детали при этом не меняется вовсе.
 */
export function ConfidentC6Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три зоны одной детали. Кронштейн-уголок: вокруг отверстия под болт стоит цилиндр-модификатор с заполнением 60 процентов и четырьмя стенками. Тело детали печатается на 15 процентов с двумя-тремя стенками. Под полкой блокировщик выключает поддержки — там опора не нужна и мешает. На зону ставят две-три настройки, не больше. Границу настроек прячут за ребром формы. Модификатор меняет способ печати, а не геометрию детали"
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
          Три зоны одной детали
        </text>

        {/* Кронштейн: полка со стойкой */}
        <polygon points={BRACKET} fill="#334155" fillOpacity="0.55" stroke="#64748b" />
        <polygon points={BRACKET} fill="#60a5fa" fillOpacity="0.1" />

        {/* Зона без поддержек под полкой */}
        <rect
          x={BLOCKED.x}
          y={BLOCKED.y}
          width={BLOCKED.w}
          height={BLOCKED.h}
          rx="3"
          fill="#f87171"
          fillOpacity="0.1"
          stroke="#f87171"
          strokeOpacity="0.6"
          strokeDasharray="4 3"
        />
        <text x={BLOCKED.x + 4} y={BLOCKED.y + 13} fontSize="10" fill="#fca5a5">
          опор нет
        </text>

        {/* Отверстие и зона нагрузки вокруг него */}
        <circle
          cx={BOSS.cx}
          cy={BOSS.cy}
          r={BOSS.r}
          fill="#10b981"
          fillOpacity="0.16"
          stroke="#10b981"
          strokeDasharray="4 3"
        />
        <circle cx={BOSS.cx} cy={BOSS.cy} r="6" fill="#0f172a" stroke="#e2e8f0" />
        <text x={BOSS.cx} y={BOSS.cy - 21} fontSize="10" fontWeight="700" fill="#10b981" textAnchor="middle">
          60 %
        </text>

        {/* Подписи зон на теле */}
        <text x="58" y="112" fontSize="10" fill="#93c5fd">
          15 %
        </text>
        <line x1="52" y1="108" x2="56" y2="108" stroke="#93c5fd" strokeOpacity="0.7" />

        {/* Колонка зон: что стоит в каждой */}
        {ZONES.map((zone, index) => {
          const y = ROW_TOP + index * ROW_STEP;
          return (
            <g key={zone.name}>
              <rect
                x={ROW_X - 6}
                y={y - 10}
                width="138"
                height="30"
                rx="3"
                fill={zone.color}
                fillOpacity="0.08"
              />
              <text x={ROW_X} y={y} fontSize="10" fontWeight="700" fill={zone.color}>
                {zone.name}
              </text>
              <text x={ROW_X} y={y + 12} fontSize="10" fill="#cbd5e1">
                {zone.value}
              </text>
            </g>
          );
        })}

        {/* Правила работы с зонами */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={146 + index * 12}
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
