import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Ширина символа моношрифта при fontSize 8 — с запасом, чтобы части строки не слиплись. */
const MONO_ADVANCE = 4.96;

/** Строки файла .gcode: номер, части строки с цветом и подпись «что делает строка». */
const CODE_LINES = [
  {
    no: "1",
    y: 48,
    parts: [
      { text: "G28", fill: "#38bdf8" },
      { text: "; парковка сопла", fill: "#6ee7b7" },
    ],
    note: "парковка в угол",
  },
  {
    no: "2",
    y: 72,
    parts: [
      { text: "G1", fill: "#38bdf8" },
      { text: "X100 Y50 Z0.2 E1.5 F1200", fill: "#94a3b8" },
    ],
    note: "движение и подача",
  },
  {
    no: "3",
    y: 96,
    parts: [
      { text: "M104", fill: "#fbbf24" },
      { text: "S210", fill: "#94a3b8" },
    ],
    note: "нагрев сопла 210",
  },
  {
    no: "4",
    y: 120,
    parts: [
      { text: "M109", fill: "#fbbf24" },
      { text: "; ждём сопло", fill: "#6ee7b7" },
    ],
    note: "ждём, потом печать",
  },
];

/** Раскладывает части строки по X: команда, затем параметры с запасом. */
function placeParts(parts: { text: string; fill: string }[], startX: number) {
  let x = startX;

  return parts.map((part) => {
    const placed = { ...part, x };
    x += part.text.length * MONO_ADVANCE + 4;

    return placed;
  });
}

/**
 * Структура G-кода: листинг .gcode с номерами строк и цветовым кодированием —
 * синие G-команды движения, жёлтые M-команды принтеру, серые параметры,
 * зелёные комментарии после «;». Справа от каждой строки подпись «что она делает».
 *
 * Ровно по content урока: «Скриншот .gcode с подсветкой: G28, G1, M104, M109.
 * Подписи: что делает каждая строка» и по примеру «G1 X100 Y50 Z0.2 E1.5 F1200 —
 * двигайся в точку X100 Y50 Z0.2, выдави 1,5 мм пластика со скоростью 1200 мм/мин».
 *
 * От блока «Arc Welding» (G-G4-animation) отличается приёмом: там два листинга
 * G1 и G2/G3 без номеров строк сравниваются по числу команд, здесь один файл с
 * номерами строк и подсветкой по типам команд, а подписи говорят о смысле строки.
 */
export function ProDD1Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Структура G-кода: листинг файла из четырёх строк с номерами — G28 с комментарием о парковке сопла, G1 X100 Y50 Z0.2 E1.5 F1200, M104 S210 и M109 с комментарием; синие команды — движение, жёлтые — команды принтеру, серые — параметры, зелёные — комментарии, справа подписи о том, что делает каждая строка"
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
          файл .gcode: что делает каждая строка
        </text>

        <rect x="10" y="26" width="172" height="100" rx="6" fill="#0f172a" stroke="#475569" />

        {CODE_LINES.map((line) => (
          <g key={`line-${line.no}`}>
            <text x="18" y={line.y} fontSize="8" fill="#475569" fontFamily={MONO}>
              {line.no}
            </text>
            {placeParts(line.parts, 32).map((part) => (
              <text
                key={`${line.no}-${part.text}`}
                x={part.x}
                y={line.y}
                fontSize="8"
                fill={part.fill}
                fontFamily={MONO}
              >
                {part.text}
              </text>
            ))}
            <text x="190" y={line.y} fontSize="9" fill="#e2e8f0">
              {line.note}
            </text>
          </g>
        ))}

        <text x="12" y="146" fontSize="9" fill="#94a3b8">
          синие — G: движение, жёлтые — M: принтеру
        </text>
        <text x="12" y="164" fontSize="9" fill="#94a3b8">
          серые — параметры, зелёные — комментарий
        </text>
      </svg>
    </VisualWrapper>
  );
}
