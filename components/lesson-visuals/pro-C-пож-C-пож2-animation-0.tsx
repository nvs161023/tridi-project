import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пять строк матрицы: СИЗ, которые надевают. */
const ROWS = [
  { id: "respirator", label: "респиратор", cy: 56.5 },
  { id: "goggles", label: "очки", cy: 77.5 },
  { id: "gloves", label: "перчатки", cy: 98.5 },
  { id: "apron", label: "фартук", cy: 119.5 },
  { id: "hood", label: "вытяжка", cy: 140.5 },
];

/** Три столбца матрицы: работы, под которые подбирают СИЗ. */
const COLUMNS = [
  {
    id: "abs",
    x: 130,
    center: 160,
    cls: "v-cpzh2a-col-1",
    lines: [
      { id: "print", text: "печать", y: 28 },
      { id: "abs", text: "ABS", y: 39 },
    ],
  },
  {
    id: "sanding",
    x: 190,
    center: 220,
    cls: "v-cpzh2a-col-2",
    lines: [{ id: "sand", text: "шкурка", y: 33 }],
  },
  {
    id: "chem",
    x: 250,
    center: 280,
    cls: "v-cpzh2a-col-3",
    lines: [
      { id: "epoxy", text: "эпоксидка", y: 28 },
      { id: "chem", text: "+ химия", y: 39 },
    ],
  },
];

/** Шесть точек: пересечение СИЗ и работы, для которой оно обязательно. */
const DOTS = [
  { id: "respirator-abs", cls: "v-cpzh2a-dots-1", cx: 160, cy: 56.5 },
  { id: "respirator-sanding", cls: "v-cpzh2a-dots-2", cx: 220, cy: 56.5 },
  { id: "goggles-sanding", cls: "v-cpzh2a-dots-2", cx: 220, cy: 77.5 },
  { id: "gloves-chem", cls: "v-cpzh2a-dots-3", cx: 280, cy: 98.5 },
  { id: "apron-chem", cls: "v-cpzh2a-dots-3", cx: 280, cy: 119.5 },
  { id: "hood-chem", cls: "v-cpzh2a-dots-3", cx: 280, cy: 140.5 },
];

/** Горизонтали и вертикали сетки: 5 × 3, строка — СИЗ, столбец — работа. */
const ROW_LINES = [67, 88, 109, 130];
const COL_LINES = [190, 250];

/**
 * «Матрица» — пять строк СИЗ и три столбца работ, шесть точек на пересечениях.
 * Подсветка столбцов и появление точек идут по очереди (6 секунд): сначала
 * печать ABS, потом шкурка, потом эпоксидка с химией.
 *
 * От basic-10 (плитки «иконка + подпись», шесть плиток с глазом, ухом, маской)
 * отличается тем, что это не набор плиток, а пересечения: строки и столбцы
 * читаются как «для чего» и «что надеть». От C2-3, C2-4 и C2-5 (схема из блоков,
 * коммутационная панель и матрица пинов с подписями по краям) — тем, что
 * подсвечиваются столбцы целиком, а смысл несут точки, а не подписи-легенды.
 */
