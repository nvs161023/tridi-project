import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Акцент кадра: это механика привода, синий цвет базового курса. */
const ACCENT = "#3b82f6";

/** Центр мотора в кадре: вокруг него строится разрез. */
const CX = 85;
const CY = 66;

/** Восемь катушек-полюсов статора через 45°. */
const STATOR_TEETH = [0, 45, 90, 135, 180, 225, 270, 315];

/** Двенадцать зубцов на роторе через 30°. */
const ROTOR_TEETH = Array.from({ length: 12 }, (_, index) => index * 30);

/** Четыре крепёжных отверстия в углах фланца. */
const FLANGE_HOLES: [number, number][] = [
  [51, 32],
  [119, 32],
  [51, 100],
  [119, 100],
];

/** Ступени микрошага: целый шаг, 1/16 и максимум у TMC-драйверов. */
const MICROSTEPS = [
  { step: "1", note: "без дробления" },
  { step: "1/16", note: "3200 шагов" },
  { step: "1/256", note: "тише и плавнее" },
];

/**
 * Выноска к узлу мотора: строка текста и точка на самой детали. У строки про
 * шаг точки нет — это свойство всего мотора, а не место на разрезе.
 */
type Callout = { text: string; y: number; from: [number, number] | null };

const CALLOUTS: Callout[] = [
  { text: "ротор с зубцами", y: 36, from: [100, 51] },
  { text: "катушки статора, 2 фазы", y: 60, from: [123, 68] },
  { text: "200 шагов = 1,8° на оборот", y: 84, from: null },
  { text: "NEMA 17: фланец 42,3 мм", y: 108, from: [120, 104] },
];

/** Верх и высота нижней полосы с сеткой микрошага. */
const BAND_TOP = 114;
const BAND_HEIGHT = 54;

/** Три ячейки сетки микрошага: x, ширина и отступ между ними. */
const CELL_X = [20, 116, 212];
const CELL_WIDTH = 88;
const CELL_TOP = 136;
const CELL_HEIGHT = 26;

/**
 * Кадр блока 9 урока L2 «Шаговый мотор, драйвер и микрошаг».
 *
 * Компоновка — единый разрез с выносками, а не полосы: разбираем один узел, а не
 * сравниваем варианты. Слева мотор со снятой крышкой: фланец NEMA 17 с четырьмя
 * отверстиями, статор с восемью катушками-полюсами, ротор с зубцами и вал.
 * Справа четыре выноски — ротор, катушки (две фазы), 200 шагов = 1,8° и фланец
 * 42,3 мм. Внизу полоса с сеткой микрошага 1 / 1/16 / 1/256: у 1/16 урок даёт
 * 3200 шагов на оборот, а про 1/256 сказано другое — микрошаг добавляет
 * плавность, а не точность, поэтому в ячейке стоит плавность.
 *
 * Числа — из блока 8: шаг мотора 1,8° и 200 шагов на оборот (360 / 1,8), NEMA 17 —
 * фланец 42,3 мм, дробление 1/16 — это 3200 шагов на оборот, TMC2208 умеет до
 * 1/256. Дробных «микронных» чисел кадр не обещает: урок прямо говорит, что
 * микрошаг точности позиционирования не даёт.
 */
export function Basic2Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Разрез шагового мотора NEMA 17: фланец 42,3 мм с четырьмя крепёжными отверстиями, статор с восемью катушками-полюсами (две фазы), ротор с зубцами и вал; шаг мотора 1,8°, то есть 200 шагов на оборот. Внизу сетка микрошага: 1 — без дробления, 1/16 — 3200 шагов на оборот, 1/256 — тише и плавнее, но точность позиционирования задаёт пара «шаг мотора и ремень», а не микрошаг"
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
          Шаговый мотор: ротор, катушки, микрошаг
        </text>

        {/* Фланец NEMA 17 — квадрат 42,3 мм с четырьмя отверстиями под винты */}
        <rect
          x="41"
          y="22"
          width="88"
          height="88"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.5"
          stroke="#64748b"
          strokeWidth="1.2"
        />
        {FLANGE_HOLES.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="#0f172a" stroke="#64748b" />
        ))}

        {/* Статор: восемь катушек-полюсов смотрят внутрь к ротору */}
        <circle cx={CX} cy={CY} r="34" fill="#1e293b" fillOpacity="0.9" stroke="#64748b" strokeWidth="1.2" />
        {STATOR_TEETH.map((angle) => (
          <rect
            key={angle}
            x={CX - 5}
            y={CY - 34}
            width="10"
            height="9"
            fill={ACCENT}
            fillOpacity="0.7"
            transform={`rotate(${angle} ${CX} ${CY})`}
          />
        ))}

        {/* Ротор с зубцами и вал */}
        <circle cx={CX} cy={CY} r="21" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
        {ROTOR_TEETH.map((angle) => (
          <rect
            key={angle}
            x={CX - 2}
            y={CY - 21}
            width="4"
            height="5"
            fill="#cbd5e1"
            transform={`rotate(${angle} ${CX} ${CY})`}
          />
        ))}
        <circle cx={CX} cy={CY} r="5" fill="#cbd5e1" />
        <circle cx={CX} cy={CY} r="1.8" fill="#64748b" />

        {/* Выноски: точка на детали, линия к строке и маркер перед текстом */}
        {CALLOUTS.map((callout) => (
          <g key={callout.text}>
            {callout.from && (
              <>
                <line
                  x1={callout.from[0]}
                  y1={callout.from[1]}
                  x2="138"
                  y2={callout.y}
                  stroke="#64748b"
                  strokeWidth="1"
                />
                <circle cx={callout.from[0]} cy={callout.from[1]} r="1.7" fill="#94a3b8" />
              </>
            )}
            <circle cx="145" cy={callout.y - 3} r="2.6" fill={ACCENT} />
            <text x="152" y={callout.y} fontSize="10" fill="#cbd5e1">
              {callout.text}
            </text>
          </g>
        ))}

        {/* Сетка микрошага: одно свойство драйвера в трёх ступенях */}
        <rect
          x="12"
          y={BAND_TOP}
          width="296"
          height={BAND_HEIGHT}
          rx="8"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="20" y="129" fontSize="10" fill="#94a3b8">
          Микрошаг: плавность, а не точность
        </text>
        {MICROSTEPS.map((microstep, index) => (
          <g key={microstep.step}>
            <rect
              x={CELL_X[index]}
              y={CELL_TOP}
              width={CELL_WIDTH}
              height={CELL_HEIGHT}
              rx="5"
              fill={ACCENT}
              fillOpacity="0.12"
              stroke={ACCENT}
              strokeOpacity="0.5"
            />
            <text
              x={CELL_X[index] + 10}
              y={CELL_TOP + 12}
              fontSize="10"
              fontWeight="700"
              fill={ACCENT}
            >
              {microstep.step}
            </text>
            <text x={CELL_X[index] + 10} y={CELL_TOP + 23} fontSize="10" fill="#cbd5e1">
              {microstep.note}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
