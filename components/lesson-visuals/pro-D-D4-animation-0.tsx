import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Смена цвета по M600: деталь напечатана наполовину синим, сопло уведено в
 * парковку справа, катушку меняют, на дисплее сначала Paused, потом Resume, и
 * граница цвета поднимается — верх детали печатается новым пластиком.
 *
 * Ровно по content урока: «Принтер останавливается, сопло отводится, ты меняешь
 * пластик, нажимаешь Resume. Печать продолжается новым цветом».
 *
 * От «Ironing» (G-G3-animation, сопло затирает верхний слой), от «Input Shaper»
 * (I-I4-animation, волны эха) и от «Обрыва нити» (I-I5-animation, нить через
 * пропасть) отличается предметом: здесь пауза, парковка, смена катушки и
 * двухцветная деталь — ни бороздок, ни волн, ни провисающих нитей.
 *
 * Анимация 8 с, по кругу. Классы с префиксом v-dd4a — <style> внутри SVG
 * действует на всю страницу.
 */
export function ProDD4Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация смены цвета по M600: деталь напечатана наполовину синим, сопло отведено в парковку, катушка меняется, на дисплее принтера сначала Paused, затем Resume, и граница цвета поднимается — верх детали печатается новым цветом"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-dd4a-grow { animation: v-dd4a-grow 8s ease-in-out infinite; }
          .v-dd4a-st1 { animation: v-dd4a-st1 8s ease-in-out infinite; }
          .v-dd4a-st2 { animation: v-dd4a-st2 8s ease-in-out infinite; }
          .v-dd4a-spool { animation: v-dd4a-spool 8s ease-in-out infinite; }
          @keyframes v-dd4a-grow {
            0%, 58% { y: 96px; height: 0px; }
            100% { y: 48px; height: 48px; }
          }
          @keyframes v-dd4a-st1 {
            0%, 46% { opacity: 1; }
            56%, 100% { opacity: 0.25; }
          }
          @keyframes v-dd4a-st2 {
            0%, 46% { opacity: 0.25; }
            56%, 100% { opacity: 1; }
          }
          @keyframes v-dd4a-spool {
            0%, 18% { opacity: 0.35; }
            32%, 62% { opacity: 1; }
            74%, 100% { opacity: 0.35; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-dd4a-grow { animation: none; y: 48px; height: 48px; }
            .v-dd4a-st1 { animation: none; opacity: 0.25; }
            .v-dd4a-st2 { animation: none; opacity: 1; }
            .v-dd4a-spool { animation: none; opacity: 1; }
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
          M600: пауза, смена катушки, продолжение
        </text>

        {/* Стол и деталь: низ уже напечатан, верх растёт новым цветом */}
        <rect x="30" y="136" width="100" height="6" fill="#334155" />
        <rect x="40" y="96" width="80" height="40" fill="#3b82f6" fillOpacity="0.55" />
        <rect
          x="40"
          y="96"
          width="80"
          height="0"
          fill="#f59e0b"
          fillOpacity="0.5"
          className="v-dd4a-grow"
        />

        {/* Сопло отведено в парковку справа */}
        <rect x="150" y="60" width="22" height="12" rx="2" fill="#475569" stroke="#64748b" />
        <polygon points="155,72 167,72 161,86" fill="#f59e0b" />

        {/* Дисплей принтера: Paused, затем Resume */}
        <rect x="196" y="26" width="104" height="46" rx="5" fill="#0f172a" stroke="#475569" />
        <text x="236" y="44" fontSize="8" fill="#f87171" className="v-dd4a-st1">
          Paused
        </text>
        <text x="236" y="62" fontSize="8" fill="#34d399" className="v-dd4a-st2">
          Resume
        </text>

        {/* Катушка, которую меняют */}
        <circle cx="250" cy="110" r="18" fill="#1e293b" stroke="#475569" />
        <circle cx="250" cy="110" r="7" fill="#334155" />
        <circle cx="250" cy="110" r="18" fill="none" stroke="#f59e0b" strokeWidth="1.6" className="v-dd4a-spool" />
        <text x="232" y="144" fontSize="9" fill="#94a3b8">
          катушка
        </text>

        <text x="12" y="160" fontSize="9" fill="#e2e8f0">
          пауза, смена пластика, продолжение
        </text>
        <text x="12" y="176" fontSize="9" fill="#94a3b8">
          граница цвета — на высоте паузы
        </text>
      </svg>
    </VisualWrapper>
  );
}
