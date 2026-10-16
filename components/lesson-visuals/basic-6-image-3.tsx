import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две карты: 12…158 и 162…308, 22…124. */
const PANEL_TOP = 22;
const PANEL_H = 102;
const PANEL_W = 146;
const PANEL_X = [12, 162];

/** Куб 40 мм в плане: квадрат 70 на 70, стенка 12 px по краю. */
const CUBE_TOP = 42;
const CUBE_SIZE = 70;
const WALL_BAND = 12;

/** Шкала под картами: 130…176, три строки легенды. */
const NOTE_TOP = 130;
const NOTE_H = 46;
const NOTE_LINE_Y = [13, 27, 41];
const NOTE_TEXT_X = 38;

type Map = { title: string; left: number; center: number; fill: string; wall: string };

/**
 * Две карты одного и того же куба 40 мм из подписи блока 22: слева скорость —
 * заполнение 100 мм/с красным, внешние стенки 60, первый слой 20; справа поток —
 * 9 мм³/с в заполнении и 5,4 мм³/с на внешних стенках.
 */
const MAPS: Map[] = [
  { title: "карта скорости", left: 38, center: 85, fill: "100", wall: "60" },
  { title: "карта потока", left: 188, center: 235, fill: "9", wall: "5,4" },
];

type Legend = { color: string; text: string };

/** Легенда: цвет плитки, единицы скорости и потока и оговорка про первый слой. */
const LEGEND: Legend[] = [
  { color: "#f87171", text: "заполнение 100 мм/с → 9 мм³/с" },
  { color: "#3b82f6", text: "внешние стенки 60 мм/с → 5,4 мм³/с" },
  { color: "#f59e0b", text: "первый слой 20 мм/с — задаётся отдельно" },
];

/**
 * Кадр блока 22 урока L6 «Предпросмотр: карта скорости и карта потока».
 *
 * Компоновка — две карты одного куба: скорость и объёмный поток. Красная середина
 * отвечает заполнению, синяя рамка — внешним стенкам. Легенда снизу связывает
 * цвета с числами и напоминает, что первый слой идёт на своём режиме.
 *
 * Числа — из подписи блока 22: куб 40 мм, заполнение 100 мм/с, стенки 60 мм/с,
 * первый слой 20 мм/с, поток 9 и 5,4 мм³/с при линии 0,45 мм и слое 0,2 мм.
 */
export function Basic6Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Две карты куба 40 мм: слева карта скорости, где заполнение идёт 100 миллиметров в секунду красным, внешние стенки 60 и первый слой 20; справа карта потока, где в заполнении 9 кубических миллиметров в секунду, а на внешних стенках 5,4. Первый слой задаётся отдельной скоростью и на карту заполнения не влияет"
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
          Карты скорости и потока: куб 40 мм
        </text>

        {/* Карты: заполнение красным, внешние стенки синей рамкой */}
        {MAPS.map((map, index) => (
          <g key={map.title}>
            <rect
              x={PANEL_X[index]}
              y={PANEL_TOP}
              width={PANEL_W}
              height={PANEL_H}
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text
              x={map.center}
              y="34"
              fontSize="10"
              fontWeight="700"
              fill="#e2e8f0"
              textAnchor="middle"
            >
              {map.title}
            </text>
            {/* Стены периметра */}
            <rect
              x={map.left}
              y={CUBE_TOP}
              width={CUBE_SIZE}
              height={WALL_BAND}
              fill="#3b82f6"
              fillOpacity="0.45"
            />
            <rect
              x={map.left}
              y={CUBE_TOP + CUBE_SIZE - WALL_BAND}
              width={CUBE_SIZE}
              height={WALL_BAND}
              fill="#3b82f6"
              fillOpacity="0.45"
            />
            <rect
              x={map.left}
              y={CUBE_TOP}
              width={WALL_BAND}
              height={CUBE_SIZE}
              fill="#3b82f6"
              fillOpacity="0.45"
            />
            <rect
              x={map.left + CUBE_SIZE - WALL_BAND}
              y={CUBE_TOP}
              width={WALL_BAND}
              height={CUBE_SIZE}
              fill="#3b82f6"
              fillOpacity="0.45"
            />
            {/* Заполнение внутри стенок */}
            <rect
              x={map.left + WALL_BAND}
              y={CUBE_TOP + WALL_BAND}
              width={CUBE_SIZE - 2 * WALL_BAND}
              height={CUBE_SIZE - 2 * WALL_BAND}
              fill="#f87171"
              fillOpacity="0.4"
            />
            <text
              x={map.center}
              y="84"
              fontSize="12"
              fontWeight="700"
              fill="#f87171"
              textAnchor="middle"
            >
              {map.fill}
            </text>
            {/* Выноска к внешней стенке */}
            <line
              x1={map.left + CUBE_SIZE - 4}
              y1="90"
              x2={map.left + CUBE_SIZE + 6}
              y2="90"
              stroke="#3b82f6"
            />
            <text
              x={map.left + CUBE_SIZE + 8}
              y="94"
              fontSize="11"
              fontWeight="700"
              fill="#3b82f6"
            >
              {map.wall}
            </text>
          </g>
        ))}

        {/* Легенда: цвет плитки и числа */}
        <rect
          x="12"
          y={NOTE_TOP}
          width="296"
          height={NOTE_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {LEGEND.map((item, index) => (
          <g key={item.text}>
            <rect
              x="22"
              y={NOTE_TOP + NOTE_LINE_Y[index] - 6}
              width="10"
              height="8"
              rx="2"
              fill={item.color}
              fillOpacity="0.7"
            />
            <text x={NOTE_TEXT_X} y={NOTE_TOP + NOTE_LINE_Y[index]} fontSize="10" fill="#94a3b8">
              {item.text}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
