import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Три строки программы: подсветку строки задаёт класс, у каждой свой цвет команды. */
const CODE = [
  { text: "G1 X50 Y40 F1200", y: 64, className: "v-dd1a-l1" },
  { text: "M104 S210", y: 86, className: "v-dd1a-l2" },
  { text: "G28", y: 108, className: "v-dd1a-l3" },
];

/**
 * Как строка G-кода превращается в движение: слева панель с тремя строками
 * программы, справа — вид сверху на стол, где сопло выполняет действие
 * подсвеченной строки. Сначала G1 — сопло едет и тянет линию пластика, затем
 * M104 — у сопла появляется 210 °C, в конце G28 — сопло уходит в угол парковки.
 *
 * Ровно по content урока: «Строка G-кода → команда мотору → движение сопла →
 * выдавливание пластика. Каждая строка соответствует движению».
 *
 * От «Как принтер строит модель» (basic-1-animation) отличается тем, что в кадре
 * нет стенки, слоёв и детали: показано соответствие строки и действия. От
 * «Кинематики» (A-A2-animation) — тем, что нет ремней и моторов, есть код и стол
 * сверху. Общей сцены-цикла тут нет: активна всегда ровно одна из трёх строк.
 *
 * Анимация 6 с, по кругу. Классы с префиксом v-dd1a — <style> внутри SVG
 * действует на всю страницу.
 */
export function ProDD1Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: строка G-кода превращается в движение — подсвеченная строка G1 отправляет сопло в путь и тянет линию пластика, строка M104 показывает у сопла 210 градусов, строка G28 уводит сопло в угол парковки"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-dd1a-l1 { animation: v-dd1a-hl 6s ease-in-out infinite; }
          .v-dd1a-l2 { animation: v-dd1a-hl2 6s ease-in-out infinite; }
          .v-dd1a-l3 { animation: v-dd1a-hl3 6s ease-in-out infinite; }
          .v-dd1a-nozzle { animation: v-dd1a-run 6s ease-in-out infinite; }
          .v-dd1a-trail { animation: v-dd1a-flow 1.1s linear infinite; }
          .v-dd1a-temp { animation: v-dd1a-temp 6s ease-in-out infinite; }
          @keyframes v-dd1a-hl {
            0%, 30% { opacity: 1; }
            36%, 100% { opacity: 0.35; }
          }
          @keyframes v-dd1a-hl2 {
            0%, 30% { opacity: 0.35; }
            36%, 66% { opacity: 1; }
            72%, 100% { opacity: 0.35; }
          }
          @keyframes v-dd1a-hl3 {
            0%, 70% { opacity: 0.35; }
            78%, 100% { opacity: 1; }
          }
          @keyframes v-dd1a-run {
            0% { transform: translate(0, 0); }
            28% { transform: translate(36px, 14px); }
            70% { transform: translate(36px, 14px); }
            100% { transform: translate(-56px, -32px); }
          }
          @keyframes v-dd1a-flow { to { stroke-dashoffset: -18; } }
          @keyframes v-dd1a-temp {
            0%, 34% { opacity: 0; }
            44%, 70% { opacity: 1; }
            78%, 100% { opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-dd1a-l1, .v-dd1a-l2, .v-dd1a-l3 {
              animation: none;
              opacity: 1;
            }
            .v-dd1a-nozzle { animation: none; transform: translate(36px, 14px); }
            .v-dd1a-temp { animation: none; opacity: 1; }
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
          одна строка кода — одно действие
        </text>

        {/* Левая зона: строки программы, активная — яркая */}
        <rect x="10" y="26" width="124" height="110" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="18" y="42" fontSize="9" fill="#94a3b8">
          код
        </text>
        {CODE.map((row) => (
          <text
            key={row.text}
            x="18"
            y={row.y}
            fontSize="8"
            fill="#7dd3fc"
            fontFamily={MONO}
            className={row.className}
          >
            {row.text}
          </text>
        ))}

        {/* Стрелка «строка отправляет команду» */}
        <line x1="136" y1="81" x2="144" y2="81" stroke="#64748b" strokeWidth="1.6" />
        <polygon points="142,77 150,81 142,85" fill="#64748b" />

        {/* Правая зона: вид сверху на стол, сопло и линия пластика */}
        <text x="158" y="42" fontSize="9" fill="#94a3b8">
          станок
        </text>
        <rect x="156" y="56" width="148" height="76" rx="4" fill="#1e293b" stroke="#475569" />
        <line x1="156" y1="94" x2="304" y2="94" stroke="#334155" strokeWidth="0.8" />
        <line x1="230" y1="56" x2="230" y2="132" stroke="#334155" strokeWidth="0.8" />

        <line
          x1="200"
          y1="80"
          x2="272"
          y2="108"
          stroke="#38bdf8"
          strokeWidth="2.4"
          strokeDasharray="6 4"
          className="v-dd1a-trail"
        />

        <g className="v-dd1a-nozzle">
          <circle cx="232" cy="94" r="6" fill="#334155" stroke="#64748b" />
          <circle cx="232" cy="94" r="2.4" fill="#f59e0b" />
        </g>

        <text x="236" y="70" fontSize="8" fill="#fbbf24" className="v-dd1a-temp">
          210 °C
        </text>

        <text x="12" y="152" fontSize="9" fill="#e2e8f0">
          строка → команда мотору → движение → пластик
        </text>
        <text x="12" y="170" fontSize="9" fill="#94a3b8">
          активная строка подсвечена
        </text>
      </svg>
    </VisualWrapper>
  );
}
