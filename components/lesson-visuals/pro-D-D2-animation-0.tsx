import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре шага стартового кода на таймлайне: центр метки и подпись. */
const STEPS = [
  { x: 40, label: "G28" },
  { x: 126, label: "M104/M140" },
  { x: 212, label: "M109/M190" },
  { x: 288, label: "очистка" },
];

/**
 * Стартовый код в действии: принтер строго спереди — портал из двух стоек и
 * балки, стол и голова с соплом. Голова паркуется, появляются температуры
 * сопла и стола, в конце сопло проходит по столу и оставляет линию очистки.
 * Внизу горизонтальный таймлайн из четырёх команд стартового кода.
 *
 * Ровно по content урока: «Нагрев → парковка → очистка сопла → начало печати.
 * Каждая команда в своё время» и по предупреждению «парковка до нагрева».
 *
 * От хронологии 3D-печати (A-A1-image, даты столбиком) отличается горизонтальной
 * шкалой команд; от массива деталей на плите (F-F5-animation) и счётчика времени
 * (H-H4-animation) — тем, что предмет здесь один принтер и его последовательность
 * действий, без плиты и без экономии времени. Ракурс спереди в Pro-курсе новый:
 * были изометрия, вид сверху и разрез.
 *
 * Анимация 6 с, по кругу. Классы с префиксом v-dd2a — <style> внутри SVG
 * действует на всю страницу.
 */
export function ProDD2Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация стартового кода: принтер спереди — голова уходит в парковку G28, затем появляются температуры сопла 210 и стола 60, после ожидания сопло проходит по столу и оставляет линию очистки; внизу таймлайн из четырёх меток — G28, M104 и M140, M109 и M190, очистка"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-dd2a-head { animation: v-dd2a-run 6s ease-in-out infinite; }
          .v-dd2a-temp { animation: v-dd2a-temp 6s ease-in-out infinite; }
          .v-dd2a-hot { animation: v-dd2a-hot 6s ease-in-out infinite; }
          .v-dd2a-purge { animation: v-dd2a-purge 6s ease-in-out infinite; }
          @keyframes v-dd2a-run {
            0% { transform: translateX(0); }
            16%, 74% { transform: translateX(-60px); }
            100% { transform: translateX(40px); }
          }
          @keyframes v-dd2a-temp {
            0%, 22% { opacity: 0; }
            38%, 100% { opacity: 1; }
          }
          @keyframes v-dd2a-hot {
            0%, 26% { opacity: 0; }
            42%, 100% { opacity: 0.45; }
          }
          @keyframes v-dd2a-purge {
            0%, 76% { opacity: 0; }
            92%, 100% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-dd2a-head { animation: none; transform: translateX(40px); }
            .v-dd2a-temp, .v-dd2a-purge { animation: none; opacity: 1; }
            .v-dd2a-hot { animation: none; opacity: 0.45; }
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
          стартовый код: нагрев → парковка → очистка
        </text>

        {/* Принтер спереди: портал из стоек и балки, кровать и основание */}
        <rect x="54" y="44" width="216" height="10" fill="#334155" stroke="#475569" />
        <rect x="64" y="44" width="10" height="54" fill="#334155" stroke="#475569" />
        <rect x="246" y="44" width="10" height="54" fill="#334155" stroke="#475569" />
        <rect x="88" y="84" width="144" height="6" rx="1" fill="#1e293b" stroke="#64748b" />
        <rect x="54" y="98" width="216" height="8" fill="#334155" stroke="#475569" />

        {/* Линия очистки на кровати — появляется, когда сопло прошло по ней */}
        <line
          x1="100"
          y1="86"
          x2="190"
          y2="86"
          stroke="#38bdf8"
          strokeWidth="2.2"
          className="v-dd2a-purge"
        />

        {/* Голова с соплом: паркуется, греется, проходит по кровати */}
        <g className="v-dd2a-head">
          <rect x="146" y="54" width="28" height="14" rx="2" fill="#475569" stroke="#64748b" />
          <polygon points="155,68 165,68 160,82" fill="#f59e0b" />
          <circle cx="160" cy="78" r="6" fill="#f87171" className="v-dd2a-hot" />
        </g>

        <text x="12" y="122" fontSize="9" fill="#94a3b8">
          сопло
        </text>
        <text x="56" y="122" fontSize="9" fill="#fbbf24" className="v-dd2a-temp">
          210 °C
        </text>
        <text x="136" y="122" fontSize="9" fill="#94a3b8">
          стол
        </text>
        <text x="176" y="122" fontSize="9" fill="#fbbf24" className="v-dd2a-temp">
          60 °C
        </text>

        {/* Таймлайн стартового кода */}
        <line x1="24" y1="142" x2="296" y2="142" stroke="#475569" strokeWidth="2" />
        {STEPS.map((step) => (
          <g key={step.label}>
            <circle cx={step.x} cy="142" r="4" fill="#334155" stroke="#64748b" />
            <text x={step.x} y="160" fontSize="7.5" fill="#e2e8f0" textAnchor="middle">
              {step.label}
            </text>
          </g>
        ))}

        <text x="12" y="176" fontSize="9" fill="#94a3b8">
          стартовый код выполняется до печати
        </text>
      </svg>
    </VisualWrapper>
  );
}
