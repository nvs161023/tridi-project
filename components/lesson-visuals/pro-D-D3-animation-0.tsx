import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Десять строк, которые макрос выполняет вместо одной команды. */
const ACTIONS = [
  "M140 S{BED}",
  "M104 S{EXTRUDER}",
  "G28",
  "M190 S{BED}",
  "M109 S{EXTRUDER}",
  "G1 Z5 F3000",
  "G1 X10 Y10",
  "G1 X100 E15",
  "G92 E0",
  "G1 Z0.2",
];

/**
 * Макрос в действии: слева рамка с одной командой START_PRINT BED=60 EXTRUDER=210,
 * справа десять строк, которые он разворачивает, — строки появляются одна за
 * другой, а счётчик показывает «1 команда → 10 действий».
 *
 * Ровно по content урока: «Одна команда START_PRINT BED=60 EXTRUDER=210 →
 * 10 действий. Нагрев, парковка, очистка» и по примеру макроса с параметрами.
 *
 * От «Древовидной поддержки» (H-H1-animation, ветви растут по очереди) и от
 * «Как принтер строит модель» (basic-1-animation, стенка растёт слоями) отличается
 * предметом: здесь нет принтера, стенок и ветвей — только текст: один вызов слева
 * и список из десяти строк справа.
 *
 * Анимация 8 с, по кругу: строки проявляются по очереди и остаются до конца цикла.
 * Классы с префиксом v-dd3a — <style> внутри SVG действует на всю страницу.
 */
export function ProDD3Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: одна команда START_PRINT с параметрами BED 60 и EXTRUDER 210 разворачивается в десять строк — нагрев стола M140, нагрев сопла M104, парковка G28, ожидание M190 и M109, подход и линия очистки G1, сброс экструдера G92; счётчик показывает один вызов и десять действий"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-dd3a-row { animation: v-dd3a-appear 8s linear infinite; }
          @keyframes v-dd3a-appear {
            0% { opacity: 0.12; }
            8% { opacity: 1; }
            100% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-dd3a-row { animation: none; opacity: 1; }
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
          макрос: одна команда — десять действий
        </text>

        {/* Рамка-вызов: одна команда с параметрами */}
        <rect x="10" y="30" width="118" height="54" rx="6" fill="#0f172a" stroke="#38bdf8" />
        <text x="18" y="44" fontSize="8" fill="#94a3b8">
          вызов
        </text>
        <text x="18" y="62" fontSize="8" fill="#7dd3fc" fontFamily={MONO}>
          START_PRINT
        </text>
        <text x="18" y="76" fontSize="7.5" fill="#94a3b8" fontFamily={MONO}>
          BED=60 EXTRUDER=210
        </text>

        {/* Стрелка «макрос разворачивается» */}
        <line x1="132" y1="57" x2="144" y2="57" stroke="#64748b" strokeWidth="1.6" />
        <polygon points="142,53 150,57 142,61" fill="#64748b" />

        {/* Десять строк-действий: проявляются по очереди */}
        {ACTIONS.map((action, index) => (
          <text
            key={action}
            x="162"
            y={38 + index * 14}
            fontSize="7.5"
            fill="#94a3b8"
            fontFamily={MONO}
            className="v-dd3a-row"
            style={{ animationDelay: `${index * 0.7}s` }}
          >
            {action}
          </text>
        ))}

        <text x="12" y="100" fontSize="9" fill="#e2e8f0">
          1 команда → 10 действий
        </text>
        <text x="12" y="116" fontSize="9" fill="#94a3b8">
          10 строк G-кода
        </text>
        <text x="12" y="176" fontSize="9" fill="#94a3b8">
          макрос живёт в printer.cfg
        </text>
      </svg>
    </VisualWrapper>
  );
}
