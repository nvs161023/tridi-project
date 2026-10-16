import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Верхняя панель с постановкой задачи: 20…46. */
const HEAD_TOP = 20;
const HEAD_H = 26;

/** Труба, по которой идёт запрос скорости: 84…96. */
const PIPE_TOP = 84;
const PIPE_H = 12;

/** Три вентиля-задвижки: ромб 28 px по высоте, подписи сверху и снизу. */
const VALVE_TOP = 76;
const VALVE_H = 28;
const VALVE_HALF = 14;
const VALVE_NAME_Y = 62;
const VALVE_VALUE_Y = 118;

/** Стрелки потока между вентилями. */
const FLOW_X = [114, 206];
const PIPE_MIDDLE = PIPE_TOP + PIPE_H / 2;

/** Панели-вывода: 126…148 и 152…176. */
const NOTE_TOP = 126;
const NOTE_H = 22;
const NOTE_STEP = 26;

type Valve = { center: number; name: string; value: string; color: string };

/**
 * Три вентиля ровно по подписи блока 20: поток хотэнда, ускорение и минимальное
 * время слоя. Числа — из блоков 19 и 34: PLA 10–15 мм³/с, ускорение
 * 2000–3000 мм/с², минимальное время слоя 5–10 с.
 */
const VALVES: Valve[] = [
  { center: 68, name: "Поток хотэнда", value: "PLA 10–15 мм³/с", color: "#f59e0b" },
  { center: 160, name: "Ускорение", value: "2000–3000 мм/с²", color: "#3b82f6" },
  { center: 252, name: "Время слоя", value: "5–10 с", color: "#10b981" },
];

/** Панели-вывода: время печати не падает, а лишние вентили не помогают. */
const NOTES = [
  "60 → 100 мм/с, а время печати не упало — сработал поток",
  "остальные вентили можно открывать сколько угодно",
];

/**
 * Кадр блока 20 урока L6 «Три вентиля: поток, ускорения, время слоя».
 *
 * Компоновка — труба запроса от сопла к детали, на ней три задвижки: поток
 * хотэнда, ускорение и минимальное время слоя. Подпись сверху — как называется
 * вентиль, снизу — рабочее число. Сноски объясняют правило: решает самый
 * зажатый вентиль, остальные можно открывать сколько угодно.
 */
export function Basic6Diagram2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три вентиля на пути сопла: поток хотэнда — PLA 10–15 кубических миллиметров в секунду, ускорение — 2000–3000 миллиметров в секунду в квадрате, минимальное время слоя — 5–10 секунд. Самый зажатый вентиль решает, остальные можно открывать сколько угодно. Если поднять скорость с 60 до 100 миллиметров в секунду, а время печати не упало, значит почти везде сработал ограничитель потока"
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
          Три ограничителя скорости
        </text>

        {/* Верхняя панель: правило трёх вентилей */}
        <rect
          x="12"
          y={HEAD_TOP}
          width="296"
          height={HEAD_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="33" fontSize="10" fill="#e2e8f0">
          три вентиля на пути сопла
        </text>
        <text x="22" y="43" fontSize="10" fill="#94a3b8">
          самый зажатый решает, остальные не помогут
        </text>

        {/* Труба запроса и стрелки потока */}
        <rect
          x="12"
          y={PIPE_TOP}
          width="296"
          height={PIPE_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.6"
          stroke="#475569"
        />
        {FLOW_X.map((x) => (
          <polygon
            key={x}
            points={`${x + 6},${PIPE_MIDDLE} ${x - 2},${PIPE_MIDDLE - 4} ${x - 2},${PIPE_MIDDLE + 4}`}
            fill="#64748b"
          />
        ))}

        {/* Три вентиля с подписями */}
        {VALVES.map((valve) => (
          <g key={valve.name}>
            <polygon
              points={`${valve.center - VALVE_HALF},${VALVE_TOP} ${valve.center - VALVE_HALF},${
                VALVE_TOP + VALVE_H
              } ${valve.center},${VALVE_TOP + VALVE_H / 2}`}
              fill={valve.color}
              fillOpacity="0.35"
              stroke={valve.color}
            />
            <polygon
              points={`${valve.center + VALVE_HALF},${VALVE_TOP} ${valve.center + VALVE_HALF},${
                VALVE_TOP + VALVE_H
              } ${valve.center},${VALVE_TOP + VALVE_H / 2}`}
              fill={valve.color}
              fillOpacity="0.35"
              stroke={valve.color}
            />
            <text
              x={valve.center}
              y={VALVE_NAME_Y}
              fontSize="11"
              fontWeight="700"
              fill={valve.color}
              textAnchor="middle"
            >
              {valve.name}
            </text>
            <text x={valve.center} y={VALVE_VALUE_Y} fontSize="10" fill="#94a3b8" textAnchor="middle">
              {valve.value}
            </text>
          </g>
        ))}

        {/* Панели-вывода */}
        {NOTES.map((note, index) => {
          const top = NOTE_TOP + index * NOTE_STEP;

          return (
            <g key={note}>
              <rect
                x="12"
                y={top}
                width="296"
                height={NOTE_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text x="22" y={top + 14} fontSize="10" fill="#94a3b8">
                {note}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
