import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Слои в башнях: шаг 10 px, от 74 до 144. */
const LAYERS = [74, 84, 94, 104, 114, 124, 134, 144];

/**
 * Как печатается мост — из content урока: «Сопло проходит над пропастью, пластик
 * натягивается как верёвка. Высокая скорость — провиснет. Низкая — успеет застыть»
 * и настройки «Bridge Speed 20–30 мм/с, Bridge Flow 80–90 %».
 *
 * Две башни и пропасть между ними: сопло идёт слева направо, за ним тянется нить.
 * В первой половине цикла скорость низкая и нить ложится прямой, во второй сопло
 * бежит быстрее и нить провисает дугой — обе нити живут в кадре, меняется только
 * их яркость. Кадра с мостом в курсе не было: нависания показаны под углом
 * (I5[1]), а не над пропастью.
 *
 * Анимация 8 с. При prefers-reduced-motion показан итог: нить провисла.
 *
 * Классы с префиксом v-ii5a: <style> внутри SVG действует на всю страницу.
 */
export function ProII5Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: сопло перелетает пропасть между двумя башнями и тянет за собой нить — при 20 мм/с нить ложится натянутой прямой, при 80 мм/с провисает дугой, потому что не успевает застыть"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-ii5a-nozzle { animation: v-ii5a-run 8s linear infinite; }
          .v-ii5a-tight { animation: v-ii5a-tight 8s ease-in-out infinite; }
          .v-ii5a-sag { animation: v-ii5a-sag 8s ease-in-out infinite; }
          @keyframes v-ii5a-run {
            0% { transform: translate(0, 0); }
            50% { transform: translate(40px, 0); }
            100% { transform: translate(108px, 0); }
          }
          @keyframes v-ii5a-tight {
            0%, 45% { opacity: 1; }
            55%, 100% { opacity: 0.1; }
          }
          @keyframes v-ii5a-sag {
            0%, 45% { opacity: 0.1; }
            55%, 100% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-ii5a-nozzle { animation: none; transform: translate(108px, 0); }
            .v-ii5a-tight { animation: none; opacity: 0.1; }
            .v-ii5a-sag { animation: none; opacity: 1; }
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

        <text x="12" y="16" fontSize="9.5" fill="#94a3b8">
          мост: нить летит над пропастью
        </text>

        {/* Две башни со слоями */}
        <rect x="44" y="64" width="40" height="86" fill="#475569" stroke="#94a3b8" />
        <rect x="204" y="64" width="40" height="86" fill="#475569" stroke="#94a3b8" />
        {LAYERS.map((y) => (
          <g key={`layer-${y}`} stroke="#94a3b8" strokeWidth="0.8">
            <line x1="45" y1={y} x2="83" y2={y} />
            <line x1="205" y1={y} x2="243" y2={y} />
          </g>
        ))}

        {/* Нить: натянутая и провисшая */}
        <path className="v-ii5a-tight" d="M84,66 L204,66" fill="none" stroke="#34d399" strokeWidth="2" />
        <path className="v-ii5a-sag" d="M84,66 Q144,98 204,66" fill="none" stroke="#f87171" strokeWidth="2" />

        {/* Сопло идёт от левой башни к правой */}
        <rect className="v-ii5a-nozzle" x="88" y="54" width="9" height="12" rx="2" fill="#e2e8f0" />

        <text x="90" y="118" fontSize="9" fill="#6ee7b7">
          20 мм/с: натянута
        </text>
        <text x="90" y="138" fontSize="9" fill="#f87171">
          80 мм/с: провисает
        </text>

        <text x="12" y="170" fontSize="9" fill="#94a3b8">
          под мостом пустота: держит только натяжение нити
        </text>
      </svg>
    </VisualWrapper>
  );
}
