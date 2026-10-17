import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** Тело макроса: шесть строк от y=98 с шагом 14. */
const BODY_Y = [98, 112, 126, 140, 154, 168];

const BODY = [
  "[gcode_macro START_PRINT]",
  "  G28",
  "  M140 S{BED}",
  "  M104 S{EXTRUDER}",
  "  M190 S{BED}",
  "  G1 X5 Y5 Z2 F600",
];

/**
 * Кадр блока 18 урока C11 «Вызов макроса и его тело».
 *
 * Макет из описания кадра `C11_macro_map.png`: сверху одна строка вызова из
 * слайсера, снизу тело макроса в printer.cfg. Блок 17 объясняет, что в Klipper
 * старт держат в макросе, а слайсер присылает только параметры BED и EXTRUDER.
 */
export function ConfidentC11Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Вызов макроса и его тело: в слайсере остаётся одна строка START_PRINT BED=60 EXTRUDER=210, в printer.cfg лежит макрос START_PRINT с парковкой G28, нагревом стола M140 по параметру BED, нагревом сопла M104 по параметру EXTRUDER, ожиданием M190 и подводом сопла. Одна строка вызова запускает шесть команд"
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
          слайсер → printer.cfg
        </text>

        {/* Строка вызова из слайсера */}
        <rect
          x="12"
          y="24"
          width="296"
          height="30"
          rx="5"
          fill="#0f172a"
          fillOpacity="0.5"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <text x="20" y="37" fontSize="10" fill="#94a3b8">
          слайсер
        </text>
        <text x="20" y="49" fontSize="10" fontWeight="700" fill="#fcd34d" fontFamily={MONO}>
          START_PRINT BED=60 EXTRUDER=210
        </text>

        {/* Стрелка вниз: вызов находит тело */}
        <line x1="160" y1="54" x2="160" y2="66" stroke="#64748b" />
        <polygon points="160,68 156,62 164,62" fill="#64748b" />
        <text x="168" y="64" fontSize="10" fill="#94a3b8">
          вызов
        </text>

        {/* Тело макроса в printer.cfg */}
        <rect
          x="12"
          y="68"
          width="296"
          height="104"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <text x="20" y="82" fontSize="10" fill="#94a3b8" fontFamily={MONO}>
          printer.cfg
        </text>
        <text x="300" y="82" fontSize="10" fill="#94a3b8" textAnchor="end">
          тело макроса
        </text>

        {BODY.map((line, index) => (
          <text
            key={line}
            x="20"
            y={BODY_Y[index]}
            fontSize="10"
            fill={index === 0 ? "#60a5fa" : "#cbd5e1"}
            fontWeight={index === 0 ? "700" : "400"}
            fontFamily={MONO}
          >
            {line}
          </text>
        ))}

        <text x="300" y="140" fontSize="10" fill="#f59e0b" textAnchor="end">
          параметр
        </text>
        <text x="300" y="168" fontSize="10" fill="#64748b" textAnchor="end">
          подвод сопла
        </text>
      </svg>
    </VisualWrapper>
  );
}
