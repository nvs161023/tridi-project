import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Окно постобработки: 12…308 по X, 18…136 по Y. */
const WIN_Y = 18;
const WIN_H = 118;
const BAR_H = 16;
const LIST_X = 20;
const LIST_Y = [52, 68, 84, 100];
const ROW_Y = [52, 70, 88, 106];
const LABEL_X = 116;
const VALUE_X = 304;

type Row = { label: string; value: string; key?: boolean };

/** Поля скрипта Pause at height из блока 21. */
const ROWS: Row[] = [
  { label: "Высота", value: "24,0 мм", key: true },
  { label: "Отвод", value: "5 мм" },
  { label: "Парковка", value: "X 10 · Y 10" },
  { label: "Слой", value: "120" },
];

const SCRIPTS = ["Pause at height", "Change filament", "Insert G-code", "Timelapse"];

/** Метки шкалы высоты: 16…196 с шагом 15. */
const TICKS = Array.from({ length: 13 }, (_, index) => 16 + index * 15);

/**
 * Кадр блока 22 урока C11 «Постобработка в слайсере».
 *
 * Макет из описания кадра `C11_post_ui.png`: окно постобработки со скриптом
 * Pause at height, поля высоты, отвода и парковки, а внизу шкала высоты с
 * отметкой M600. Блок 21 объясняет, что правка живёт в профиле и переживает
 * новую нарезку.
 */
export function ConfidentC11Screenshot1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Постобработка в слайсере: окно постобработки, слева список скриптов с выбранным Pause at height, справа поля высоты 24,0 мм, отвода 5 мм, парковки X 10 Y 10 и слоя 120. Внизу шкала высоты с отметкой M600 на нужном слое. Правка живёт в профиле слайсера, поэтому её не затирает новая нарезка"
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
          скрипт Pause at height
        </text>

        <rect
          x="12"
          y={WIN_Y}
          width="296"
          height={WIN_H}
          rx="8"
          fill="#0f172a"
          fillOpacity="0.55"
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
          fillOpacity="0.9"
        />
        {[22, 29, 36].map((cx) => (
          <circle key={cx} cx={cx} cy={WIN_Y + 8} r="2" fill="#475569" />
        ))}
        <text x="48" y={WIN_Y + 12} fontSize="10" fontWeight="700" fill="#e2e8f0">
          Постобработка
        </text>
        <text x="300" y={WIN_Y + 12} fontSize="10" fill="#94a3b8" textAnchor="end">
          профиль PLA
        </text>
        <line x1="12" y1={WIN_Y + BAR_H} x2="308" y2={WIN_Y + BAR_H} stroke="#475569" />

        {/* Список скриптов; выбран Pause at height */}
        {SCRIPTS.map((script, index) => (
          <g key={script}>
            {index === 0 ? (
              <rect
                x="16"
                y={LIST_Y[index] - 11}
                width="90"
                height="15"
                rx="3"
                fill="#f59e0b"
                fillOpacity="0.12"
                stroke="#f59e0b"
                strokeOpacity="0.4"
              />
            ) : null}
            <text
              x={LIST_X}
              y={LIST_Y[index]}
              fontSize="10"
              fill={index === 0 ? "#fcd34d" : "#94a3b8"}
              fontWeight={index === 0 ? "700" : "400"}
            >
              {script}
            </text>
          </g>
        ))}
        <line x1="112" y1="38" x2="112" y2="128" stroke="#334155" />

        {/* Поля скрипта */}
        {ROWS.map((row, index) => {
          const y = ROW_Y[index];
          return (
            <g key={row.label}>
              {row.key ? (
                <rect
                  x="112"
                  y={y - 11}
                  width="192"
                  height="16"
                  fill="#f59e0b"
                  fillOpacity="0.08"
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

        {/* Шкала высоты с отметкой M600 */}
        <line x1="16" y1="160" x2="196" y2="160" stroke="#475569" />
        {TICKS.map((x) => (
          <line key={x} x1={x} y1="156" x2={x} y2="164" stroke="#475569" strokeOpacity="0.7" />
        ))}
        <line x1="112" y1="146" x2="112" y2="166" stroke="#f59e0b" strokeWidth="2" />
        <text x="116" y="152" fontSize="10" fontWeight="700" fill="#fcd34d">
          M600
        </text>
        <text x="204" y="152" fontSize="10" fill="#cbd5e1">
          на высоте 24 мм
        </text>
        <text x="204" y="166" fontSize="10" fill="#94a3b8">
          слой 120
        </text>

        <text x="12" y="174" fontSize="10" fill="#64748b">
          Слайсер сам вставляет команду в нужный слой
        </text>
      </svg>
    </VisualWrapper>
  );
}
