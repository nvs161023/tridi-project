import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const PARTS = ["1 имя", "2 описание", "3 параметры", "4 тело", "5 вызов"];

const CODE = [
  { text: "[gcode_macro START_PRINT]", fill: "#38bdf8" },
  { text: "description: старт печати", fill: "#94a3b8" },
  { text: "params.BED default(60)", fill: "#a78bfa" },
  { text: "{% set %} · {% if %}", fill: "#a78bfa" },
  { text: "gcode: M140 S{bed}", fill: "#e2e8f0" },
  { text: "M109 S{ext}", fill: "#e2e8f0" },
];

/**
 * Кадр блока 4 урока IN10 «Макросы Klipper и постобработка».
 *
 * Макет из описания `IN10_macro_anatomy.png`: пять частей макроса — имя, описание,
 * параметры, тело и вызов. Состав секции — блок 5, правило «макрос описывает
 * процедуру, а не деталь» — блок 1.
 */
export function EngineerIN10Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анатомия макроса из пяти частей: секция gcode_macro START_PRINT, строка description, параметры params.BED с фильтром default 60, переменные set и ветки if, тело gcode с нагревом стола и сопла, вызов из стартового кода слайсера. Макрос описывает процедуру, а не деталь, а файл с макросами подключается через include"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          анатомия макроса: пять частей
        </text>

        <rect x="12" y="26" width="180" height="104" rx="7" fill="#0f172a" fillOpacity="0.6" stroke="#334155" />
        {CODE.map((line, i) => (
          <text key={line.text} x="20" y={42 + i * 16} fontSize="10" fill={line.fill}>
            {line.text}
          </text>
        ))}

        <path d="M196 34 V124" stroke="#334155" strokeWidth="0.8" strokeDasharray="2 3" />
        {PARTS.map((part, i) => {
          const y = 40 + i * 18;
          return (
            <g key={part}>
              <circle cx="205" cy={y - 3.5} r="8" fill="#1e293b" stroke="#38bdf8" strokeOpacity="0.6" />
              <text x="205" y={y} fontSize="10" fill="#38bdf8" textAnchor="middle">
                {i + 1}
              </text>
              <text x="218" y={y} fontSize="10" fill="#e2e8f0">
                {part.slice(2)}
              </text>
            </g>
          );
        })}

        <rect x="12" y="138" width="296" height="33" rx="6" fill="#38bdf8" fillOpacity="0.08" stroke="#38bdf8" strokeOpacity="0.3" />
        <text x="22" y="151" fontSize="10" fill="#e2e8f0">
          макрос описывает процедуру, а не деталь
        </text>
        <text x="22" y="166" fontSize="10" fill="#94a3b8">
          include macros.cfg · вызов BED=60 EXTRUDER=210
        </text>
      </svg>
    </VisualWrapper>
  );
}
