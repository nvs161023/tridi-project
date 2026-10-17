import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Окно ironing: 12…308 по X, заголовок 16, четыре строки через 20. */
const WIN_Y = 18;
const WIN_H = 110;
const BAR_H = 16;
const ROW_TOP = 52;
const ROW_STEP = 20;
const LABEL_X = 196;
const VALUE_X = 304;

type Row = { label: string; value: string; key?: boolean };

/** Настройки ironing из описания кадра `C8_ironing_ui.png` и блока 17. */
const ROWS: Row[] = [
  { label: "Ironing", value: "только верх", key: true },
  { label: "Поток", value: "10 %" },
  { label: "Скорость", value: "20 мм/с" },
  { label: "Шаг", value: "0,1 мм" },
];

const NOTES = [
  "Поток 10 %, скорость 20 мм/с — старт",
  "Проверяй на площадке 30 × 30 мм",
];

/**
 * Кадр блока 18 урока C8 «Настройки ironing в слайсере».
 *
 * Макет окна из описания кадра `C8_ironing_ui.png`: слева сопло проходит по
 * верхней площадке, справа четыре поля — область ironing, поток, скорость и шаг
 * линий. Значения из блока 17: ironing включают только на верхних слоях, поток
 * 10 %, скорость 20 мм/с, шаг 0,1 мм. Проверяют результат на площадке 30 × 30 мм,
 * а не на всей детали.
 */
export function ConfidentC8Screenshot1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Настройки ironing в слайсере. Слева сопло проходит по верхней площадке детали. Справа четыре поля: ironing включён только для верхних слоёв, поток 10 процентов, скорость 20 миллиметров в секунду, шаг линий 0,1 миллиметра. Поток 10 процентов и скорость 20 миллиметров в секунду — стартовые значения. Проверяй результат на площадке 30 на 30 миллиметров"
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

        {/* Окно с заголовком */}
        <rect
          x="12"
          y={WIN_Y}
          width="296"
          height={WIN_H}
          rx="8"
          fill="#0f172a"
          fillOpacity="0.5"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <rect
          x="12"
          y={WIN_Y}
          width="296"
          height={BAR_H}
          rx="8"
          fill="#1e293b"
          fillOpacity="0.8"
        />
        {[22, 29, 36].map((cx) => (
          <circle key={cx} cx={cx} cy={WIN_Y + 8} r="2" fill="#475569" />
        ))}
        <text x="48" y={WIN_Y + 12} fontSize="10" fontWeight="700" fill="#e2e8f0">
          Ironing — верхние слои
        </text>
        <text x={VALUE_X} y={WIN_Y + 12} fontSize="10" fill="#94a3b8" textAnchor="end">
          профиль: PLA
        </text>
        <line x1="12" y1={WIN_Y + BAR_H} x2="308" y2={WIN_Y + BAR_H} stroke="#475569" />

        {/* Область предпросмотра */}
        <rect
          x="16"
          y="38"
          width="172"
          height="86"
          rx="4"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />

        {/* Деталь и разглаженная площадка сверху */}
        <rect x="44" y="74" width="100" height="44" rx="2" fill="#334155" fillOpacity="0.7" stroke="#64748b" />
        <rect x="44" y="74" width="100" height="6" fill="#60a5fa" fillOpacity="0.3" stroke="#60a5fa" />
        {[76.5, 78.5].map((y) => (
          <line
            key={y}
            x1="48"
            y1={y}
            x2="140"
            y2={y}
            stroke="#93c5fd"
            strokeOpacity="0.5"
          />
        ))}

        {/* Сопло и ход по площадке */}
        <polygon points="86,52 102,52 104,66 84,66" fill="#475569" stroke="#94a3b8" />
        <rect x="84" y="66" width="20" height="4" fill="#f59e0b" fillOpacity="0.7" stroke="#f59e0b" />
        <text x="110" y="60" fontSize="10" fill="#94a3b8">
          сопло
        </text>
        <line x1="80" y1="46" x2="66" y2="46" stroke="#94a3b8" strokeOpacity="0.7" />
        <polyline points="70,42 66,46 70,50" fill="none" stroke="#94a3b8" strokeOpacity="0.7" />
        <line x1="108" y1="46" x2="122" y2="46" stroke="#94a3b8" strokeOpacity="0.7" />
        <polyline points="118,42 122,46 118,50" fill="none" stroke="#94a3b8" strokeOpacity="0.7" />

        {/* Поля окна; область ironing — ключевая */}
        {ROWS.map((row, index) => {
          const y = ROW_TOP + index * ROW_STEP;
          return (
            <g key={row.label}>
              {row.key ? (
                <rect
                  x="192"
                  y={y - 11}
                  width="114"
                  height="16"
                  rx="3"
                  fill="#60a5fa"
                  fillOpacity="0.12"
                  stroke="#60a5fa"
                  strokeOpacity="0.4"
                />
              ) : null}
              <text x={LABEL_X} y={y} fontSize="10" fill="#cbd5e1">
                {row.label}
              </text>
              <text
                x={VALUE_X}
                y={y}
                fontSize="10"
                fontWeight={row.key ? "700" : "400"}
                fill={row.key ? "#93c5fd" : "#e2e8f0"}
                textAnchor="end"
              >
                {row.value}
              </text>
            </g>
          );
        })}

        {/* Правила проверки */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={146 + index * 16}
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
