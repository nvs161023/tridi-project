import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Три крючка из content урока: одна и та же модель, один и тот же груз, разный
 * пластик. PLA не выдерживает — по стойке идёт трещина и низ обрывается, PETG
 * держит, TPU тянется под грузом и возвращается в форму.
 *
 * От «Трёх схем» и «трёх плат» в других модулях отличается тем, что здесь три
 * ОДИНАКОВЫХ предмета на одной балке: сравниваются не устройства, а поведение
 * одного и того же крючка из разных пластиков.
 *
 * Анимация 6 с, по кругу: сначала все держат, затем PLA рвётся, а TPU
 * растягивается и пружинит обратно. При prefers-reduced-motion PLA показан
 * сломанным, TPU — вернувшимся: все три итога читаются и без движения.
 *
 * Классы с префиксом v-pe11a: <style> внутри SVG действует на всю страницу.
 */
export function ProE1E11Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: один и тот же крючок под грузом из трёх пластиков — PLA трескается и обрывается, PETG выдерживает и держит груз, TPU сгибается под грузом и возвращается в форму"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-pe11a-fall { animation: v-pe11a-drop 6s ease-in-out infinite; transform-box: fill-box; transform-origin: center top; }
          .v-pe11a-crack { animation: v-pe11a-show 6s ease-in-out infinite; }
          .v-pe11a-pull { animation: v-pe11a-stretch 6s ease-in-out infinite; transform-box: fill-box; transform-origin: center top; }
          @keyframes v-pe11a-drop {
            0%, 40% { transform: translate(0, 0) rotate(0deg); }
            52%, 92% { transform: translate(0, 10px) rotate(-20deg); }
            100% { transform: translate(0, 0) rotate(0deg); }
          }
          @keyframes v-pe11a-show {
            0%, 34% { opacity: 0; }
            44%, 92% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes v-pe11a-stretch {
            0%, 36% { transform: scaleY(1); }
            50%, 62% { transform: scaleY(1.12); }
            78%, 100% { transform: scaleY(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-pe11a-fall { animation: none; transform: translate(0, 10px) rotate(-20deg); }
            .v-pe11a-crack { animation: none; opacity: 1; }
            .v-pe11a-pull { animation: none; }
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

        <text x="60" y="24" fontSize="10" fontWeight="bold" fill="#86efac" textAnchor="middle">
          PLA
        </text>
        <text x="160" y="24" fontSize="10" fontWeight="bold" fill="#fde68a" textAnchor="middle">
          PETG
        </text>
        <text x="260" y="24" fontSize="10" fontWeight="bold" fill="#7dd3fc" textAnchor="middle">
          TPU
        </text>

        {/* Балка, на которой висят все три крючка */}
        <rect x="14" y="42" width="292" height="8" rx="2" fill="#334155" stroke="#64748b" />
        <line x1="20" y1="50" x2="20" y2="62" stroke="#475569" />
        <line x1="300" y1="50" x2="300" y2="62" stroke="#475569" />

        {/* PLA: трещина по стойке, низ с грузом отваливается */}
        <line x1="60" y1="50" x2="60" y2="84" stroke="#93c5fd" strokeWidth="3.5" />
        <path
          className="v-pe11a-crack"
          d="M56,74 L63,79 L56,84"
          fill="none"
          stroke="#f87171"
          strokeWidth="1.6"
        />
        <g className="v-pe11a-fall">
          <path
            d="M60,84 V92 Q60,106 74,106 Q88,106 88,92"
            fill="none"
            stroke="#93c5fd"
            strokeWidth="3.5"
          />
          <line x1="74" y1="106" x2="74" y2="112" stroke="#94a3b8" />
          <rect x="66" y="112" width="16" height="12" rx="2" fill="#334155" stroke="#94a3b8" />
        </g>

        {/* PETG: тот же крючок и груз, но стойка цела */}
        <line x1="160" y1="50" x2="160" y2="84" stroke="#93c5fd" strokeWidth="3.5" />
        <path
          d="M160,84 V92 Q160,106 174,106 Q188,106 188,92"
          fill="none"
          stroke="#93c5fd"
          strokeWidth="3.5"
        />
        <line x1="174" y1="106" x2="174" y2="112" stroke="#94a3b8" />
        <rect x="166" y="112" width="16" height="12" rx="2" fill="#334155" stroke="#94a3b8" />

        {/* TPU: весь крючок тянется под грузом и пружинит обратно */}
        <g className="v-pe11a-pull">
          <line x1="260" y1="50" x2="260" y2="84" stroke="#93c5fd" strokeWidth="3.5" />
          <path
            d="M260,84 V92 Q260,106 274,106 Q288,106 288,92"
            fill="none"
            stroke="#93c5fd"
            strokeWidth="3.5"
          />
          <line x1="274" y1="106" x2="274" y2="112" stroke="#94a3b8" />
          <rect x="266" y="112" width="16" height="12" rx="2" fill="#334155" stroke="#94a3b8" />
        </g>

        {/* Итог по каждому пластику */}
        <text x="60" y="146" fontSize="10" fill="#fca5a5" textAnchor="middle">
          треснул
        </text>
        <text x="60" y="161" fontSize="10" fill="#94a3b8" textAnchor="middle">
          под грузом
        </text>
        <text x="160" y="146" fontSize="10" fill="#86efac" textAnchor="middle">
          выдержал
        </text>
        <text x="160" y="161" fontSize="10" fill="#94a3b8" textAnchor="middle">
          держит груз
        </text>
        <text x="260" y="146" fontSize="10" fill="#7dd3fc" textAnchor="middle">
          согнулся
        </text>
        <text x="260" y="161" fontSize="10" fill="#94a3b8" textAnchor="middle">
          и вернулся
        </text>
      </svg>
    </VisualWrapper>
  );
}
