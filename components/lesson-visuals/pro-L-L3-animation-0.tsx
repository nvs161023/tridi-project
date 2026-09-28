import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре стадии морфинга: класс, подпись строки и время до уверенного уровня. */
const STAGES = [
  { cls: "v-ll3a-s1", row: "Tinkercad — неделя", dot: 0 },
  { cls: "v-ll3a-s2", row: "OpenSCAD — месяц", dot: 1 },
  { cls: "v-ll3a-s3", row: "Fusion — 2–3 месяца", dot: 2 },
  { cls: "v-ll3a-s4", row: "Blender — 3–6 месяцев", dot: 3 },
];

/** Плавная органическая форма: силуэт из десяти точек. */
const ORGANIC = "88,96 98,80 114,72 132,74 146,84 150,98 142,110 124,116 104,112 92,104";

/** Мелкие детали-скульпт по краю формы. */
const SCULPT_BITS = [
  [96, 78],
  [118, 70],
  [140, 78],
  [148, 98],
  [126, 114],
  [100, 108],
];

/**
 * Прогресс: одна и та же модель на одном месте проходит четыре стадии —
 * примитивы Tinkercad, фасочная деталь с размерными линиями в Fusion, плавная
 * органическая форма в Blender и мелкие детали-скульпт в ZBrush. Справа колонка
 * ступеней времени: неделя, месяц, 2–3 месяца, 3–6 месяцев — активная строка
 * подсвечивается вместе со стадией.
 *
 * Ровно по content урока: «От простого к сложному. Tinkercad → Fusion → Blender →
 * ZBrush» и по list «Время до уверенного уровня»: Tinkercad неделя, OpenSCAD
 * месяц, Fusion 2–3 месяца, Blender 3–6 месяцев.
 *
 * От D3-animation (десять действий по шагам) и E-хим2 (вертикальные потоки)
 * отличается тем, что здесь нет ни списка, ни потоков: сцена одна, предмет один,
 * меняется только его форма. От лестницы шкурки M-M7-image-0 — тоже: там пять
 * отдельных листов, здесь один морфящий силуэт.
 *
 * Анимация 10 с, по кругу. При prefers-reduced-motion показана последняя стадия.
 *
 * Классы с префиксом v-ll3a: <style> внутри SVG действует на всю страницу.
 */
export function ProLL3Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация прогресса: одна модель на одном месте превращается по стадиям — примитивы Tinkercad, фасочная деталь с размерными линиями в Fusion, плавная органическая форма в Blender и форма с мелкими деталями-скульптом в ZBrush; справа колонка времени до уверенного уровня — неделя, месяц, 2–3 месяца, 3–6 месяцев, активная строка подсвечивается"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-ll3a-s1 { animation: v-ll3a-first 10s ease-in-out infinite; }
          .v-ll3a-s2 { animation: v-ll3a-morph 10s ease-in-out 2.5s infinite; animation-fill-mode: backwards; }
          .v-ll3a-s3 { animation: v-ll3a-morph 10s ease-in-out 5s infinite; animation-fill-mode: backwards; }
          .v-ll3a-s4 { animation: v-ll3a-morph 10s ease-in-out 7.5s infinite; animation-fill-mode: backwards; }
          .v-ll3a-r1 { animation: v-ll3a-row-first 10s linear infinite; }
          .v-ll3a-r2 { animation: v-ll3a-row 10s linear 2.5s infinite; animation-fill-mode: backwards; }
          .v-ll3a-r3 { animation: v-ll3a-row 10s linear 5s infinite; animation-fill-mode: backwards; }
          .v-ll3a-r4 { animation: v-ll3a-row 10s linear 7.5s infinite; animation-fill-mode: backwards; }
          @keyframes v-ll3a-first {
            0%, 16% { opacity: 1; }
            24%, 100% { opacity: 0; }
          }
          @keyframes v-ll3a-morph {
            0% { opacity: 0; }
            8%, 16% { opacity: 1; }
            24%, 100% { opacity: 0; }
          }
          @keyframes v-ll3a-row-first {
            0%, 16% { opacity: 1; }
            24%, 100% { opacity: 0.25; }
          }
          @keyframes v-ll3a-row {
            0% { opacity: 0.25; }
            8%, 16% { opacity: 1; }
            24%, 100% { opacity: 0.25; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-ll3a-s1, .v-ll3a-s2, .v-ll3a-s3 { animation: none; opacity: 0; }
            .v-ll3a-s4 { animation: none; opacity: 1; }
            .v-ll3a-r1, .v-ll3a-r2, .v-ll3a-r3 { animation: none; opacity: 0.25; }
            .v-ll3a-r4 { animation: none; opacity: 1; }
          }
        `}</style>

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
          Прогресс: от простого к сложному
        </text>

        {/* Сцена, где одна модель меняет форму */}
        <rect x="60" y="52" width="140" height="84" rx="6" fill="#1e293b" />


        {/* Стадия 1: примитивы Tinkercad */}
        <g className="v-ll3a-s1">
          <polygon points="90,102 120,88 150,100 120,114" fill="#475569" />
          <polygon points="90,102 120,88 120,96 90,110" fill="#64748b" />
          <circle cx="108" cy="99" r="4" fill="#0f172a" />
          <polygon points="132,88 144,82 144,92 132,98" fill="#64748b" />
        </g>

        {/* Стадия 2: фасочная деталь с размерными линиями в Fusion */}
        <g className="v-ll3a-s2" stroke="#94a3b8" strokeWidth="1" fill="none">
          <polygon points="88,104 116,88 150,96 150,104 118,114 88,110" fill="#475569" />
          <line x1="112" y1="92" x2="146" y2="100" />
          <line x1="88" y1="120" x2="118" y2="118" />
          <line x1="88" y1="116" x2="88" y2="124" />
          <line x1="118" y1="114" x2="118" y2="122" />
        </g>

        {/* Стадия 3: плавная органическая форма в Blender */}
        <g className="v-ll3a-s3">
          <polygon points={ORGANIC} fill="#475569" />
        </g>

        {/* Стадия 4: форма с мелкими деталями-скульптом в ZBrush */}
        <g className="v-ll3a-s4">
          <polygon points={ORGANIC} fill="#64748b" />
          {SCULPT_BITS.map(([cx, cy]) => (
            <circle key={`bit-${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="#94a3b8" />
          ))}
        </g>

        {/* Колонка ступеней времени */}
        <text x="220" y="36" fontSize="7.5" fill="#94a3b8">
          уверенный уровень
        </text>
        <rect x="204" y="52" width="7" height="96" rx="3" fill="#1e293b" />
        {STAGES.map((stage, index) => (
          <g key={stage.row}>
            <line
              x1="204"
              y1={60 + index * 24}
              x2="211"
              y2={60 + index * 24}
              stroke="#475569"
            />
            <rect
              x="214"
              y={52 + index * 24}
              width="94"
              height="14"
              rx="3"
              fill="#334155"
              className={`v-ll3a-r${index + 1}`}
            />
            <text x="220" y={60 + index * 24} fontSize="7.5" fill="#e2e8f0">
              {stage.row}
            </text>
          </g>
        ))}

        <text x="12" y="160" fontSize="7.5" fill="#e2e8f0">
          одна модель — четыре уровня
        </text>
        <text x="12" y="174" fontSize="7.5" fill="#94a3b8">
          форма усложняется, программа меняется
        </text>
      </svg>
    </VisualWrapper>
  );
}
