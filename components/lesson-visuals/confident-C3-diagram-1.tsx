import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Первая минута: ряды 26…130, шаг 36, высота 32; значок времени — 16…64. */
const ROW_Y = [26, 62, 98];
const ROW_H = 32;
const CHIP_X = 16;
const CHIP_W = 48;
const CHIP_CX = 40;
const TEXT_X = 72;

type Phase = { time: string; title: string; note: string; color: string };

/** Отрезки первой минуты и действия — блок 13; «112» и выход — блоки 12 и 13. */
const PHASES: Phase[] = [
  {
    time: "0–10 с",
    title: "Пауза и вилка",
    note: "пауза нагрев не снимает — снимает вилка",
    color: "#f59e0b",
  },
  {
    time: "10–30 с",
    title: "Смотрим, откуда дым",
    note: "из сопла, из корпуса или из розетки",
    color: "#3b82f6",
  },
  {
    time: "30–60 с",
    title: "Маленький огонь — огнетушитель",
    note: "целься в основание пламени, не в дым",
    color: "#10b981",
  },
];

const NOTES = [
  "Дым из корпуса — выход, закрыть дверь, 112",
  "Дверцу не открывай: воздух раздует пламя",
  "Через 10 минут проверь: тление возвращается",
];

/**
 * Кадр блока 14 урока C3 «Первая минута по секундам».
 *
 * Таймлайн из описания кадра `C3_first_minute.png` и шагов блока 13: первые
 * 0–10 секунд уходят на паузу и вилку, потому что пауза нагрев не снимает;
 * 10–30 секунд смотрят, откуда дым, — из сопла, из корпуса или из розетки;
 * 30–60 секунд маленький огонь тушат огнетушителем, целясь в основание
 * пламени. Нижние строки — блок 13: при дыме из корпуса выходят, закрывают
 * дверь и звонят 112, камеру не открывают, чтобы воздух не раздул пламя, а
 * через десять минут проверяют, не вернулось ли тление.
 */
export function ConfidentC3Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Первая минута по секундам. 0–10 секунд: пауза и вилка, потому что пауза нагрев не снимает, а вилка снимает. 10–30 секунд: смотрим, откуда дым — из сопла, из корпуса или из розетки. 30–60 секунд: маленький огонь тушат огнетушителем, целясь в основание пламени, а не в дым. Дым из корпуса — выход, закрыть дверь и звонить 112; камеру не открывать, воздух раздует пламя; через десять минут проверить, не вернулось ли тление"
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
          Первая минута: что делать по секундам
        </text>

        {/* Отрезки времени: от паузы к огнетушителю и выходу */}
        {PHASES.map((phase, index) => {
          const y = ROW_Y[index];
          const next = index + 1 < PHASES.length ? ROW_Y[index + 1] : null;
          return (
            <g key={phase.time}>
              <rect
                x="12"
                y={y}
                width="296"
                height={ROW_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <rect
                x={CHIP_X}
                y={y + 7}
                width={CHIP_W}
                height="18"
                rx="4"
                fill={phase.color}
                fillOpacity="0.16"
                stroke={phase.color}
                strokeOpacity="0.55"
              />
              <text x={CHIP_CX} y={y + 20} fontSize="10" fill={phase.color} textAnchor="middle">
                {phase.time}
              </text>
              {next !== null && (
                <line
                  x1={CHIP_CX}
                  y1={y + 25}
                  x2={CHIP_CX}
                  y2={next + 7}
                  stroke="#475569"
                  strokeOpacity="0.7"
                  strokeDasharray="3 3"
                />
              )}
              <text x={TEXT_X} y={y + 14} fontSize="11" fontWeight="700" fill={phase.color}>
                {phase.title}
              </text>
              <text x={TEXT_X} y={y + 27} fontSize="10" fill="#cbd5e1">
                {phase.note}
              </text>
            </g>
          );
        })}

        {/* Что делать, если дым идёт из корпуса */}
        <rect
          x="12"
          y="134"
          width="296"
          height="36"
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
            y={145 + index * 11}
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
