import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Строки Start G-code из урока: команда и комментарий после «;». */
const GCODE = [
  { y: 72, parts: [{ text: "G28", fill: "#38bdf8" }, { text: "; парковка", fill: "#6ee7b7" }] },
  { y: 86, parts: [{ text: "M104", fill: "#fbbf24" }, { text: "S210", fill: "#94a3b8" }] },
  { y: 100, parts: [{ text: "M140", fill: "#fbbf24" }, { text: "S60", fill: "#94a3b8" }] },
  { y: 114, parts: [{ text: "M109", fill: "#fbbf24" }, { text: "; ждём", fill: "#6ee7b7" }] },
  { y: 128, parts: [{ text: "M190", fill: "#fbbf24" }, { text: "; ждём", fill: "#6ee7b7" }] },
  { y: 142, parts: [{ text: "G1 X10 Y10 Z0.2 F3000", fill: "#38bdf8" }] },
];

/** Ширина символа моношрифта при fontSize 7.5. */
const MONO_ADVANCE = 4.65;

/** Раскладывает части строки по X, чтобы команда и параметры не слипались. */
function placeParts(parts: { text: string; fill: string }[], startX: number) {
  let x = startX;

  return parts.map((part) => {
    const placed = { ...part, x };
    x += part.text.length * MONO_ADVANCE + 4;

    return placed;
  });
}

/**
 * Стартовый код в слайсере: окно Orca, слева дерево настроек с подсвеченным
 * путём Machine Settings → Start G-code, справа поле Start G-code с шестью
 * строками кода и комментариями.
 *
 * Ровно по content урока: «Скриншот Orca: вкладка Machine Settings → Start
 * G-code. Типовой код с комментариями» (G28, M104 S210, M140 S60, M109, M190,
 * G1 X10 Y10 Z0.2 F3000 — из текста блока «Типовой стартовый код»).
 *
 * От тринадцати «окон» проекта отличается деревом настроек: в остальных кадрах
 * либо ряд интерфейсов (F-F1-image), либо узкая панель параметров (G-G1/G2/G3/G4,
 * H-H4, I-I3). Здесь единственный кадр с иерархией настроек и подсвеченным
 * пунктом, куда вставляют стартовый код.
 */
export function ProDD2Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Стартовый код в слайсере: в окне Orca слева дерево настроек Printer и Machine Settings с подсвеченным пунктом Start G-code, справа поле Start G-code с шестью строками — G28 с комментарием о парковке, M104 S210, M140 S60, M109, M190 и G1 X10 Y10 Z0.2 F3000"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
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

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Start G-code: где он лежит в слайсере
        </text>

        {/* Окно слайсера: шапка с «кнопками» и две области */}
        <rect x="10" y="26" width="300" height="130" rx="6" fill="#0f172a" stroke="#475569" />
        <rect x="11" y="27" width="298" height="9" fill="#334155" />
        <line x1="17" y1="31.5" x2="23" y2="31.5" stroke="#64748b" strokeWidth="1.4" />
        <line x1="29" y1="31.5" x2="35" y2="31.5" stroke="#64748b" strokeWidth="1.4" />
        <line x1="41" y1="31.5" x2="47" y2="31.5" stroke="#64748b" strokeWidth="1.4" />

        {/* Дерево настроек: путь до Start G-code подсвечен */}
        <rect x="14" y="40" width="82" height="110" rx="4" fill="#1e293b" />
        <text x="20" y="56" fontSize="7.5" fill="#cbd5e1">
          Printer
        </text>
        <text x="24" y="72" fontSize="7.5" fill="#cbd5e1">
          Machine Settings
        </text>
        <rect x="16" y="80" width="4" height="12" fill="#38bdf8" />
        <text x="28" y="88" fontSize="7.5" fill="#7dd3fc">
          Start G-code
        </text>
        <text x="28" y="104" fontSize="7.5" fill="#cbd5e1">
          End G-code
        </text>

        {/* Поле Start G-code: шесть строк кода с комментариями */}
        <rect x="104" y="40" width="204" height="110" rx="4" fill="#0f172a" stroke="#334155" />
        <text x="112" y="54" fontSize="8" fill="#93c5fd">
          Start G-code
        </text>
        {GCODE.map((row) =>
          placeParts(row.parts, 112).map((part) => (
            <text
              key={`${row.y}-${part.text}`}
              x={part.x}
              y={row.y}
              fontSize="7.5"
              fill={part.fill}
              fontFamily={MONO}
            >
              {part.text}
            </text>
          )),
        )}

        <text x="12" y="174" fontSize="9" fill="#94a3b8">
          порядок: парковка → нагрев → ожидание → очистка
        </text>
      </svg>
    </VisualWrapper>
  );
}
