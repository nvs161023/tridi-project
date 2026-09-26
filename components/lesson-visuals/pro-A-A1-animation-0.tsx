import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Эволюция принтеров — две машины из content урока: промышленный FDM 1990 года
 * (размер с холодильник, 100 000 $) и домашний CoreXY 2024 года (с микроволновку,
 * 300 $). Между ними — дуга времени и цифра, которая честно считается из урока:
 * 2024 − 1990 = 34 года.
 *
 * От «Устройства FDM-принтера» базового курса отличается предметом: там один
 * принтер в изометрии с выносками узлов, здесь две машины разных эпох и разного
 * размера, а смысл несут габарит, цена и стрелка времени.
 *
 * Анимация 3 с, по кругу: сначала подсвечен промышленный принтер, затем домашний —
 * глаз проходит путь, о котором говорит урок. При prefers-reduced-motion обе
 * машины показываются разом, без переключения.
 *
 * Классы с префиксом v-pa1a: <style> внутри SVG действует на всю страницу.
 */
export function ProAA1Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: от промышленного FDM 1990 года размером с холодильник за 100 000 $ к домашнему CoreXY 2024 года размером с микроволновку за 300 $ — принтеры уменьшились, скорость выросла"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-pa1a-old { animation: v-pa1a-first 3s ease-in-out infinite; }
          .v-pa1a-new { animation: v-pa1a-second 3s ease-in-out infinite; }
          .v-pa1a-flow { animation: v-pa1a-dash 1.4s linear infinite; }
          @keyframes v-pa1a-first {
            0%, 44% { opacity: 1; }
            54%, 92% { opacity: 0.32; }
            100% { opacity: 1; }
          }
          @keyframes v-pa1a-second {
            0%, 44% { opacity: 0.32; }
            54%, 92% { opacity: 1; }
            100% { opacity: 0.32; }
          }
          @keyframes v-pa1a-dash { to { stroke-dashoffset: -26; } }
          @media (prefers-reduced-motion: reduce) {
            .v-pa1a-old, .v-pa1a-new, .v-pa1a-flow {
              animation: none;
              opacity: 1;
            }
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

        {/* Пол, на котором стоят обе машины */}
        <line x1="16" y1="116" x2="306" y2="116" stroke="#475569" />

        {/* Промышленный FDM 1990: корпус с холодильник, катушка на боку */}
        <g className="v-pa1a-old">
          <rect x="22" y="40" width="80" height="76" rx="4" fill="#334155" stroke="#475569" />
          <rect x="30" y="48" width="64" height="30" rx="2" fill="#1e293b" stroke="#475569" />
          <circle cx="62" cy="63" r="10" fill="none" stroke="#94a3b8" strokeWidth="1.4" />
          <line x1="30" y1="88" x2="94" y2="88" stroke="#94a3b8" />
          <rect x="52" y="80" width="20" height="14" rx="2" fill="#475569" />
          <polygon points="58,94 66,94 62,102" fill="#94a3b8" />
          <rect x="30" y="104" width="64" height="12" rx="2" fill="#1e293b" stroke="#475569" />
          <circle cx="86" cy="110" r="3" fill="#64748b" />
          <circle cx="38" cy="110" r="3" fill="#64748b" />
        </g>

        {/* Стрелка времени с бегущим штрихом */}
        <g>
          <line
            x1="120"
            y1="78"
            x2="164"
            y2="78"
            stroke="#f59e0b"
            strokeWidth="1.4"
            strokeDasharray="6 5"
            className="v-pa1a-flow"
          />
          <polygon points="164,73 176,78 164,83" fill="#f59e0b" />
          <text x="146" y="60" fontSize="10" fill="#fbbf24" textAnchor="middle">
            34 года
          </text>
        </g>

        {/* Домашний CoreXY 2024: компактная рама */}
        <g className="v-pa1a-new">
          <rect x="186" y="62" width="64" height="54" rx="4" fill="#1e3a5f" stroke="#3b82f6" />
          <rect x="194" y="72" width="48" height="6" rx="2" fill="#334155" stroke="#3b82f6" />
          <rect x="214" y="82" width="14" height="10" rx="2" fill="#334155" />
          <polygon points="218,92 224,92 221,98" fill="#93c5fd" />
          <rect x="194" y="102" width="48" height="8" rx="2" fill="#334155" stroke="#3b82f6" />
          <path d="M206,102 L210,96 L218,96 L222,102 Z" fill="#93c5fd" fillOpacity="0.7" />
        </g>

        {/* Подписи: годы, цена и габарит — словами урока */}
        <text x="22" y="30" fontSize="10" fontWeight="bold" fill="#cbd5e1">
          1990 — промышленный
        </text>
        <text x="200" y="30" fontSize="10" fontWeight="bold" fill="#93c5fd">
          2024 — CoreXY дома
        </text>
        <text x="22" y="136" fontSize="10" fill="#e2e8f0">
          100 000 $
        </text>
        <text x="200" y="136" fontSize="10" fill="#e2e8f0">
          300 $
        </text>
        <text x="22" y="152" fontSize="10" fill="#94a3b8">
          с холодильник
        </text>
        <text x="200" y="152" fontSize="10" fill="#94a3b8">
          с микроволновку
        </text>
      </svg>
    </VisualWrapper>
  );
}
