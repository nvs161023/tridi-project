import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Четыре цвета — четыре опоры: зацепление синее, поверхностная энергия голубая,
 * тепло янтарное, чистота изумрудная. Цвет полосы повторяет цвет пиктограммы.
 */
const GRIP = "#3b82f6";
const ENERGY = "#38bdf8";
const HEAT = "#f59e0b";
const CLEAN = "#10b981";

/** Четыре полосы по 31 px и зазор 3 px: 24…55, 58…89, 92…123, 126…157. */
const ROW_TOP = 24;
const ROW_HEIGHT = 31;
const ROW_GAP = 3;

/** Строки внутри полосы: название опоры сверху, пояснение под ним. */
const NAME_Y = 13;
const DETAIL_Y = 25;

/** Пиктограмма занимает 20…48, текст начинается с 58. */
const ICON_X = 20;
const TEXT_X = 58;

type PillarIcon = "grip" | "energy" | "heat" | "clean";

type Pillar = {
  name: string;
  color: string;
  detail: string;
  icon: PillarIcon;
};

/**
 * Четыре опоры ровно по блоку 1: механическое зацепление, поверхностная энергия,
 * тепло и чистота. Числа — из того же блока: Tg около 60 °C у PLA и около 80 °C
 * у PETG (ниже Tg пластик уже не прилипнет заново), силы Ван-дер-Ваальса работают
 * «на расстоянии в доли нанометра». Пояснение про плёнку жира — из блока 2:
 * она снимает адгезию целиком, а не на проценты.
 */
const PILLARS: Pillar[] = [
  {
    name: "Механическое зацепление",
    color: GRIP,
    detail: "пластик затекает в микрорельеф и застывает",
    icon: "grip",
  },
  {
    name: "Поверхностная энергия",
    color: ENERGY,
    detail: "силы Ван-дер-Ваальса, доли нанометра",
    icon: "energy",
  },
  {
    name: "Тепло",
    color: HEAT,
    detail: "податлив выше Tg: PLA 60, PETG 80 °C",
    icon: "heat",
  },
  {
    name: "Чистота",
    color: CLEAN,
    detail: "жир, вода и пыль — разделители: +30 %",
    icon: "clean",
  },
];

/** Пиктограмма опоры: микрорельеф с затекшим пластиком, притяжение, тепло, плёнка жира. */
function Icon({ kind, top, color }: { kind: PillarIcon; top: number; color: string }) {
  if (kind === "grip") {
    return (
      <g>
        <line x1={ICON_X} y1={top + 24} x2={ICON_X + 28} y2={top + 24} stroke="#475569" />
        {[3, 11, 19].map((dx) => (
          <path key={dx} d={`M${ICON_X + dx} ${top + 24} q3 -7 6 0`} fill="none" stroke="#64748b" />
        ))}
        {/* Раздавленная линия затекла между бугорками микрорельефа */}
        <rect x={ICON_X + 1} y={top + 16} width="26" height="5" rx="2" fill={color} fillOpacity="0.85" />
      </g>
    );
  }

  if (kind === "energy") {
    return (
      <g>
        <rect x={ICON_X + 2} y={top + 6} width="24" height="5" rx="2" fill="#334155" stroke="#64748b" />
        <line x1={ICON_X} y1={top + 24} x2={ICON_X + 28} y2={top + 24} stroke="#475569" />
        {[6, 14, 22].map((dx) => (
          <g key={dx}>
            <line x1={ICON_X + dx} y1={top + 14} x2={ICON_X + dx} y2={top + 18} stroke={color} />
            <polygon
              points={`${ICON_X + dx},${top + 23} ${ICON_X + dx - 3},${top + 17} ${ICON_X + dx + 3},${top + 17}`}
              fill={color}
            />
          </g>
        ))}
      </g>
    );
  }

  if (kind === "heat") {
    return (
      <g>
        <rect x={ICON_X} y={top + 19} width="28" height="6" rx="1" fill="#334155" stroke="#64748b" />
        {[6, 14, 22].map((dx) => (
          <path
            key={dx}
            d={`M${ICON_X + dx} ${top + 14} q4 -3 0 -5 q-4 -3 0 -5`}
            fill="none"
            stroke={color}
          />
        ))}
      </g>
    );
  }

  return (
    <g>
      <line x1={ICON_X} y1={top + 24} x2={ICON_X + 28} y2={top + 24} stroke="#475569" />
      {/* Плёнка жира на поверхности — готовый разделительный слой */}
      <ellipse cx={ICON_X + 16} cy={top + 20} rx="10" ry="4.5" fill="#64748b" fillOpacity="0.6" />
      <line x1={ICON_X + 2} y1={top + 5} x2={ICON_X + 10} y2={top + 14} stroke={color} strokeWidth="1.2" />
      <polygon
        points={`${ICON_X + 10},${top + 16} ${ICON_X + 5},${top + 12} ${ICON_X + 8},${top + 9}`}
        fill={color}
      />
    </g>
  );
}

/**
 * Кадр блока 3 урока L5 «Четыре опоры адгезии».
 *
 * Компоновка — четыре полосы сверху вниз, по одной на каждую опору: слева
 * пиктограмма, справа название и пояснение. Порядок и названия — из блока 1, где
 * опоры разобраны по одной: зацепление, поверхностная энергия, тепло, чистота.
 * Числа в полосах оттуда же: Tg около 60 °C у PLA и около 80 °C у PETG, притяжение
 * молекул на расстоянии в доли нанометра. Сноска — из блоков 2 и 13: чистота даёт
 * до +30 % адгезии, это больше, чем любая настройка слайсера.
 */
export function Basic5Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Четыре опоры адгезии: механическое зацепление — пластик затекает в микрорельеф и застывает в нём; поверхностная энергия — силы Ван-дер-Ваальса на расстоянии в доли нанометра; тепло — выше температуры стеклования пластик податлив, у PLA около 60, у PETG около 80 градусов; чистота — пыль, вода и жир работают разделительными слоями. Чистота даёт до 30 процентов адгезии"
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
          Четыре опоры адгезии
        </text>

        {/* Четыре полосы: пиктограмма опоры, название и пояснение */}
        {PILLARS.map((pillar, index) => {
          const top = ROW_TOP + index * (ROW_HEIGHT + ROW_GAP);

          return (
            <g key={pillar.name}>
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
              <Icon kind={pillar.icon} top={top} color={pillar.color} />
              <text x={TEXT_X} y={top + NAME_Y} fontSize="12" fontWeight="700" fill={pillar.color}>
                {pillar.name}
              </text>
              <text x={TEXT_X} y={top + DETAIL_Y} fontSize="10" fill="#94a3b8">
                {pillar.detail}
              </text>
            </g>
          );
        })}

        {/* Сноска из блоков 2 и 13 */}
        <rect x="12" y="160" width="296" height="16" rx="6" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="22" y="172" fontSize="10" fill="#94a3b8">
          чистота даёт до +30 % адгезии
        </text>
      </svg>
    </VisualWrapper>
  );
}
