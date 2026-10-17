import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Окно настроек: 12…308 по X, 18…128 по Y, заголовок 16. */
const WIN_Y = 18;
const WIN_H = 110;
const BAR_H = 16;
const ROW_TOP = 50;
const ROW_STEP = 22;
const LABEL_X = 176;
const VALUE_X = 304;

type Row = { label: string; value: string; key?: boolean; check?: boolean };

/** Настройка и три соседних поля — блоки 28–30. */
const ROWS: Row[] = [
  { label: "Print Thin Walls", value: "вкл", key: true, check: true },
  { label: "Ширина линии", value: "0,40 мм" },
  { label: "Стенка", value: "0,30 мм" },
  { label: "Слой", value: "0,12–0,16 мм" },
];

/**
 * Кадр блока 29 урока C10 «Print Thin Walls в слайсере».
 *
 * Макет из описания кадра `C10_thin_walls_ui.png`: галочка Print Thin Walls рядом
 * с шириной линии. Слева две стенки без настройки и с ней: без галочки в
 * предпросмотре остаётся дырка, с галочкой проходит узкая линия. Граница из
 * блока 28 — стенка тоньше 0,8 мм при сопле 0,4, а слой для неё берут 0,12–0,16 мм.
 */
export function ConfidentC10Screenshot1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Окно слайсера с галочкой Print Thin Walls: настройка включена, ширина линии 0,40 мм, тонкая стенка 0,30 мм, слой 0,12–0,16 мм. Слева две стенки: без настройки в предпросмотре дырка, с настройкой проходит узкая линия. Граница тонкой стенки — 0,8 мм при сопле 0,4 мм, а слой для неё берут 0,12–0,16 мм при скорости 20–30 мм/с"
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
          Print Thin Walls в слайсере
        </text>

        {/* Окно настроек */}
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
          Качество — ширина линии
        </text>
        <line x1="12" y1={WIN_Y + BAR_H} x2="308" y2={WIN_Y + BAR_H} stroke="#475569" />

        {/* Предпросмотр: стенка без настройки и с настройкой */}
        <rect
          x="16"
          y="38"
          width="132"
          height="82"
          rx="4"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />
        <text x="20" y="50" fontSize="10" fill="#94a3b8">
          стенка 0,3 мм
        </text>

        {/* Без настройки: дырка в стенке */}
        <rect x="24" y="58" width="20" height="46" fill="#475569" stroke="#64748b" />
        <rect x="56" y="58" width="20" height="46" fill="#475569" stroke="#64748b" />
        <rect
          x="44"
          y="58"
          width="12"
          height="46"
          fill="#f87171"
          fillOpacity="0.12"
          stroke="#f87171"
          strokeDasharray="3 2"
        />
        <text x="50" y="116" fontSize="10" fill="#94a3b8" textAnchor="middle">
          выкл
        </text>

        {/* С настройкой: узкая линия вместо дырки */}
        <rect x="92" y="58" width="20" height="46" fill="#475569" stroke="#64748b" />
        <rect x="124" y="58" width="20" height="46" fill="#475569" stroke="#64748b" />
        <line x1="118" y1="58" x2="118" y2="104" stroke="#f59e0b" strokeWidth="2" />
        <text x="118" y="116" fontSize="10" fontWeight="700" fill="#fcd34d" textAnchor="middle">
          вкл
        </text>

        {/* Поля окна; галочка — ключевая */}
        {ROWS.map((row, index) => {
          const y = ROW_TOP + index * ROW_STEP;
          return (
            <g key={row.label}>
              {row.key ? (
                <rect
                  x="156"
                  y={y - 12}
                  width="150"
                  height="18"
                  rx="3"
                  fill="#f59e0b"
                  fillOpacity="0.12"
                  stroke="#f59e0b"
                  strokeOpacity="0.4"
                />
              ) : null}
              {row.check ? (
                <g>
                  <rect
                    x="160"
                    y={y - 9}
                    width="11"
                    height="11"
                    rx="2"
                    fill="#f59e0b"
                    fillOpacity="0.2"
                    stroke="#f59e0b"
                  />
                  <path
                    d={`M162.5 ${y - 3.5} L165 ${y - 0.5} L169 ${y - 6}`}
                    fill="none"
                    stroke="#fcd34d"
                    strokeWidth="1.6"
                  />
                </g>
              ) : null}
              <text x={LABEL_X} y={y} fontSize="10" fill="#cbd5e1">
                {row.label}
              </text>
              <text
                x={VALUE_X}
                y={y}
                fontSize="10"
                fontWeight={row.key ? "700" : "400"}
                fill={row.key ? "#fcd34d" : "#e2e8f0"}
                textAnchor="end"
              >
                {row.value}
              </text>
            </g>
          );
        })}

        <text x="12" y="142" fontSize="10" fontWeight="700" fill="#e2e8f0">
          Print Thin Walls печатает стенку уже сопла
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          Слой 0,12–0,16 мм и скорость 20–30 мм/с
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          Или сопло 0,25 мм — стенка 0,3–0,35 мм
        </text>
      </svg>
    </VisualWrapper>
  );
}
