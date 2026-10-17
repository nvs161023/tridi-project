import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** Окно редактора: 184 px шириной, строки с шагом 12 от y=54. */
const ROW_Y = [54, 66, 78, 90, 102, 114, 126, 138, 150, 162];
const ROW_X = 48;

type Row = { text: string; marker?: boolean };

/** Строки вокруг закладки: слой 119 кончился, начался слой 120. */
const ROWS: Row[] = [
  { text: "G1 X84.2 Y51 E1.02" },
  { text: "G1 X96.8 Y51 E1.09" },
  { text: ";LAYER:119" },
  { text: "G1 Z23.8" },
  { text: "G1 X84.2 Y51 E1.02" },
  { text: ";LAYER:120", marker: true },
  { text: ";Z:24.0" },
  { text: "G1 X84.2 Y51 E1.02" },
  { text: "G1 X96.8 Y51 E1.09" },
  { text: "M204 S800" },
];

/** Девять слоёв в разрезе: подсвечен тот, с которого начинается слой 120. */
const LAYER_Y = [44, 52, 60, 68, 76, 84, 92, 100, 108];

/**
 * Кадр блока 7 урока C11 «Закладка слоя в тексте файла».
 *
 * Макет из описания кадра `C11_layer_marker.png`: слева окно редактора с
 * номерами строк и подсвеченной строкой `;LAYER:120`, справа разрез слоёв, где
 * эта закладка открывает новый слой на высоте 24,0 мм. Блок 5 объясняет, что
 * Cura пишет `;LAYER:`, а Orca и PrusaSlicer — `;LAYER_CHANGE` и `;Z:`.
 */
export function ConfidentC11Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Закладка слоя в тексте файла: окно редактора с номерами строк, вокруг строки LAYER:120 идут команды движения и Z 24.0. Строка LAYER:120 подсвечена — с неё начинается новый слой. Справа разрез из девяти слоёв, нужный слой отмечен на высоте 24,0 мм. Поиск по такой закладке занимает секунды"
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
          текст файла вокруг слоя 120
        </text>

        {/* Окно редактора */}
        <rect
          x="12"
          y="24"
          width="184"
          height="146"
          rx="8"
          fill="#0f172a"
          fillOpacity="0.55"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <rect x="12" y="24" width="184" height="14" rx="6" fill="#1e293b" fillOpacity="0.9" />
        {[22, 29, 36].map((cx) => (
          <circle key={cx} cx={cx} cy="31" r="2" fill="#475569" />
        ))}
        <text x="48" y="35" fontSize="10" fill="#94a3b8" fontFamily={MONO}>
          part.gcode
        </text>

        <line x1="44" y1="38" x2="44" y2="170" stroke="#334155" />

        {ROWS.map((row, index) => {
          const y = ROW_Y[index];
          return (
            <g key={row.text + index}>
              {row.marker ? (
                <>
                  <rect
                    x="44"
                    y={y - 10}
                    width="148"
                    height="13"
                    fill="#f59e0b"
                    fillOpacity="0.14"
                  />
                  <rect x="44" y={y - 10} width="2" height="13" fill="#f59e0b" />
                </>
              ) : null}
              <text x="40" y={y} fontSize="10" fill="#475569" textAnchor="end">
                {index + 1}
              </text>
              <text
                x={ROW_X}
                y={y}
                fontSize="10"
                fill={row.marker ? "#fcd34d" : "#cbd5e1"}
                fontWeight={row.marker ? "700" : "400"}
                fontFamily={MONO}
              >
                {row.text}
              </text>
            </g>
          );
        })}

        {/* Разрез слоёв справа */}
        {LAYER_Y.map((y, index) => (
          <line
            key={y}
            x1="204"
            y1={y}
            x2="246"
            y2={y}
            stroke={index === 4 ? "#f59e0b" : "#64748b"}
            strokeWidth={index === 4 ? "2" : "1"}
            strokeOpacity={index === 4 ? "1" : "0.6"}
          />
        ))}
        <text x="252" y="74" fontSize="10" fontWeight="700" fill="#fcd34d">
          слой 120
        </text>
        <text x="252" y="88" fontSize="10" fill="#e2e8f0">
          24,0 мм
        </text>
        <text x="252" y="102" fontSize="10" fill="#94a3b8">
          0,2 мм
        </text>

        <text x="204" y="130" fontSize="10" fill="#cbd5e1">
          закладка слайсера
        </text>
        <text x="204" y="144" fontSize="10" fill="#94a3b8">
          поиск за секунды
        </text>
        <text x="204" y="158" fontSize="10" fill="#94a3b8">
          слой 119 → 120
        </text>
        <text x="204" y="172" fontSize="10" fill="#64748b">
          по номеру слоя
        </text>
      </svg>
    </VisualWrapper>
  );
}
