import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Капли влаги внутри камеры: поднимаются от катушки к щелям в крышке. */
const DROPS = [
  [82, 88],
  [94, 80],
  [106, 86],
  [116, 78],
  [128, 84],
  [88, 94],
  [122, 92],
];

/** Пар над щелями крышки: три облачка, уже вышедшие наружу. */
const STEAM = [
  [74, 28],
  [98, 28],
  [122, 28],
];

/** Деления шкалы влажности на панели: пять рисок. */
const HUMIDITY_TICKS = [48, 58, 68, 78, 88];

/** Спицы катушки: углы в градусах, от втулки к ободу. */
const REEL_SPOKES = [90, 210, 330];

/**
 * Сушка: катушка внутри сушилки, из пластика поднимается влага, выходит через
 * щели в крышке паром, указатель влажности уезжает с 38 % к 15 %, таймер
 * отсчитывает 4 ч.
 *
 * Ровно по content урока: «Катушка в сушилке. Влага испаряется. Пластик готов к
 * печати» и по заданию урока: влажность падает с 38 % до 15 %, таймер с 4 ч до 0.
 *
 * От E2-E2-3-animation-0 отличается местом действия: там влага кипит в сопле и
 * оставляет поры в стенке, здесь влага выходит из катушки наружу через щели.
 *
 * Анимация 8 с, по кругу: катушка вращается, капли поднимаются вверх и пропадают
 * у щелей, облачка пара пульсируют, указатель влажности уезжает вниз.
 * При prefers-reduced-motion показано итоговое состояние: сухо, указатель внизу.
 *
 * Классы с префиксом v-mm3a: <style> внутри SVG действует на всю страницу.
 */
export function ProMM3Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация сушки: катушка внутри сушилки вращается, из пластика поднимаются капли влаги и уходят паром через щели в крышке, указатель влажности уезжает с 38 процентов к 15, таймер отсчитывает от 4 часов к нулю — пластик готов к печати"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >

        <style>{`
          .v-mm3a-reel {
            animation: v-mm3a-spin 8s linear infinite;
            transform-box: view-box;
            transform-origin: 104px 96px;
          }
          .v-mm3a-drop { animation: v-mm3a-rise 8s ease-in infinite; animation-fill-mode: backwards; }
          .v-mm3a-steam { animation: v-mm3a-steam 8s ease-in-out infinite; animation-fill-mode: backwards; }
          .v-mm3a-needle { animation: v-mm3a-needle 8s ease-in-out infinite; }
          @keyframes v-mm3a-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes v-mm3a-rise {
            0% { transform: translateY(12px); opacity: 0; }
            25% { opacity: 1; }
            75% { opacity: 0.7; }
            100% { transform: translateY(-16px); opacity: 0; }
          }
          @keyframes v-mm3a-steam {
            0%, 100% { opacity: 0.25; transform: translateY(2px); }
            50% { opacity: 0.7; transform: translateY(-2px); }
          }
          @keyframes v-mm3a-needle {
            0% { transform: translateY(0); opacity: 1; }
            60% { transform: translateY(30px); opacity: 1; }
            100% { transform: translateY(30px); opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-mm3a-reel { animation: none; }
            .v-mm3a-drop { animation: none; opacity: 0; }
            .v-mm3a-steam { animation: none; opacity: 0.5; }
            .v-mm3a-needle { animation: none; transform: translateY(30px); }
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
          Сушка: влага уходит из катушки
        </text>

        {/* Корпус сушилки с окном и щелями в крышке */}
        <rect x="28" y="40" width="164" height="104" rx="6" fill="#334155" stroke="#475569" />
        <rect x="36" y="48" width="148" height="88" rx="4" fill="#0f172a" />
        <rect x="56" y="32" width="84" height="8" rx="3" fill="#334155" stroke="#475569" />
        {[0, 1, 2, 3].map((slot) => (
          <rect key={`slot-${slot}`} x={62 + slot * 20} y="34" width="10" height="4" fill="#0f172a" />
        ))}
        {STEAM.map(([cx, cy]) => (
          <circle
            key={`steam-${cx}`}
            cx={cx}
            cy={cy}
            r="3"
            fill="#7dd3fc"
            className="v-mm3a-steam"
            style={{ animationDelay: `${(cx - 74) * 0.02}s` }}
          />
        ))}


        {/* Катушка внутри сушилки: вращается */}
        <g className="v-mm3a-reel">
          <circle cx="104" cy="96" r="32" fill="#334155" stroke="#64748b" />
          <circle cx="104" cy="96" r="10" fill="#0f172a" />
          {REEL_SPOKES.map((angle) => {
            const radians = (angle * Math.PI) / 180;
            return (
              <line
                key={`spoke-${angle}`}
                x1={104 + 10 * Math.cos(radians)}
                y1={96 + 10 * Math.sin(radians)}
                x2={104 + 28 * Math.cos(radians)}
                y2={96 + 28 * Math.sin(radians)}
                stroke="#64748b"
                strokeWidth="1.2"
              />
            );
          })}
        </g>

        {/* Влага выходит из пластика вверх, к щелям */}
        {DROPS.map(([cx, cy], index) => (
          <circle
            key={`drop-${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r="2"
            fill="#7dd3fc"
            className="v-mm3a-drop"
            style={{ animationDelay: `${index * 0.7}s` }}
          />
        ))}

        {/* Панель гигрометра: шкала, указатель и показания */}
        <rect x="204" y="40" width="100" height="66" rx="4" fill="#0f172a" />
        <rect x="212" y="48" width="10" height="40" fill="#1e293b" />
        {HUMIDITY_TICKS.map((y) => (
          <line key={`tick-${y}`} x1="212" y1={y} x2="220" y2={y} stroke="#475569" />
        ))}
        <g className="v-mm3a-needle">
          <line x1="210" y1="52" x2="222" y2="52" stroke="#7dd3fc" strokeWidth="1.6" />
        </g>
        <text x="232" y="64" fontSize="16" fill="#7dd3fc">
          15 %
        </text>
        <text x="232" y="82" fontSize="7.5" fill="#e2e8f0">
          влажность
        </text>
        <text x="232" y="98" fontSize="7.5" fill="#94a3b8">
          было 38 %
        </text>

        {/* Панель таймера */}
        <rect x="204" y="114" width="100" height="48" rx="4" fill="#0f172a" />
        <text x="232" y="136" fontSize="14" fill="#e2e8f0">
          0:00
        </text>
        <text x="232" y="152" fontSize="7.5" fill="#94a3b8">
          таймер: 4 ч → 0
        </text>

        <text x="12" y="160" fontSize="7.5" fill="#e2e8f0">
          влага уходит вверх через щели
        </text>
      </svg>
    </VisualWrapper>
  );
}