export function ProCPozhCPozh2Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Матрица пять на три: строки — респиратор, очки, перчатки, фартук и вытяжка, столбцы — печать ABS, шкурка, эпоксидка с химией. Шесть точек показывают, что для печати ABS нужен респиратор, для шкурки — респиратор и очки, для эпоксидки и химии — перчатки, фартук и вытяжка. Столбцы подсвечиваются по очереди."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-cpzh2a-col-1 { opacity: 0; animation: v-cpzh2a-col-1 6s linear infinite; }
          .v-cpzh2a-col-2 { opacity: 0; animation: v-cpzh2a-col-2 6s linear infinite; }
          .v-cpzh2a-col-3 { opacity: 0; animation: v-cpzh2a-col-3 6s linear infinite; }
          .v-cpzh2a-dots-1 { opacity: 1; animation: v-cpzh2a-dots-1 6s linear infinite; }
          .v-cpzh2a-dots-2 { opacity: 1; animation: v-cpzh2a-dots-2 6s linear infinite; }
          .v-cpzh2a-dots-3 { opacity: 1; animation: v-cpzh2a-dots-3 6s linear infinite; }
          @keyframes v-cpzh2a-col-1 {
            0%, 30% { opacity: 1; }
            34%, 96% { opacity: 0; }
            100% { opacity: 1; }
          }
          @keyframes v-cpzh2a-col-2 {
            0%, 31% { opacity: 0; }
            35%, 63% { opacity: 1; }
            67%, 100% { opacity: 0; }
          }
          @keyframes v-cpzh2a-col-3 {
            0%, 64% { opacity: 0; }
            68%, 96% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes v-cpzh2a-dots-1 {
            0% { opacity: 0; }
            8%, 96% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes v-cpzh2a-dots-2 {
            0%, 31% { opacity: 0; }
            40%, 96% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes v-cpzh2a-dots-3 {
            0%, 64% { opacity: 0; }
            74%, 96% { opacity: 1; }
            100% { opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-cpzh2a-col-1, .v-cpzh2a-col-2, .v-cpzh2a-col-3,
            .v-cpzh2a-dots-1, .v-cpzh2a-dots-2, .v-cpzh2a-dots-3 { animation: none; }
            .v-cpzh2a-col-1 { opacity: 1; }
            .v-cpzh2a-dots-1, .v-cpzh2a-dots-2, .v-cpzh2a-dots-3 { opacity: 1; }
          }
        `}</style>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Матрица: что надеть для какой работы
        </text>

        {/* Поле матрицы: строки — СИЗ, столбцы — работы */}
        <rect x="130" y="46" width="180" height="105" fill="#0f172a" fillOpacity="0.4" stroke="#475569" strokeWidth="1.2" />
        {ROW_LINES.map((y) => (
          <line key={`row-${y}`} x1="130" y1={y} x2="310" y2={y} stroke="#475569" strokeWidth="0.8" />
        ))}
        {COL_LINES.map((x) => (
          <line key={`col-${x}`} x1={x} y1="46" x2={x} y2="151" stroke="#475569" strokeWidth="0.8" />
        ))}

        {/* Подсветка столбца идёт по кругу: печать ABS → шкурка → химия */}
        {COLUMNS.map((col) => (
          <rect
            key={`hl-${col.id}`}
            x={col.x}
            y="46"
            width="60"
            height="105"
            fill="#38bdf8"
            fillOpacity="0.07"
            className={col.cls}
          />
        ))}

        {/* Шапка столбцов: работа, под которую подбирают СИЗ */}
        {COLUMNS.map((col) => (
          <rect
            key={`pill-${col.id}`}
            x={col.x + 4}
            y="18"
            width="52"
            height="26"
            rx="4"
            fill="#fbbf24"
            fillOpacity="0.1"
            stroke="#fbbf24"
            strokeWidth="0.9"
            className={col.cls}
          />
        ))}
        {COLUMNS.map((col) =>
          col.lines.map((line) => (
            <text key={`${col.id}-${line.id}`} x={col.center} y={line.y} fontSize="7.5" fill="#e2e8f0" textAnchor="middle">
              {line.text}
            </text>
          )),
        )}

        {/* Подписи строк: СИЗ, которые надевают */}
        {ROWS.map((row) => (
          <text key={row.id} x="126" y={row.cy + 3} fontSize="7.5" fill="#e2e8f0" textAnchor="end">
            {row.label}
          </text>
        ))}

        {/* Точки на пересечениях: СИЗ обязательно для этой работы */}
        {DOTS.map((dot) => (
          <g key={dot.id} className={dot.cls}>
            <circle cx={dot.cx} cy={dot.cy} r="8.5" fill="#38bdf8" fillOpacity="0.18" />
            <circle cx={dot.cx} cy={dot.cy} r="4.5" fill="#38bdf8" />
          </g>
        ))}

        <text x="12" y="166" fontSize="8" fill="#94a3b8">
          точка на пересечении: вещь нужна для этой работы
        </text>
      </svg>
    </VisualWrapper>
  );
}
