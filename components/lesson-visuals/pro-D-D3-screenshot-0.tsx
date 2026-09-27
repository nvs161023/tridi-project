import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Строка файла: заголовок секции (без кода) или строка кода из двух частей. */
type Row =
  | { y: number; kind: "section"; text: string }
  | { y: number; kind: "code"; parts: [{ text: string; fill: string }, { text: string; fill: string }] };

/** Ширина символа моношрифта при fontSize 7.5. */
const MONO_75 = 4.65;

/** Три секции printer.cfg: макрос и две строки кода внутри каждой. */
const ROWS: Row[] = [
  { y: 38, kind: "section", text: "[gcode_macro START_PRINT]" },
  { y: 52, kind: "code", parts: [{ text: "M140", fill: "#fbbf24" }, { text: "S{BED}", fill: "#94a3b8" }] },
  { y: 66, kind: "code", parts: [{ text: "M104", fill: "#fbbf24" }, { text: "S{EXTRUDER}", fill: "#94a3b8" }] },
  { y: 80, kind: "section", text: "[gcode_macro END_PRINT]" },
  { y: 94, kind: "code", parts: [{ text: "M104", fill: "#fbbf24" }, { text: "S0", fill: "#94a3b8" }] },
  { y: 108, kind: "code", parts: [{ text: "G28", fill: "#38bdf8" }, { text: "X0", fill: "#94a3b8" }] },
  { y: 122, kind: "section", text: "[gcode_macro PAUSE]" },
  { y: 136, kind: "code", parts: [{ text: "G91", fill: "#38bdf8" }, { text: "; вниз", fill: "#6ee7b7" }] },
  { y: 150, kind: "code", parts: [{ text: "G1", fill: "#38bdf8" }, { text: "E-5", fill: "#94a3b8" }] },
];

/** Подписи справа — по одной на секцию, на высоте её заголовка. */
const NOTES = [
  { y: 38, text: "нагрев и печать" },
  { y: 80, text: "стоп и парковка" },
  { y: 122, text: "пауза в середине" },
];

/**
 * printer.cfg с макросами: один вертикальный файл-лист — три секции в общей
 * рамке, у каждой моноширинный заголовок в квадратных скобках и две строки кода,
 * справа подпись «что делает макрос», внизу связка «вызов из слайсера → секция».
 *
 * Ровно по content урока: «Скриншот printer.cfg: секции [gcode_macro START_PRINT],
 * [gcode_macro END_PRINT], [gcode_macro PAUSE]. Подписи: что делает каждый» и по
 * примеру START_PRINT с параметрами BED и EXTRUDER.
 *
 * От карточек-колонок в ряд (B-B4-image — три прошивки, E1-E1-1 — пять катушек,
 * B-B2 — покрытия) отличается тем, что здесь одна рамка-файл и секции внутри неё
 * друг под другом, а не отдельные плитки рядом.
 */
export function ProDD3Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="printer.cfg с макросами Klipper: один файл-лист из трёх секций — gcode_macro START_PRINT с нагревом стола и сопла по параметрам, gcode_macro END_PRINT с выключением сопла и парковкой, gcode_macro PAUSE с отводом пластика; справа подписи, внизу связка — вызов START_PRINT с параметрами BED и EXTRUDER ведёт в секцию файла"
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
          printer.cfg: три макроса в одном файле
        </text>

        <rect x="10" y="24" width="200" height="130" rx="6" fill="#0f172a" stroke="#475569" />

        {ROWS.filter((row) => row.kind === "section").map((row) => (
          <rect key={`plate-${row.y}`} x="16" y={row.y - 7} width="188" height="13" fill="#1e293b" />
        ))}

        {ROWS.map((row) =>
          row.kind === "section" ? (
            <text
              key={`section-${row.y}`}
              x="20"
              y={row.y}
              fontSize="8"
              fill="#7dd3fc"
              fontFamily={MONO}
            >
              {row.text}
            </text>
          ) : (
            <g key={`code-${row.y}`}>
              <text x="28" y={row.y} fontSize="7.5" fill={row.parts[0].fill} fontFamily={MONO}>
                {row.parts[0].text}
              </text>
              <text
                x={28 + row.parts[0].text.length * MONO_75 + 4}
                y={row.y}
                fontSize="7.5"
                fill={row.parts[1].fill}
                fontFamily={MONO}
              >
                {row.parts[1].text}
              </text>
            </g>
          ),
        )}

        {NOTES.map((note) => (
          <text key={`note-${note.y}`} x="218" y={note.y} fontSize="7.5" fill="#e2e8f0">
            {note.text}
          </text>
        ))}

        <text x="12" y="170" fontSize="9" fill="#94a3b8">
          вызов START_PRINT BED=60 EXTRUDER=210 → секция
        </text>
      </svg>
    </VisualWrapper>
  );
}
