import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Окно Cut: 12…308 по X, строка заголовка 16, четыре строки через 20. */
const WIN_Y = 18;
const WIN_H = 110;
const BAR_H = 16;
const ROW_TOP = 52;
const ROW_STEP = 20;
const LABEL_X = 196;
const VALUE_X = 304;

type Row = { label: string; value: string; key?: boolean };

/** Плоскость, соединитель, зазор и число частей — блок 11 и цифры блоков 16 и 22. */
const ROWS: Row[] = [
  { label: "Плоскость", value: "по центру" },
  { label: "Соединитель", value: "шип-паз", key: true },
  { label: "Зазор", value: "0,25 мм" },
  { label: "Части", value: "2" },
];

const NOTES = [
  "Плоскость — по нейтральной зоне, не по отверстию",
  "Предпросмотр обеих частей — до печати",
];

/**
 * Кадр блока 11 урока C7 «Окно Cut: плоскость и соединители».
 *
 * Макет окна из описания кадра `C7_cut_ui.png`: слева предпросмотр двух частей
 * с плоскостью реза и шипом в стыке, справа четыре поля — плоскость, тип
 * соединителя, зазор и число частей. Соединитель выбирается в том же окне,
 * что и плоскость (блок 11), зазор 0,25 мм взят из рабочей таблицы (блок 22),
 * а плоскость ставят по нейтральной зоне, подальше от отверстий (блок 9).
 */
export function ConfidentC7Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Окно Cut: плоскость и соединители. Слева предпросмотр двух частей: между ними плоскость разреза и шип в стыке. Справа четыре поля: плоскость по центру, соединитель шип-паз, зазор 0,25 миллиметра, части 2. Плоскость ставят по нейтральной зоне, а не по отверстию. Предпросмотр обеих частей смотрят до печати"
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
          Cut — плоскость и соединитель
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

        {/* Две части с зазором и шипом в стыке */}
        <rect x="30" y="64" width="56" height="44" rx="2" fill="#334155" fillOpacity="0.7" stroke="#64748b" />
        <rect x="94" y="64" width="56" height="44" rx="2" fill="#334155" fillOpacity="0.7" stroke="#64748b" />
        <rect x="72" y="81" width="24" height="7" rx="1" fill="#10b981" fillOpacity="0.35" stroke="#10b981" />
        <rect
          x="94"
          y="78"
          width="14"
          height="13"
          rx="1"
          fill="none"
          stroke="#10b981"
          strokeDasharray="3 2"
        />

        {/* Плоскость реза */}
        <line x1="90" y1="46" x2="90" y2="116" stroke="#f59e0b" strokeDasharray="4 3" />
        <text x="90" y="50" fontSize="10" fontWeight="700" fill="#fcd34d" textAnchor="middle">
          плоскость
        </text>

        {/* Подписи частей */}
        <text x="58" y="120" fontSize="10" fill="#94a3b8" textAnchor="middle">
          часть 1
        </text>
        <text x="122" y="120" fontSize="10" fill="#94a3b8" textAnchor="middle">
          часть 2
        </text>

        {/* Поля окна; соединитель — ключевое */}
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
                  fill="#10b981"
                  fillOpacity="0.12"
                  stroke="#10b981"
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
                fill={row.key ? "#10b981" : "#e2e8f0"}
                textAnchor="end"
              >
                {row.value}
              </text>
            </g>
          );
        })}

        {/* Правила реза */}
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
