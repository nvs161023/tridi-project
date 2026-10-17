import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** Окно настроек: 12…308 по X, 18…150 по Y, заголовок 16. */
const WIN_Y = 18;
const WIN_H = 132;
const BAR_H = 16;
const NAV_X = 16;
const NAV_Y = [48, 64, 80, 96, 112, 128];
const CODE_X = 114;
const CODE_Y = [48, 61, 74, 87, 100, 113, 126, 139];

type CodeRow = { text: string; comment?: boolean; key?: boolean };

/** Старт из блока 10: парковка, прогрев, обнуление экструдера и priming. */
const CODE: CodeRow[] = [
  { text: "; парковка", comment: true },
  { text: "G28" },
  { text: "M140 S60" },
  { text: "M104 S210", key: true },
  { text: "G92 E0" },
  { text: "G1 X5 Y5 Z2 F600" },
  { text: "G1 E15 F300" },
  { text: "; priming", comment: true },
];

const NAV = ["Печать", "Старт G-кода", "Финал G-кода", "Принтер", "Материалы", "Скорость"];

/** Строка кода в поле редактора: комментарии тише команд. */
function codeColor(row: CodeRow) {
  if (row.key) return "#fcd34d";
  if (row.comment) return "#64748b";
  return "#cbd5e1";
}

/**
 * Кадр блока 10 урока C11 «Стартовый код в настройках слайсера».
 *
 * Макет из описания кадра `C11_start_code_ui.png`: окно настроек принтера,
 * слева список разделов с выбранным «Старт G-кода», справа свой код с
 * комментариями. Блок 9 объясняет, зачем нужен свой старт, блок 12 — почему
 * парковка идёт до нагрева стола.
 */
export function ConfidentC11Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Стартовый код в настройках слайсера: окно настроек принтера, слева разделы печати с выбранным пунктом «Старт G-кода», справа свой код с комментариями. В коде парковка G28, нагрев стола M140 S60, нагрев сопла M104 S210, обнуление экструдера и priming. Сначала парковка, потом нагрев — иначе нули по Z уедут"
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
          свой старт для одного принтера
        </text>

        {/* Окно настроек */}
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
          Настройки принтера
        </text>
        <text x="300" y={WIN_Y + 12} fontSize="10" fill="#94a3b8" textAnchor="end">
          профиль PLA
        </text>
        <line x1="12" y1={WIN_Y + BAR_H} x2="308" y2={WIN_Y + BAR_H} stroke="#475569" />

        {/* Список разделов: выбран старт */}
        {NAV.map((item, index) => (
          <g key={item}>
            {index === 1 ? (
              <>
                <rect
                  x="14"
                  y={NAV_Y[index] - 11}
                  width="86"
                  height="15"
                  rx="3"
                  fill="#60a5fa"
                  fillOpacity="0.12"
                  stroke="#60a5fa"
                  strokeOpacity="0.4"
                />
                <rect x="14" y={NAV_Y[index] - 11} width="2" height="15" fill="#60a5fa" />
              </>
            ) : null}
            <text
              x={NAV_X}
              y={NAV_Y[index]}
              fontSize="10"
              fill={index === 1 ? "#e2e8f0" : "#94a3b8"}
              fontWeight={index === 1 ? "700" : "400"}
            >
              {item}
            </text>
          </g>
        ))}
        <line x1="106" y1="38" x2="106" y2="146" stroke="#334155" />

        {/* Поле кода */}
        {CODE.map((row, index) => (
          <text
            key={row.text}
            x={CODE_X}
            y={CODE_Y[index]}
            fontSize="10"
            fill={codeColor(row)}
            fontWeight={row.key ? "700" : "400"}
            fontFamily={MONO}
          >
            {row.text}
          </text>
        ))}

        <text x="12" y="160" fontSize="10" fill="#94a3b8">
          Свой старт вместо заводского: парковка, прогрев, очистка
        </text>
        <text x="12" y="174" fontSize="10" fill="#64748b">
          Первой идёт парковка — потом нагрев стола
        </text>
      </svg>
    </VisualWrapper>
  );
}
