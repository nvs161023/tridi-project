import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три схемы: полоса 12…308, ряды 20…150, шаг 44, высота ряда 42. */
const ROW_Y = [20, 64, 108];
const ROW_H = 42;
const CHIP_X = 34;
const TEXT_X = 52;
const TAG_X = 300;

type Scheme = {
  name: string;
  tag: string;
  line1: string;
  line2: string;
  color: string;
};

/** Схемы и цены — блоки 4, 5, 10 и 17; порядок механизмов — блок 1. */
const SCHEMES: Scheme[] = [
  {
    name: "Вытяжка в окно",
    tag: "→ на улицу",
    line1: "воздух уходит из комнаты целиком",
    line2: "быстрый и дешёвый: вентилятор 1–2 тыс. ₽",
    color: "#10b981",
  },
  {
    name: "Фильтр-бокс с рециркуляцией",
    tag: "↺ в комнату",
    line1: "HEPA ловит частицы, уголь берёт газы",
    line2: "готовый 5–15 тыс. ₽, свой — 4–8 тыс. ₽",
    color: "#3b82f6",
  },
  {
    name: "Вывод в вентканал",
    tag: "→ в канал",
    line1: "свой путь через стену или окно",
    line2: "не в общий канал с газовыми приборами",
    color: "#f59e0b",
  },
];

const NOTES = [
  "Проветривание — то же удаление, но без вентилятора",
  "Нужен приток: створка или зазор под дверью",
];

/**
 * Кадр блока 4 урока C2 «Схемы вентиляции».
 *
 * Три схемы из описания кадра `C2_vent_schemes.png`: вытяжка в окно,
 * фильтр-бокс с рециркуляцией и вывод в вентканал. Цены — из списков блоков 5 и
 * 10 (канальный вентилятор 1–2 тыс. ₽, вытяжка в окно 2–6 тыс. ₽, готовый бокс
 * 5–15 тыс. ₽, собранный своими руками 4–8 тыс. ₽). Оговорка про общий канал —
 * из блока 17: вытяжку нельзя заводить в вентканал, где работают газовые приборы
 * (обратная тяга и CO). Нижняя строка — блок 1: проветривание то же удаление, но
 * без вентилятора, а вытяжка без притока работает вхолостую.
 */
export function ConfidentC2Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Схемы вентиляции — три варианта. Вытяжка в окно: воздух уходит из комнаты целиком, вентилятор стоит 1–2 тыс. ₽. Фильтр-бокс с рециркуляцией: HEPA ловит частицы, уголь берёт газы, готовый бокс 5–15 тыс. ₽, собранный своими руками 4–8 тыс. ₽. Вывод в вентканал: свой путь через стену или окно, но не в общий канал с газовыми приборами. Проветривание — то же удаление, но без вентилятора, и в любом варианте нужен приток: створка или зазор под дверью"
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
          Три схемы вентиляции: куда уходит воздух
        </text>

        {/* Схемы сверху вниз: от простой вытяжки к каналу */}
        {SCHEMES.map((scheme, index) => {
          const y = ROW_Y[index];
          return (
            <g key={scheme.name}>
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
              <circle
                cx={CHIP_X}
                cy={y + 21}
                r="9"
                fill={scheme.color}
                fillOpacity="0.18"
                stroke={scheme.color}
                strokeOpacity="0.7"
              />
              <text
                x={CHIP_X}
                y={y + 25}
                fontSize="10"
                fill={scheme.color}
                textAnchor="middle"
              >
                {index + 1}
              </text>
              <text x={TEXT_X} y={y + 14} fontSize="12" fontWeight="700" fill={scheme.color}>
                {scheme.name}
              </text>
              <text x={TAG_X} y={y + 14} fontSize="10" fill={scheme.color} textAnchor="end">
                {scheme.tag}
              </text>
              <text x={TEXT_X} y={y + 28} fontSize="10" fill="#cbd5e1">
                {scheme.line1}
              </text>
              <text x={TEXT_X} y={y + 39} fontSize="10" fill="#94a3b8">
                {scheme.line2}
              </text>
            </g>
          );
        })}

        {/* Проветривание и приток: без притока вытяжка работает вхолостую */}
        <rect
          x="12"
          y="154"
          width="296"
          height="24"
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
            y={164 + index * 11}
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
