import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** График: панель 12…308 и 20…116, оси по x=24 и y=100. */
const AXIS_X = 24;
const AXIS_Y = 100;

/** Моменты замера: фон, 2–3 минуты, 10 и 30 минут печати, потом стоп. */
const TICKS: [number, string][] = [
  [32, "фон"],
  [85, "2–3 мин"],
  [135, "10 мин"],
  [190, "30 мин"],
];

const STOP_X = 226;

/** Без вытяжки: рост, плато и медленный спад. */
const WITHOUT = "32,96 88,68 140,60 196,58 248,74 292,84";
/** С вытяжкой: та же печать, но воздух возвращается к фону. */
const WITH = "32,96 88,88 140,84 196,82 248,96 292,98";

const NOTES = [
  "фон: проветри 15 минут и запиши показания",
  "замер на 10-й и 30-й минуте, потом +10 и +40",
  "возврат за 10–15 минут — хватает притока и створки",
  "держится час и дольше — нужна местная вытяжка",
];

/**
 * Кадр блока 15 урока C1 «Замер: фон и печать».
 *
 * График замера: сначала фон, потом подъём через две-три минуты, плато и спад.
 * Вторая линия — та же печать с вытяжкой. Моменты замера и пороги — из блока 14:
 * проветрить пятнадцать минут и записать фон, замер на 10-й и 30-й минуте печати,
 * потом через 10 и 40 минут после остановки; возврат к фону за 10–15 минут значит,
 * что хватает притока, а если воздух держится час и дольше — нужна местная вытяжка.
 */
export function ConfidentC1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Замер: фон и печать. График с двумя линиями. Без вытяжки: фон, подъём через две-три минуты, плато и медленный спад. С вытяжкой: та же печать, но воздух возвращается к фону за 10–15 минут. Замеры делают на 10-й и 30-й минуте печати, потом через 10 и 40 минут после остановки. Фон записывают после пятнадцати минут проветривания. Если воздух держится час и дольше, нужна местная вытяжка"
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
          Замер: фон и печать
        </text>

        <rect
          x="12"
          y="20"
          width="296"
          height="96"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />

        {/* Две линии: без вытяжки и с вытяжкой */}
        <rect x="24" y="26" width="8" height="8" rx="2" fill="#f87171" fillOpacity="0.7" />
        <text x="36" y="33" fontSize="10" fill="#cbd5e1">
          без вытяжки
        </text>
        <rect x="150" y="26" width="8" height="8" rx="2" fill="#10b981" fillOpacity="0.7" />
        <text x="162" y="33" fontSize="10" fill="#cbd5e1">
          с вытяжкой
        </text>

        {/* Оси и момент остановки печати */}
        <line x1={AXIS_X} y1="44" x2={AXIS_X} y2={AXIS_Y} stroke="#475569" />
        <line x1={AXIS_X} y1={AXIS_Y} x2="300" y2={AXIS_Y} stroke="#475569" />
        <line
          x1={STOP_X}
          y1="44"
          x2={STOP_X}
          y2={AXIS_Y}
          stroke="#64748b"
          strokeDasharray="3 3"
        />
        <text x={STOP_X} y="54" fontSize="10" fill="#94a3b8" textAnchor="middle">
          стоп
        </text>

        <polyline points={WITHOUT} fill="none" stroke="#f87171" strokeWidth="1.5" />
        <polyline points={WITH} fill="none" stroke="#10b981" strokeWidth="1.5" />

        {/* Моменты замера */}
        {TICKS.map(([x, label]) => (
          <g key={label}>
            <line x1={x} y1={AXIS_Y} x2={x} y2={AXIS_Y + 4} stroke="#64748b" />
            <text x={x} y="112" fontSize="10" fill="#94a3b8" textAnchor="middle">
              {label}
            </text>
          </g>
        ))}

        {/* Что делать с этими цифрами */}
        <rect
          x="12"
          y="124"
          width="296"
          height="46"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="22"
            y={136 + index * 11}
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
