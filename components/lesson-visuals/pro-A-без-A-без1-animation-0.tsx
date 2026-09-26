import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Частицы в комнате: где они висят, если печатать без вентиляции. */
const dirty = [
  [110, 56],
  [150, 48],
  [188, 76],
  [132, 104],
  [206, 58],
  [170, 112],
  [96, 108],
  [222, 100],
];

/** Быстрые соединения VOC — короткие штрихи в той же комнате. */
const vapors = ["120,56 134,53", "176,100 190,97", "208,120 222,117"];

/** Точки в вытяжке: они бегут по воздуховоду наружу. */
const flow = [96, 120, 150, 180, 210, 240];

/**
 * Распространение частиц — комната в разрезе и две фазы из content урока: без
 * вентиляции UFP и VOC висят по всей комнате, с вытяжкой уходят наружу.
 *
 * Анимация 3 с, по кругу: сначала «грязная» фаза, затем включается вытяжка и
 * частицы уходят по воздуховоду в окно. Подписи фаз стоят в разных углах кадра и
 * проявляются по очереди — так в кадре читается только активная фаза.
 * При prefers-reduced-motion вытяжка показана включённой, комната — чистой.
 *
 * От «Схемы вентиляции» соседнего урока отличается приёмом: там блок-схема из
 * рамок и стрелок, здесь сцена с принтером, комнатой и окном.
 *
 * Классы с префиксом v-pab1a: <style> внутри SVG действует на всю страницу.
 */
export function ProABezABez1Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: частицы UFP и VOC выходят из сопла и висят по всей комнате, а с включённой вытяжкой поднимаются в неё и уходят по воздуховоду в окно"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-pab1a-dirty { animation: v-pab1a-soil 3s ease-in-out infinite; }
          .v-pab1a-hood { animation: v-pab1a-pull 3s ease-in-out infinite; }
          .v-pab1a-one { animation: v-pab1a-first 3s ease-in-out infinite; }
          .v-pab1a-two { animation: v-pab1a-second 3s ease-in-out infinite; }
          .v-pab1a-run { animation: v-pab1a-dash 1.2s linear infinite; }
          @keyframes v-pab1a-soil {
            0%, 40% { opacity: 1; }
            55%, 92% { opacity: 0.08; }
            100% { opacity: 1; }
          }
          @keyframes v-pab1a-pull {
            0%, 40% { opacity: 0.1; }
            55%, 92% { opacity: 1; }
            100% { opacity: 0.1; }
          }
          @keyframes v-pab1a-first {
            0%, 40% { opacity: 1; }
            55%, 92% { opacity: 0.25; }
            100% { opacity: 1; }
          }
          @keyframes v-pab1a-second {
            0%, 40% { opacity: 0.25; }
            55%, 92% { opacity: 1; }
            100% { opacity: 0.25; }
          }
          @keyframes v-pab1a-dash { to { stroke-dashoffset: -30; } }
          @media (prefers-reduced-motion: reduce) {
            .v-pab1a-soil { animation: none; opacity: 0.08; }
            .v-pab1a-hood, .v-pab1a-two { animation: none; opacity: 1; }
            .v-pab1a-one { animation: none; opacity: 0.25; }
            .v-pab1a-run { animation: none; }
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

        {/* Комната в разрезе: стены, пол и окно справа */}
        <line x1="16" y1="34" x2="250" y2="34" stroke="#475569" />
        <line x1="16" y1="34" x2="16" y2="136" stroke="#475569" />
        <line x1="16" y1="136" x2="250" y2="136" stroke="#475569" />
        <line x1="250" y1="34" x2="250" y2="56" stroke="#475569" />
        <line x1="250" y1="96" x2="250" y2="136" stroke="#475569" />
        <rect x="246" y="56" width="8" height="40" fill="#1e3a5f" stroke="#38bdf8" />
        <line x1="250" y1="78" x2="250" y2="78" stroke="#38bdf8" />

        {/* Фаза «без вентиляции»: частицы и пары по всей комнате */}
        <g className="v-pab1a-dirty">
          {dirty.map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" fill="#f87171" />
          ))}
          {vapors.map((points) => (
            <polyline
              key={points}
              points={points}
              fill="none"
              stroke="#fb923c"
              strokeWidth="1.4"
            />
          ))}
        </g>

        {/* Фаза с вытяжкой: зонт над принтером и воздуховод в окно */}
        <g className="v-pab1a-hood">
          <rect x="30" y="82" width="54" height="12" rx="2" fill="#334155" stroke="#94a3b8" />
          <rect x="84" y="84" width="166" height="8" fill="#334155" stroke="#94a3b8" />
          <line
            x1="88"
            y1="88"
            x2="246"
            y2="88"
            stroke="#34d399"
            strokeWidth="1.2"
            strokeDasharray="6 6"
            className="v-pab1a-run"
          />
          {flow.map((cx) => (
            <circle key={cx} cx={cx} cy="88" r="2.2" fill="#34d399" />
          ))}
        </g>
        <text x="100" y="74" fontSize="10" fill="#6ee7b7">
          вытяжка
        </text>

        {/* Принтер: корпус, головка и сопло */}
        <rect x="34" y="100" width="44" height="36" rx="3" fill="#334155" stroke="#64748b" />
        <rect x="46" y="100" width="20" height="10" rx="2" fill="#1e293b" stroke="#94a3b8" />
        <polygon points="52,110 60,110 56,115" fill="#f87171" />
        <text x="56" y="131" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          принтер
        </text>

        {/* Подписи фаз: по очереди, каждая в своём углу */}
        <text x="16" y="20" fontSize="10" fill="#fca5a5" className="v-pab1a-one">
          без вентиляции
        </text>
        <text x="190" y="20" fontSize="10" fill="#6ee7b7" className="v-pab1a-two">
          с вытяжкой — наружу
        </text>

        {/* Что чем обозначено */}
        <circle cx="20" cy="162" r="2.2" fill="#f87171" />
        <text x="28" y="165" fontSize="10" fill="#94a3b8">
          UFP — частицы
        </text>
        <polyline points="150,165 160,165" fill="none" stroke="#fb923c" strokeWidth="1.4" />
        <text x="166" y="165" fontSize="10" fill="#94a3b8">
          VOC — пары
        </text>
      </svg>
    </VisualWrapper>
  );
}
