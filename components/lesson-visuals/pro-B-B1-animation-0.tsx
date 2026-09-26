import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Рёбра радиатора внутри окна разреза: вертикальные пластины охлаждения. */
const innerFins = [66, 78, 90, 102, 114, 126, 138];

/** Лопасти вентилятора обдува: четыре луча от ступицы. */
const blades: [number, number, number, number][] = [
  [157, 48, 175, 48],
  [166, 39, 166, 57],
  [160, 42, 172, 54],
  [160, 54, 172, 42],
];

/**
 * Тепловой барьер — процесс из content урока: при слабом обдуве зона плавления
 * поднимается из сопла выше heatbreak, пластик там размягчается, расширяется и
 * застревает. Кадр — увеличенный разрез шейки: видно, как красная зона ползёт
 * вверх, а на её месте вздувается пластик.
 *
 * От «Разреза хотэнда» того же урока отличается предметом: там весь узел целиком
 * и его устройство, здесь крупный план одной шейки и то, что в ней происходит во
 * времени.
 *
 * Анимация 3 с, по кругу: сначала зона в сопле и печать идёт, затем обдув не
 * справляется и пластик застревает. Подписи двух состояний стоят в разных
 * половинах правой колонки, поэтому читается только активная.
 * При prefers-reduced-motion показано исправное состояние.
 *
 * Классы с префиксом v-pb1a: <style> внутри SVG действует на всю страницу.
 */
export function ProB1Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: в увеличенном разрезе хотэнда зона плавления поднимается выше heatbreak, пластик размягчается, вздувается и застревает — при хорошем обдуве радиатора зона остаётся в сопле и печать идёт ровно"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-pb1a-zone { animation: v-pb1a-creep 3s ease-in-out infinite; }
          .v-pb1a-jam { animation: v-pb1a-show 3s ease-in-out infinite; }
          .v-pb1a-bad { animation: v-pb1a-first 3s ease-in-out infinite; }
          .v-pb1a-good { animation: v-pb1a-second 3s ease-in-out infinite; }
          .v-pb1a-fan { animation: v-pb1a-spin 1.6s linear infinite; transform-origin: 166px 48px; }
          @keyframes v-pb1a-creep {
            0%, 34% { transform: translateY(0); }
            58%, 88% { transform: translateY(-26px); }
            100% { transform: translateY(0); }
          }
          @keyframes v-pb1a-show {
            0%, 34% { opacity: 0.08; }
            58%, 88% { opacity: 1; }
            100% { opacity: 0.08; }
          }
          @keyframes v-pb1a-first {
            0%, 34% { opacity: 1; }
            58%, 88% { opacity: 0.3; }
            100% { opacity: 1; }
          }
          @keyframes v-pb1a-second {
            0%, 34% { opacity: 0.3; }
            58%, 88% { opacity: 1; }
            100% { opacity: 0.3; }
          }
          @keyframes v-pb1a-spin { to { transform: rotate(360deg); } }
          @media (prefers-reduced-motion: reduce) {
            .v-pb1a-zone, .v-pb1a-fan { animation: none; }
            .v-pb1a-jam { animation: none; opacity: 0; }
            .v-pb1a-bad, .v-pb1a-good { animation: none; opacity: 1; }
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

        {/* Окно увеличения: разрез шейки между радиатором и нагревательным блоком */}
        <rect x="14" y="22" width="172" height="128" rx="8" fill="#0f172a" stroke="#475569" />

        {/* Радиатор с рёбрами — зона охлаждения */}
        <rect x="54" y="30" width="92" height="28" fill="#1e3a5f" stroke="#38bdf8" />
        {innerFins.map((x) => (
          <line key={x} x1={x} y1="32" x2={x} y2="56" stroke="#38bdf8" strokeWidth="1" />
        ))}

        {/* Heatbreak — та самая шейка, куда не должно подниматься тепло */}
        <rect x="88" y="58" width="24" height="38" fill="#334155" stroke="#94a3b8" />

        {/* Нагревательный блок, обрезанный окном снизу */}
        <rect x="70" y="96" width="60" height="54" fill="#334155" stroke="#64748b" />

        {/* Пластик идёт сверху вниз через весь разрез */}
        <rect x="94" y="30" width="12" height="120" rx="3" fill="#cbd5e1" />

        {/* Зона плавления: ползёт вверх, когда обдув не справляется */}
        <g className="v-pb1a-zone">
          <rect x="94" y="96" width="12" height="54" fill="#dc2626" fillOpacity="0.75" />
        </g>

        {/* Размягчённый пластик вздувается и застревает */}
        <g className="v-pb1a-jam">
          <ellipse cx="100" cy="76" rx="11" ry="9" fill="#94a3b8" fillOpacity="0.55" />
        </g>
        <g className="v-pb1a-jam" stroke="#fca5a5" strokeWidth="1.6">
          <line x1="118" y1="70" x2="130" y2="86" />
          <line x1="130" y1="70" x2="118" y2="86" />
        </g>

        {/* Обдув: вентилятор справа и поток воздуха к радиатору */}
        <rect x="152" y="34" width="28" height="28" rx="4" fill="#1e293b" stroke="#38bdf8" />
        <g className="v-pb1a-fan">
          {blades.map(([x1, y1, x2, y2]) => (
            <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7dd3fc" strokeWidth="1.2" />
          ))}
        </g>
        <circle cx="166" cy="48" r="2.6" fill="#7dd3fc" />
        <line x1="150" y1="48" x2="146" y2="48" stroke="#7dd3fc" strokeWidth="1.2" />
        <polygon points="146,45 140,48 146,51" fill="#7dd3fc" />
        <text x="152" y="80" fontSize="10" fill="#7dd3fc">
          обдув
        </text>

        {/* Плохое охлаждение: зона поднялась выше heatbreak */}
        <g className="v-pb1a-bad">
          <text x="196" y="30" fontSize="10" fontWeight="bold" fill="#fca5a5">
            плохое охлаждение
          </text>
          <text x="196" y="48" fontSize="10" fill="#fca5a5">
            зона плавления
          </text>
          <text x="196" y="66" fontSize="10" fill="#fca5a5">
            ползёт в heatbreak
          </text>
          <text x="196" y="84" fontSize="10" fill="#fca5a5">
            пластик застревает
          </text>
        </g>

        {/* Хорошее охлаждение: зона осталась в сопле */}
        <g className="v-pb1a-good">
          <text x="196" y="116" fontSize="10" fontWeight="bold" fill="#86efac">
            хорошее охлаждение
          </text>
          <text x="196" y="134" fontSize="10" fill="#86efac">
            зона только в сопле
          </text>
          <text x="196" y="152" fontSize="10" fill="#86efac">
            печать идёт ровно
          </text>
        </g>

        <text x="14" y="170" fontSize="10" fill="#94a3b8">
          слабое охлаждение радиатора — причина засора
        </text>
      </svg>
    </VisualWrapper>
  );
}
