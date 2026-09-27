import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Сушка и влага из content урока: «Нейлон, PETG, TPU, PC впитывают воду из
 * воздуха. При печати вода превращается в пар — пузыри, треск, плохие слои» и
 * «Вода в пластике закипает при нагреве. Пар выходит через сопло — пузыри,
 * треск. Слои неровные, прочность падает».
 *
 * Фокус на физике пара, а не на каталоге дефектов: слева влажный пруток,
 * в горячей зоне сопла вода закипает, пузырь уходит в расплав, и в стенке
 * остаются поры; справа тот же путь у сухого прутка — стенка плотная. Плиток и
 * миниатюр нет вовсе (это язык базового урока 10 и атласа I4).
 *
 * Флаг на будущее: в модуле M3 есть блок «Сушка» (катушка в сушилке, влага
 * испаряется). При его отрисовке развести: M3 — процесс сушки, E2-3 — что делает
 * пар внутри сопла.
 *
 * Анимация 6 с, по кругу: капли влаги мерцают в прутке, пузырь поднимается из
 * горячей зоны, поры в стенке слева проступают. При prefers-reduced-motion
 * показано итоговое состояние: пузырь в канале, поры видны.
 *
 * Классы с префиксом v-e23a: <style> внутри SVG действует на всю страницу.
 */
export function ProE2E23Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: слева влажный пруток — капли воды в горячей зоне сопла закипают, пузырь пара уходит в расплав и в стенке остаются поры; справа сухой пруток того же материала — стенка выходит плотной, без пор"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-e23a-drop { animation: v-e23a-blink 6s ease-in-out infinite; }
          .v-e23a-bubble { animation: v-e23a-rise 6s ease-in-out infinite; }
          .v-e23a-pore { animation: v-e23a-appear 6s ease-in-out infinite; }
          @keyframes v-e23a-blink {
            0%, 100% { opacity: 0.35; }
            20%, 60% { opacity: 1; }
          }
          @keyframes v-e23a-rise {
            0%, 12% { transform: translateY(6px); opacity: 0; }
            35% { transform: translateY(0); opacity: 1; }
            60%, 88% { transform: translateY(-5px); opacity: 1; }
            100% { transform: translateY(6px); opacity: 0; }
          }
          @keyframes v-e23a-appear {
            0%, 45% { opacity: 0; }
            62%, 94% { opacity: 1; }
            100% { opacity: 0.4; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-e23a-drop { animation: none; opacity: 1; }
            .v-e23a-bubble { animation: none; transform: none; opacity: 1; }
            .v-e23a-pore { animation: none; opacity: 1; }
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
          влажный и сухой пластик: что делает пар
        </text>
        {/* Влажный пруток и его путь через сопло */}
        <rect x="57" y="26" width="14" height="20" rx="3" fill="#94a3b8" />
        <circle className="v-e23a-drop" cx="64" cy="32" r="2" fill="#38bdf8" />
        <circle className="v-e23a-drop" cx="67" cy="40" r="1.6" fill="#38bdf8" />
        <rect x="48" y="46" width="32" height="22" rx="3" fill="#334155" stroke="#64748b" />
        <rect
          x="55"
          y="52"
          width="18"
          height="12"
          rx="2"
          fill="#f97316"
          fillOpacity="0.3"
          stroke="#fb923c"
        />
        <rect x="61" y="64" width="6" height="6" fill="#0f172a" />
        <polygon points="57,68 71,68 67,78 61,78" fill="#475569" stroke="#64748b" />
        <circle
          className="v-e23a-bubble"
          cx="64"
          cy="58"
          r="3"
          fill="#e2e8f0"
          fillOpacity="0.85"
        />
        <rect x="51" y="78" width="26" height="34" rx="2" fill="#334155" stroke="#64748b" />
        <line x1="53" y1="86" x2="75" y2="86" stroke="#64748b" strokeWidth="0.8" />
        <line x1="53" y1="94" x2="75" y2="94" stroke="#64748b" strokeWidth="0.8" />
        <line x1="53" y1="102" x2="75" y2="102" stroke="#64748b" strokeWidth="0.8" />
        <circle
          className="v-e23a-pore"
          cx="60"
          cy="90"
          r="2.5"
          fill="#0f172a"
          stroke="#94a3b8"
        />
        <circle
          className="v-e23a-pore"
          cx="68"
          cy="100"
          r="3"
          fill="#0f172a"
          stroke="#94a3b8"
        />
        <text x="64" y="126" fontSize="7.5" fill="#38bdf8" textAnchor="middle">
          влажный:
        </text>
        <text x="64" y="140" fontSize="7.5" fill="#f87171" textAnchor="middle">
          поры и треск
        </text>
        {/* Сухой пруток: тот же путь, но стенка плотная */}
        <rect x="232" y="26" width="14" height="20" rx="3" fill="#94a3b8" />
        <rect x="223" y="46" width="32" height="22" rx="3" fill="#334155" stroke="#64748b" />
        <rect
          x="230"
          y="52"
          width="18"
          height="12"
          rx="2"
          fill="#34d399"
          fillOpacity="0.3"
          stroke="#6ee7b7"
        />
        <rect x="236" y="64" width="6" height="6" fill="#0f172a" />
        <polygon points="232,68 246,68 242,78 236,78" fill="#475569" stroke="#64748b" />
        <rect x="226" y="78" width="26" height="34" rx="2" fill="#334155" stroke="#64748b" />
        <line x1="228" y1="86" x2="250" y2="86" stroke="#64748b" strokeWidth="0.8" />
        <line x1="228" y1="94" x2="250" y2="94" stroke="#64748b" strokeWidth="0.8" />
        <line x1="228" y1="102" x2="250" y2="102" stroke="#64748b" strokeWidth="0.8" />
        <text x="239" y="126" fontSize="7.5" fill="#94a3b8" textAnchor="middle">
          сухой:
        </text>
        <text x="239" y="140" fontSize="7.5" fill="#6ee7b7" textAnchor="middle">
          плотная стенка
        </text>
      </svg>
    </VisualWrapper>
  );
}
