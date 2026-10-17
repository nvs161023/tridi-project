import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Окно слайсера: 18…146, строка заголовка 16, пять строк через 18. */
const WIN_Y = 18;
const WIN_H = 128;
const BAR_H = 16;
const ROW_TOP = 48;
const ROW_STEP = 18;
const LABEL_X = 128;
const VALUE_X = 296;

/** Деталь в миниатюре: полка с куполом, 40…104 по X, 66…128 по Y. */
const MODEL = "M40,128 L40,80 Q40,66 56,66 L88,66 Q104,66 104,80 L104,128 Z";
/** Слои предпросмотра: толстые внизу (шаг 8), тонкие наверху (шаг 4). */
const COARSE_Y = [120, 112, 104, 96, 88];
const FINE_Y = [83, 79, 75, 71];

type Row = { label: string; value: string; color?: string };

/** Что настроить в окне высоты — блоки 25 и 26. */
const ROWS: Row[] = [
  { label: "Min", value: "0,12 мм", color: "#10b981" },
  { label: "Max", value: "0,28 мм", color: "#f59e0b" },
  { label: "Quality", value: "середина" },
  { label: "Smooth", value: "вкл." },
  { label: "Mode", value: "Adaptive" },
];

const NOTES = [
  "Сглаживание включай всегда",
  "Первый слой — никогда",
];

/**
 * Кадр блока 25 урока C6 «Окно переменной высоты».
 *
 * Макет окна из описания кадра `C6_vlh_settings.png`: Orca, Variable Layer Height,
 * минимум 0,12 мм и максимум 0,28 мм. Остальные строки — блок 26: ползунок
 * качества ставят на середину, сглаживание включают всегда, режим адаптивный,
 * а первый слой переменной высоте не отдают никогда. Слева — предпросмотр с той
 * же логикой, что в разрезе: толстые слои внизу, тонкие на куполе.
 */
export function ConfidentC6Screenshot1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Окно переменной высоты слоя Variable Layer Height в Orca. Минимум 0,12 миллиметра, максимум 0,28 миллиметра. Ползунок качества на середине, сглаживание включено, режим адаптивный. Слева предпросмотр: толстые слои внизу, тонкие на куполе. Сглаживание включай всегда. Первый слой переменной высоте не отдают никогда"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <clipPath id="c6VlhWinModel">
            <path d={MODEL} />
          </clipPath>
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
        <rect x="12" y={WIN_Y} width="296" height={BAR_H} rx="8" fill="#1e293b" fillOpacity="0.8" />
        {[22, 29, 36].map((cx) => (
          <circle key={cx} cx={cx} cy={WIN_Y + 8} r="2" fill="#475569" />
        ))}
        <text x="48" y={WIN_Y + 12} fontSize="10" fontWeight="700" fill="#e2e8f0">
          Variable Layer Height
        </text>
        <line x1="12" y1={WIN_Y + BAR_H} x2="308" y2={WIN_Y + BAR_H} stroke="#475569" />

        {/* Предпросмотр: те же слои, что в разрезе */}
        <rect
          x="16"
          y="36"
          width="104"
          height="104"
          rx="4"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />
        <path d={MODEL} fill="#334155" fillOpacity="0.45" stroke="#64748b" />
        <g clipPath="url(#c6VlhWinModel)">
          {COARSE_Y.map((y) => (
            <line key={y} x1="38" y1={y} x2="106" y2={y} stroke="#60a5fa" strokeOpacity="0.7" />
          ))}
          {FINE_Y.map((y) => (
            <line key={y} x1="38" y1={y} x2="106" y2={y} stroke="#10b981" strokeOpacity="0.6" />
          ))}
        </g>
        <text x="68" y="136" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          0,28 → 0,12
        </text>

        {/* Пять строк окна; границы выделены */}
        {ROWS.map((row, index) => {
          const y = ROW_TOP + index * ROW_STEP;
          return (
            <g key={row.label}>
              {row.color ? (
                <rect
                  x="124"
                  y={y - 11}
                  width="176"
                  height="16"
                  rx="3"
                  fill={row.color}
                  fillOpacity="0.12"
                  stroke={row.color}
                  strokeOpacity="0.35"
                />
              ) : null}
              <text x={LABEL_X} y={y} fontSize="10" fill="#cbd5e1">
                {row.label}
              </text>
              <text
                x={VALUE_X}
                y={y}
                fontSize="10"
                fontWeight={row.color ? "700" : "400"}
                fill={row.color ?? "#e2e8f0"}
                textAnchor="end"
              >
                {row.value}
              </text>
            </g>
          );
        })}

        {/* Что помнить про окно */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={160 + index * 12}
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
