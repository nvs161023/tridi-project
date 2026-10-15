import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Акцент кадра: выноски, маркеры и канал сопла — синий базового курса. */
const ACCENT = "#3b82f6";

/** Горячая зона: ниже термобарьера пластик уже расплавлен. */
const HOT = "#f59e0b";

/** Ось узла: по ней идёт нить от фитинга до сопла. */
const AXIS = 70;

/** Шесть рёбер радиатора: сверху вниз до термобарьера. */
const FINS = [62, 66.5, 71, 75.5, 80, 84.5];

/** Шесть лопастей вентилятора через 60°. */
const FAN_BLADES = [0, 60, 120, 180, 240, 300];

/** Центр крыльчатки вентилятора. */
const FAN_X = 29;
const FAN_Y = 71;

/**
 * Выноска к узлу хотэнда: строка текста, высота строки и точка на самой детали.
 */
type Callout = { text: string; y: number; from: [number, number] | null };

const CALLOUTS: Callout[] = [
  { text: "вентилятор 30–40 мм", y: 36, from: [30, 60] },
  { text: "радиатор: 30–45 °C", y: 58, from: [88, 80] },
  { text: "термобарьер: стенка 0,5–1 мм", y: 80, from: [74, 104] },
  { text: "блок: картридж 40 Вт", y: 102, from: [85, 127] },
  { text: "зона плавления: 200–260 °C", y: 124, from: [70, 136] },
  { text: "сопло 0,4 мм", y: 146, from: [78, 152] },
];

/**
 * Кадр блока 20 урока L2 «Разрез хотэнда: пять узлов».
 *
 * Компоновка — единый разрез с выносками, как у шагового мотора: разбираем один
 * узел, а не сравниваем варианты, поэтому полос нет. По оси кадра идёт нить:
 * сверху она холодная и серая, ниже термобарьера — расплавленная и янтарная, то
 * есть граница цветов показывает границу температур. Вокруг оси собраны узлы
 * снизу вверх: сопло с каналом, алюминиевый блок с картриджем, тонкостенный
 * термобарьер, рёбра радиатора с вентилятором и фитинг на входе нити.
 *
 * Числа — из блока 19 и подписи блока 20: наверху радиатора 30–45 °C против
 * 200–260 °C в зоне плавления, вентилятор 30–40 мм, стенка термобарьера 0,5–1 мм,
 * стандартный картридж 40 Вт при 24 В, сопло 0,4 мм. Ток вентилятора 0,1–0,2 А
 * остался в тексте урока: кадру он не нужен, иначе выносок стало бы семь.
 */
export function Basic2Diagram4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Разрез хотэнда снизу вверх: сопло 0,4 мм с каналом, алюминиевый нагревательный блок с картриджем 40 Вт, тонкостенный термобарьер со стенкой 0,5–1 мм, радиатор с рёбрами и вентилятор 30–40 мм, фитинг на входе нити. Сверху узел держит 30–45 °C, в зоне плавления 200–260 °C: ниже термобарьера нить расплавлена, выше остаётся твёрдой, поэтому вентилятор обязан держать верх холодным"
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
          Разрез хотэнда: пять узлов
        </text>

        {/* Нить: сверху холодная, ниже термобарьера уже расплавленная */}
        <line x1={AXIS} y1="20" x2={AXIS} y2="120" stroke="#cbd5e1" strokeWidth="2.6" />
        <line x1={AXIS} y1="120" x2={AXIS} y2="157" stroke={HOT} strokeWidth="2.6" />

        {/* Фитинг на входе нити */}
        <rect x="64" y="48" width="12" height="12" rx="2" fill="#64748b" stroke="#94a3b8" />

        {/* Радиатор: сердцевина и шесть рёбер */}
        <rect x="63" y="60" width="14" height="35" rx="2" fill="#64748b" />
        {FINS.map((y) => (
          <rect key={y} x="52" y={y} width="36" height="3.5" rx="1" fill="#94a3b8" />
        ))}

        {/* Термобарьер: тонкостенная трубка, нить идёт внутри стенок */}
        <rect x="65.5" y="95" width="2.5" height="25" fill="#94a3b8" />
        <rect x="72" y="95" width="2.5" height="25" fill="#94a3b8" />

        {/* Нагревательный блок с картриджем-нагревателем */}
        <rect x="56" y="120" width="28" height="18" rx="1.5" fill="#94a3b8" />
        <rect x="58.5" y="122" width="5" height="14" rx="1" fill={HOT} />

        {/* Сопло: латунная головка и конус с калиброванным каналом */}
        <rect x="62" y="138" width="16" height="10" rx="1.5" fill="#cbd5e1" />
        <polygon points="65,148 75,148 72,158 68,158" fill="#94a3b8" />
        <line x1={AXIS} y1="148" x2={AXIS} y2="157" stroke={HOT} strokeWidth="1.4" />

        {/* Вентилятор радиатора: корпус, крыльчатка и поток к рёбрам */}
        <rect x="18" y="60" width="22" height="22" rx="3" fill="#0f172a" fillOpacity="0.6" stroke="#64748b" />
        <circle cx={FAN_X} cy={FAN_Y} r="6" fill="none" stroke="#94a3b8" />
        {FAN_BLADES.map((angle) => (
          <rect
            key={angle}
            x={FAN_X - 1}
            y={FAN_Y - 8}
            width="2"
            height="6.5"
            fill="#94a3b8"
            transform={`rotate(${angle} ${FAN_X} ${FAN_Y})`}
          />
        ))}
        <line x1="42" y1="65" x2="50" y2="65" stroke={ACCENT} strokeWidth="1.2" />
        <polygon points="50,65 46.5,63.3 46.5,66.7" fill={ACCENT} />
        <line x1="42" y1="77" x2="50" y2="77" stroke={ACCENT} strokeWidth="1.2" />
        <polygon points="50,77 46.5,75.3 46.5,78.7" fill={ACCENT} />

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
