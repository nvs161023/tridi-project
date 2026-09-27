import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пузырьки: свои keyframes на каждый — так у них разный ритм всплытия. */
const BUBBLE_STYLES = `
          .v-hh2a-b1 { animation: v-hh2a-rise1 3s ease-in infinite; }
          .v-hh2a-b2 { animation: v-hh2a-rise2 3.6s ease-in infinite; }
          .v-hh2a-b3 { animation: v-hh2a-rise3 2.6s ease-in infinite; }
          @keyframes v-hh2a-rise1 {
            0% { transform: translateY(0); opacity: 0; }
            20% { opacity: 0.85; }
            100% { transform: translateY(-28px); opacity: 0; }
          }
          @keyframes v-hh2a-rise2 {
            0% { transform: translateY(0); opacity: 0; }
            25% { opacity: 0.8; }
            100% { transform: translateY(-34px); opacity: 0; }
          }
          @keyframes v-hh2a-rise3 {
            0% { transform: translateY(0); opacity: 0; }
            18% { opacity: 0.9; }
            100% { transform: translateY(-22px); opacity: 0; }
          }`;

/**
 * Растворение PVA: деталь стоит в тёплой воде, растворимая поддержка рядом с ней
 * постепенно оседает и исчезает, вокруг поднимаются пузырьки, а справа таймер
 * показывает, сколько это занимает.
 *
 * Ровно по content урока: «Модель с поддержками в воде. PVA постепенно
 * растворяется, остаётся чистая модель. Время: 2–4 часа в тёплой воде (40 °C)».
 *
 * От «Усадки пластиков» в модуле E1 отличается тем, что там поведение деталей
 * после печати и подъём углов, здесь — сама обработка: поддержка в воде теряет
 * объём. Кадра с ванной, пузырьками и таймером в курсе ещё нет.
 *
 * Анимация 8 с, по кругу: поддержка оседает и гаснет, пузырьки всплывают в своём
 * ритме, затем поддержка возвращается. При prefers-reduced-motion показан итог:
 * поддержка растворена, пузырьков нет.
 *
 * Классы с префиксом v-hh2a: <style> внутри SVG действует на всю страницу.
 */
export function ProHH2Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация растворения PVA: деталь стоит в тёплой воде 40 градусов, растворимая поддержка оседает и исчезает, вокруг поднимаются пузырьки, таймер показывает 2–4 часа, а модель остаётся чистой"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`${BUBBLE_STYLES}
          .v-hh2a-support {
            animation: v-hh2a-support 8s ease-in-out infinite;
            transform-box: fill-box;
            transform-origin: bottom center;
          }
          @keyframes v-hh2a-support {
            0%, 22% { transform: scaleY(1); opacity: 1; }
            70%, 90% { transform: scaleY(0.12); opacity: 0.25; }
            100% { transform: scaleY(1); opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-hh2a-support { animation: none; transform: scaleY(0.12); opacity: 0.25; }
            .v-hh2a-bubble { animation: none; opacity: 0; }
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
          поддержка растворяется в тёплой воде
        </text>

        {/* Ванна с деталью и растворяемой поддержкой */}
        <rect x="30" y="56" width="170" height="86" rx="6" fill="#38bdf8" fillOpacity="0.12" stroke="#38bdf8" />
        <line x1="30" y1="66" x2="200" y2="66" stroke="#38bdf8" strokeOpacity="0.5" />
        <rect x="60" y="88" width="70" height="34" fill="#475569" stroke="#94a3b8" />
        <rect
          className="v-hh2a-support"
          x="126"
          y="96"
          width="26"
          height="26"
          fill="#0c4a6e"
          stroke="#38bdf8"
          strokeDasharray="4 3"
        />
        <circle className="v-hh2a-bubble v-hh2a-b1" cx="140" cy="128" r="2" fill="#7dd3fc" />
        <circle className="v-hh2a-bubble v-hh2a-b2" cx="150" cy="118" r="1.6" fill="#7dd3fc" />
        <circle className="v-hh2a-bubble v-hh2a-b3" cx="144" cy="104" r="1.3" fill="#7dd3fc" />

        {/* Таймер растворения */}
        <rect x="212" y="56" width="84" height="86" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="254" y="86" fontSize="10" fill="#94a3b8" textAnchor="middle">
          0 ч
        </text>
        <text x="254" y="110" fontSize="12" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
          2–4 ч
        </text>
        <text x="254" y="136" fontSize="9" fill="#38bdf8" textAnchor="middle">
          40 °C
        </text>

        <text x="115" y="158" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          модель остаётся чистой
        </text>
        <text x="12" y="176" fontSize="9" fill="#94a3b8">
          2–4 часа при 40 °C — и поддержек нет
        </text>
      </svg>
    </VisualWrapper>
  );
}
