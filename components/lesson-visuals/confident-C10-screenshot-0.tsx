import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Окно заполнения: 12…308 по X, 18…128 по Y, заголовок 16. */
const WIN_Y = 18;
const WIN_H = 110;
const BAR_H = 16;
const ROW_TOP = 52;
const ROW_STEP = 20;
const LABEL_X = 196;
const VALUE_X = 304;

type Row = { label: string; value: string; key?: boolean };

/** Плотность, форма, линия и перекрытие — блок 15. */
const ROWS: Row[] = [
  { label: "Плотность", value: "20 %", key: true },
  { label: "Форма", value: "gyroid" },
  { label: "Линия", value: "0,4 мм" },
  { label: "Перекрытие", value: "15 %" },
];

/** Волны гироида в предпросмотре: 4 линии по 12 точек. */
const PREVIEW_WAVES = [54, 76, 98, 120].map((x) =>
  Array.from({ length: 12 }, (_, index) => {
    const y = 48 + index * 5;
    const wave = 4 * Math.sin(index * 0.9);
    return `${(x + wave).toFixed(1)},${y}`;
  }).join(" "),
);

/**
 * Кадр блока 15 урока C10 «Окно заполнения в слайсере».
 *
 * Макет из описания кадра `C10_infill_ui.png`: слева разрез с решёткой, справа
 * четыре поля — плотность, форма узора, толщина линии и перекрытие. Значения из
 * блока 6: 20 % гироида тяжелее 20 % сетки, а линия уже сопла даёт дырчатую
 * решётку, поэтому её оставляют равной диаметру сопла.
 */
export function ConfidentC10Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Окно заполнения в слайсере: плотность 20 %, форма gyroid, толщина линии 0,4 мм и перекрытие 15 %. Слева разрез детали с решёткой внутри. Проценты считают от объёма внутри стенок, поэтому 20 % гироида тяжелее 20 % сетки. Форма отвечает за прочность, проценты — за плотность. Линию оставляют равной диаметру сопла"
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
          окно заполнения
        </text>

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
          Заполнение
        </text>
        <text x={VALUE_X} y={WIN_Y + 12} fontSize="10" fill="#94a3b8" textAnchor="end">
          профиль: PLA
        </text>
        <line x1="12" y1={WIN_Y + BAR_H} x2="308" y2={WIN_Y + BAR_H} stroke="#475569" />

        {/* Предпросмотр разреза */}
        <rect
          x="16"
          y="38"
          width="172"
          height="82"
          rx="4"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />
        <rect
          x="44"
          y="46"
          width="116"
          height="66"
          fill="#1e293b"
          fillOpacity="0.6"
          stroke="#64748b"
        />
        {[50, 53].map((x) => (
          <g key={x}>
            <line x1={x} y1="46" x2={x} y2="112" stroke="#cbd5e1" strokeOpacity="0.7" />
            <line
              x1={44 + 116 - (x - 44)}
              y1="46"
              x2={44 + 116 - (x - 44)}
              y2="112"
              stroke="#cbd5e1"
              strokeOpacity="0.7"
            />
          </g>
        ))}
        {PREVIEW_WAVES.map((points) => (
          <polyline key={points} points={points} fill="none" stroke="#10b981" strokeOpacity="0.6" />
        ))}

        {/* Поля окна; плотность — ключевая */}
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
                  fill="#f59e0b"
                  fillOpacity="0.12"
                  stroke="#f59e0b"
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
                fill={row.key ? "#fcd34d" : "#e2e8f0"}
                textAnchor="end"
              >
                {row.value}
              </text>
            </g>
          );
        })}

        <text x="12" y="142" fontSize="10" fontWeight="700" fill="#e2e8f0">
          Проценты считают от объёма внутри стенок
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          Форма отвечает за прочность, проценты — за плотность
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          35 % гироида не хуже 40 % сетки
        </text>
      </svg>
    </VisualWrapper>
  );
}
