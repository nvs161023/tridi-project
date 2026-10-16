import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре карточки 2 × 2: 12…158 и 162…308, ряды 20 и 62. */
const CARD_X = [12, 162];
const CARD_Y = [20, 62];
const CARD_W = 146;
const CARD_H = 40;
const TEXT_X = 38;

const LEAD = "сомневаешься — бери ту, что печатается за час";
const LEAD_NOTE = "и ту, что после печати поддаётся замеру";
const NOTES = [
  "слой до 0,3 мм у вазы · мост 10–15 мм у брелока",
  "первая деталь — ниже 80 мм, посадки с зазором 0,2–0,3 мм",
];

type Detail = {
  name: string;
  time: string;
  color: string;
  icon: (x: number, y: number) => string;
};

/** Четыре детали из блока 4: время печати и расход каждой. */
const DETAILS: Detail[] = [
  {
    name: "ваза",
    time: "40–90 мин · 30–50 г",
    color: "#38bdf8",
    icon: (x, y) => `M${x + 5} ${y + 3} L${x + 19} ${y + 3} L${x + 16} ${y + 21} L${x + 8} ${y + 21} Z`,
  },
  {
    name: "подставка",
    time: "1–2 ч · 40–60 г",
    color: "#a78bfa",
    icon: (x, y) => `M${x + 3} ${y + 19} L${x + 21} ${y + 19} M${x + 8} ${y + 19} L${x + 14} ${y + 5}`,
  },
  {
    name: "лоток",
    time: "1,5–3 ч · 50–80 г",
    color: "#f59e0b",
    icon: (x, y) => `M${x + 2} ${y + 8} L${x + 22} ${y + 8} L${x + 22} ${y + 20} L${x + 2} ${y + 20} Z M${x + 12} ${y + 8} L${x + 12} ${y + 20}`,
  },
  {
    name: "брелок",
    time: "10–25 мин · 5–15 г",
    color: "#10b981",
    icon: (x, y) => `M${x + 4} ${y + 8} L${x + 20} ${y + 8} L${x + 20} ${y + 20} L${x + 4} ${y + 20} Z`,
  },
];

/**
 * Кадр блока 4 урока L8 «Четыре детали, с которых начинают».
 *
 * Четыре карточки с силуэтом, временем печати и расходом: ваза 40–90 минут и
 * 30–50 г, подставка 1–2 часа и 40–60 г, лоток 1,5–3 часа и 50–80 г, брелок
 * 10–25 минут и 5–15 г. Снизу правило выбора и границы, за которые на первой
 * детали лучше не выходить.
 *
 * Числа — из блоков 3, 4 и 6: слой толще 0,3 мм рвёт стенку вазы, мост длиннее
 * 10–15 мм заплывает у брелока, деталь выше 100–120 мм — это рычаг, первая
 * деталь должна быть ниже 80 мм, посадки берут с зазором 0,2–0,3 мм.
 */
export function Basic8Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Четыре детали первого проекта: ваза — 40–90 минут и 30–50 граммов, подставка под инструмент — 1–2 часа и 40–60 граммов, лоток или органайзер — 1,5–3 часа и 50–80 граммов, брелок с отверстием — 10–25 минут и 5–15 граммов. Сомневаешься между двумя деталями — бери ту, что печатается за час и после печати поддаётся замеру. Границы: слой до 0,3 мм у вазы, мост 10–15 мм у брелока, первая деталь ниже 80 мм, посадки с зазором 0,2–0,3 мм"
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
          Четыре детали первого проекта: что тренирует каждая
        </text>

        {/* Четыре карточки: силуэт, время и расход */}
        {DETAILS.map((detail, index) => {
          const x0 = CARD_X[index % 2];
          const y0 = CARD_Y[Math.floor(index / 2)];
          return (
            <g key={detail.name}>
              <rect
                x={x0}
                y={y0}
                width={CARD_W}
                height={CARD_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <path
                d={detail.icon(x0 + 8, y0 + 8)}
                fill="none"
                stroke={detail.color}
                strokeWidth="1.5"
              />
              <text x={x0 + TEXT_X} y={y0 + 17} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {detail.name}
              </text>
              <text x={x0 + TEXT_X} y={y0 + 30} fontSize="10" fill="#94a3b8">
                {detail.time}
              </text>
            </g>
          );
        })}

        {/* Правило выбора и границы первой детали */}
        <rect
          x="12"
          y="106"
          width="296"
          height="24"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="118" fontSize="10" fontWeight="700" fill="#e2e8f0">
          {LEAD}
        </text>
        <text x="22" y="128" fontSize="10" fill="#94a3b8">
          {LEAD_NOTE}
        </text>
        {NOTES.map((note, index) => (
          <g key={note}>
            <rect
              x="12"
              y={134 + index * 24}
              width="296"
              height={index === 1 ? 18 : 20}
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text x="22" y={147 + index * 24} fontSize="10" fill="#94a3b8">
              {note}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
