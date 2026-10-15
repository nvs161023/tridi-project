import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Акцент кадра: выноски, маркеры и расплав — синий базового курса. */
const ACCENT = "#3b82f6";

/** Горячая зона: блок и канал сопла. */
const HOT = "#f59e0b";

/** Ось пути: по ней нить идёт от катушки до первой линии. */
const AXIS = 64;

/** Сечение нити на входе: врезка не в масштабе кадра, иначе 1,75 мм не влезли бы. */
const SECTION_Y = 36;
const SECTION_R = 15;

/** Линия считается в масштабе кадра: 1 мм равен 100 px, значит 0,45 × 0,2 мм — 44 × 20 px. */
const BEAD_WIDTH = 44;
const BEAD_HEIGHT = 20;
const BEAD_TOP = 128;
const BED_Y = BEAD_TOP + BEAD_HEIGHT;

/**
 * Выноска к пути филамента: строка текста, высота строки и точка на детали.
 */
type Callout = { text: string; y: number; from: [number, number] | null };

const CALLOUTS: Callout[] = [
  { text: "нить 1,75 ± 0,02 мм", y: 36, from: [AXIS + SECTION_R, SECTION_Y] },
  { text: "дешёвая катушка: ± 0,05 мм", y: 58, from: [AXIS, 62] },
  { text: "хотэнд 190–310 °C", y: 80, from: [80, 104] },
  { text: "сопло 0,4 мм", y: 102, from: [69, 124] },
  { text: "линия 0,45 × 0,2 мм", y: 124, from: [86, 138] },
];


/**
 * Кадр блока 3 урока L3 «Сечение нити и путь филамента».
 *
 * Компоновка — один путь сверху вниз плюс выноски-точки справа: разбираем один
 * тракт, а не сравниваем варианты, поэтому полос нет. По оси кадра идёт нить: на
 * входе она показана врезкой-сечением с диаметром, дальше проходит через
 * нагревательный блок, выходит через сопло и ложится на стол первой линией.
 * Линия нарисована в масштабе кадра — 1 мм = 100 px, то есть 0,45 × 0,2 мм это
 * 44 × 20 px. Врезка сечения не в масштабе, иначе нить 1,75 мм заняла бы весь
 * кадр.
 *
 * Числа — из подписи блока 3 (нить 1,75 ± 0,02 мм, хотэнд 190–310 °C, сопло
 * 0,4 мм, линия 0,45 × 0,2 мм) и блока 1 (аккуратная катушка держит
 * 1,75 ± 0,02 мм, дешёвая гуляет в пределах ± 0,05 мм, из сопла линия выходит
 * шириной 0,4–0,5 мм). Диапазон 190–310 °C — рамка всего урока, от PLA до PC.
 */
export function Basic3Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Путь филамента: нить 1,75 ± 0,02 мм входит в кадр сечением, у дешёвой катушки допуск гуляет до ± 0,05 мм, дальше нить проходит хотэнд с рабочим диапазоном 190–310 °C, выходит через сопло 0,4 мм и ложится на стол линией 0,45 × 0,2 мм"
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
          Сечение нити и путь филамента
        </text>


        {/* Врезка сечения нити: круг с диаметром */}
        <circle cx={AXIS} cy={SECTION_Y} r={SECTION_R} fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.2" />
        <line x1={AXIS - SECTION_R} y1={SECTION_Y} x2={AXIS + SECTION_R} y2={SECTION_Y} stroke={ACCENT} strokeWidth="1" />
        <line x1={AXIS - SECTION_R} y1={SECTION_Y - 3} x2={AXIS - SECTION_R} y2={SECTION_Y + 3} stroke={ACCENT} strokeWidth="1" />
        <line x1={AXIS + SECTION_R} y1={SECTION_Y - 3} x2={AXIS + SECTION_R} y2={SECTION_Y + 3} stroke={ACCENT} strokeWidth="1" />

        {/* Нить от врезки до блока */}
        <line x1={AXIS} y1={SECTION_Y + SECTION_R} x2={AXIS} y2="96" stroke="#cbd5e1" strokeWidth="2.6" />

        {/* Нагревательный блок с картриджем и сопло */}
        <rect x="48" y="96" width="32" height="20" rx="2" fill="#94a3b8" />
        <rect x="52" y="99" width="6" height="14" rx="1" fill={HOT} />
        <polygon points="54,116 74,116 69,128 59,128" fill="#cbd5e1" />
        <line x1={AXIS} y1="116" x2={AXIS} y2="127" stroke={HOT} strokeWidth="1.4" />

        {/* Первая линия на столе: 0,45 × 0,2 мм в масштабе кадра */}
        <rect
          x={AXIS - BEAD_WIDTH / 2}
          y={BEAD_TOP}
          width={BEAD_WIDTH}
          height={BEAD_HEIGHT}
          rx="2"
          fill={HOT}
          fillOpacity="0.35"
          stroke={HOT}
          strokeWidth="1.2"
        />
        <line x1="30" y1={BED_Y} x2="126" y2={BED_Y} stroke="#64748b" />

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
      </svg>
    </VisualWrapper>
  );
}
