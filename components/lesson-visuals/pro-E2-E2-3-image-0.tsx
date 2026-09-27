import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Сушилка и хранение из content урока: «Фото: сушилка Sunlu, Eibos, герметичный
 * контейнер с силикагелем», «Герметичный контейнер + силикагель + гигрометр.
 * Влажность внутри — 10–20%. Для нейлона — вакуумные пакеты» и список
 * температур сушки (PLA 45, PETG 65, TPU 50, ABS/ASA 70, PA 80, PC 80 °C).
 *
 * Это сцена-цикл, а не каталог моделей: слева сушилка-бокс, внутри катушка и
 * дисплей с рабочим диапазоном 45–80 °C, от неё стрелка к правому боксу, где
 * катушку держат пакетики силикагеля и прибор влажности (15 процентов из
 * «10–20%»), внизу — шкала влажности «сырой → сухо». Предметы (сушилка, бокс с
 * прибором) в курсе больше не встречаются.
 *
 * Анимация 6 с, по кругу: волны тепла в сушилке дышат, стрелка течёт вправо,
 * пакетики силикагеля мерцают, прибор подсвечивается.
 * При prefers-reduced-motion всё показано в рабочем состоянии.
 *
 * Классы с префиксом v-e23b: <style> внутри SVG действует на всю страницу.
 */
const GEL_BAGS = [166, 182, 198];

export function ProE2E23Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сушка и хранение филамента: слева сушилка-бокс с катушкой и дисплеем 45–80 градусов и волнами тепла, справа герметичный бокс с пакетиками силикагеля и прибором влажности 15 процентов, внизу шкала от сырого пластика к сухому"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-e23b-heat { animation: v-e23b-waves 6s ease-in-out infinite; }
          .v-e23b-flow { animation: v-e23b-move 6s ease-in-out infinite; }
          .v-e23b-gel { animation: v-e23b-glow 6s ease-in-out infinite; }
          .v-e23b-meter { animation: v-e23b-light 6s ease-in-out infinite; }
          @keyframes v-e23b-waves {
            0%, 100% { opacity: 0.3; }
            40%, 70% { opacity: 1; }
          }
          @keyframes v-e23b-move {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(6px); }
          }
          @keyframes v-e23b-glow {
            0%, 100% { opacity: 0.45; }
            45%, 75% { opacity: 1; }
          }
          @keyframes v-e23b-light {
            0%, 100% { fill-opacity: 0.4; }
            45%, 75% { fill-opacity: 0.9; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-e23b-heat, .v-e23b-flow, .v-e23b-gel, .v-e23b-meter { animation: none; opacity: 1; fill-opacity: 1; }
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
          сушка и хранение: влага уходит из пластика
        </text>
        {/* Сушилка: бокс, катушка, дисплей с диапазоном и волны тепла */}
        <rect x="20" y="40" width="96" height="80" rx="6" fill="#334155" stroke="#64748b" />
        <rect x="28" y="46" width="42" height="12" rx="2" fill="#0f172a" stroke="#64748b" />
        <text x="31" y="55" fontSize="8" fill="#6ee7b7">
          45–80 °C
        </text>
        <circle cx="78" cy="90" r="22" fill="none" stroke="#94a3b8" strokeWidth="2" />
        <circle
          cx="78"
          cy="90"
          r="14"
          fill="none"
          stroke="#a78bfa"
          strokeWidth="5"
          strokeOpacity="0.55"
        />
        <circle cx="78" cy="90" r="4" fill="#475569" stroke="#94a3b8" />
        <path
          className="v-e23b-heat"
          d="M34,100 q5,-6 10,0 q5,6 10,0"
          fill="none"
          stroke="#fb923c"
          strokeWidth="1.2"
        />
        <path
          className="v-e23b-heat"
          d="M34,110 q5,-6 10,0 q5,6 10,0"
          fill="none"
          stroke="#fb923c"
          strokeWidth="1.2"
        />

        {/* Стрелка: из сушилки в бокс хранения */}
        <g className="v-e23b-flow">
          <line x1="124" y1="80" x2="146" y2="80" stroke="#64748b" strokeWidth="2" />
          <polygon points="142,76 152,80 142,84" fill="#64748b" />
        </g>

        {/* Бокс хранения: силикагель и прибор влажности */}
        <rect x="158" y="40" width="96" height="80" rx="6" fill="#334155" stroke="#64748b" />
        {GEL_BAGS.map((x) => (
          <g key={`bag-${x}`}>
            <rect
              className="v-e23b-gel"
              x={x}
              y="52"
              width="10"
              height="14"
              rx="1"
              fill="#334155"
              stroke="#64748b"
            />
            <line x1={x} y1="66" x2={x + 10} y2="52" stroke="#64748b" />
          </g>
        ))}
        <text x="230" y="62" fontSize="7" fill="#94a3b8" textAnchor="middle">
          влажность
        </text>
        <rect
          className="v-e23b-meter"
          x="212"
          y="68"
          width="36"
          height="30"
          rx="3"
          fill="#0f172a"
          stroke="#64748b"
        />
        <text x="230" y="87" fontSize="9" fill="#6ee7b7" textAnchor="middle">
          15 %
        </text>

        <text x="68" y="136" fontSize="8" fill="#94a3b8" textAnchor="middle">
          сушилка
        </text>
        <text x="206" y="136" fontSize="8" fill="#94a3b8" textAnchor="middle">
          бокс для хранения
        </text>

        {/* Шкала влажности: сырой → сухо */}
        <line x1="40" y1="152" x2="280" y2="152" stroke="#64748b" />
        <line x1="60" y1="148" x2="60" y2="153" stroke="#64748b" />
        <line x1="240" y1="148" x2="240" y2="153" stroke="#64748b" />
        <text x="60" y="168" fontSize="8" fill="#6ee7b7" textAnchor="middle">
          сухо 10–20 %
        </text>
        <text x="240" y="168" fontSize="8" fill="#94a3b8" textAnchor="middle">
          сырой
        </text>
      </svg>
    </VisualWrapper>
  );
}
