import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Три ряда линий при разном потоке: щели, плотно и наплывы.
 *
 * pitch — шаг между линиями, width — толщина линии. При 90 % линии тоньше шага и
 * между ними щели, при 100 % смыкаются ровно, при 110 % шире шага и налезают друг
 * на друга.
 */
const rows = [
  {
    y: 48,
    label: "90 %",
    effect: "щели",
    tone: "#94a3b8",
    effectFill: "#f87171",
    pitch: 30,
    width: 12,
  },
  {
    y: 88,
    label: "100 %",
    effect: "ровно",
    tone: "#34d399",
    effectFill: "#34d399",
    pitch: 20,
    width: 20,
  },
  {
    y: 128,
    label: "110 %",
    effect: "наплывы",
    tone: "#f59e0b",
    effectFill: "#fbbf24",
    pitch: 16,
    width: 20,
  },
];

/**
 * Поток: мало, норма, много — линии и шкала.
 *
 * Ровно по content урока: «90% — щели. 100% — ровно. 110% — наплывы». Слева шкала
 * потока с тремя рисками (90/100/110 %), справа от неё три ряда уложенных линий, а
 * справа от линий — что видно на детали. Внизу подсказка из урока: старт всегда
 * 100 %, а дальше поток правят по толщине стенки кубика (сопло 0,4 мм).
 *
 * От плиток заполнения (урок 7) отличается форматом: там четыре квадрата с разной
 * плотностью решётки, здесь три горизонтальные дорожки линий со шкалой процентов.
 */
export function Basic6Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Поток 90, 100 и 110 процентов: при 90 между линиями щели, при 100 линии смыкаются ровно, при 110 линии шире шага и дают наплывы; старт всегда 100 процентов"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <defs>
          <linearGradient id="v-b6i-flow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="50%" stopColor="#34d399" />
            <stop offset="90%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>

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

        {/* Шкала потока с рисками на 90, 100 и 110 % */}
        <rect x="28" y="36" width="6" height="104" rx="3" fill="url(#v-b6i-flow)" />
        {rows.map((row) => (
          <line
            key={`tick-${row.label}`}
            x1="34"
            y1={row.y}
            x2="42"
            y2={row.y}
            stroke="#cbd5e1"
            strokeWidth="1"
          />
        ))}

        {rows.map((row) => (
          <g key={row.label}>
            <text x="46" y={row.y + 4} fontSize="10" fill="#e2e8f0">
              {row.label}
            </text>

            {/* Линии при этом потоке: чем больше поток, тем шире линии */}
            {[0, 1, 2, 3].map((index) => (
              <rect
                key={index}
                x={80 + index * row.pitch}
                y={row.y - 14}
                width={row.width}
                height="28"
                rx="2"
                fill={row.tone}
              />
            ))}

            {/* Что видно на детали */}
            <text x="200" y={row.y + 4} fontSize="10" fill={row.effectFill}>
              {row.effect}
            </text>
          </g>
        ))}

        {/* Наплывы при 110 %: пластик вылезает валиками */}
        <circle cx="88" cy="112" r="3" fill="#fbbf24" fillOpacity="0.6" />
        <circle cx="106" cy="112" r="3" fill="#fbbf24" fillOpacity="0.6" />
        <circle cx="124" cy="112" r="3" fill="#fbbf24" fillOpacity="0.6" />

        <text x="28" y="168" fontSize="10" fill="#94a3b8">
          Старт 100 %, дальше по стенке кубика (сопло 0,4 мм)
        </text>
      </svg>
    </VisualWrapper>
  );
}
