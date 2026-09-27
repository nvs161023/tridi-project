import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три линии слоёв на половину детали: у левой колонки поперёк, у правой вдоль. */
const across = [60, 68, 80, 88];
const along = [232, 236, 240];

/**
 * Как ломается деталь — одна и та же деталь под грузом в двух ориентациях:
 * слева слои идут поперёк нагрузки, и деталь расслаивается по границе слоёв,
 * нижняя часть уезжает вниз вместе с грузом; справа та же деталь повёрнута на
 * 90°, слои идут вдоль нагрузки, и она держит.
 *
 * Ровно по content урока: «Деталь с нагрузкой по слоям ломается. Та же деталь,
 * повёрнутая на 90°, держит нагрузку. Ориентация решает».
 *
 * От «Крючка под грузом» из модуля E1 отличается всем: там три разных
 * материала на одной балке и хрупкий PLA рвётся, здесь один материал и две
 * ориентации одной детали, а ломается не тело, а стык слоёв — деталь
 * расходится по границе, как колода карт. От «Стенки на 40 и 80 мм/с» из
 * базового урока 7 — тем, что там расходится верх печатаемой стенки, здесь уже
 * готовая деталь с грузом.
 *
 * Анимация 6 с, по кругу: деталь целая, потом расслаивается и держится
 * расколотой, затем всё возвращается. При prefers-reduced-motion показано
 * расколотое состояние.
 *
 * Классы с префиксом v-ff2a: <style> внутри SVG действует на всю страницу.
 */
export function ProFF2Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: деталь с грузом напечатана поперёк нагрузки — она расслаивается по границе слоёв, и низ уезжает вниз вместе с грузом; та же деталь, повёрнутая на 90°, слои вдоль нагрузки, держит груз и не расслаивается"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-ff2a-half { animation: v-ff2a-drop 6s ease-in-out infinite; transform-box: fill-box; }
          .v-ff2a-load { animation: v-ff2a-load 6s ease-in-out infinite; transform-box: fill-box; }
          .v-ff2a-gap { animation: v-ff2a-gap 6s ease-in-out infinite; }
          @keyframes v-ff2a-drop {
            0%, 18% { transform: translateY(0); }
            32%, 72% { transform: translateY(6px); }
            86%, 100% { transform: translateY(0); }
          }
          @keyframes v-ff2a-load {
            0%, 18% { transform: translateY(0); }
            32%, 72% { transform: translateY(2px); }
            86%, 100% { transform: translateY(0); }
          }
          @keyframes v-ff2a-gap {
            0%, 18% { opacity: 0; }
            32%, 72% { opacity: 0.95; }
            86%, 100% { opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-ff2a-half, .v-ff2a-load, .v-ff2a-gap { animation: none; }
            .v-ff2a-half { transform: translateY(6px); }
            .v-ff2a-gap { opacity: 0.95; }
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

        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          та же деталь, повёрнутая на 90°
        </text>

        {/* Слои поперёк нагрузки: деталь расслаивается и низ уезжает с грузом */}
        <text x="84" y="32" fontSize="10" fontWeight="bold" fill="#fdba74" textAnchor="middle">
          слои поперёк
        </text>
        <rect x="56" y="40" width="56" height="12" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="76" y="54" width="16" height="22" fill="#475569" stroke="#94a3b8" />
        {across.slice(0, 2).map((y) => (
          <line key={`across-top-${y}`} x1="77" y1={y} x2="91" y2={y} stroke="#fb923c" strokeOpacity="0.6" />
        ))}
        <g className="v-ff2a-half">
          <rect x="76" y="76" width="16" height="22" fill="#475569" stroke="#94a3b8" />
          {across.slice(2).map((y) => (
            <line
              key={`across-bottom-${y}`}
              x1="77"
              y1={y}
              x2="91"
              y2={y}
              stroke="#fb923c"
              strokeOpacity="0.6"
            />
          ))}
          <rect x="72" y="102" width="24" height="12" rx="2" fill="#334155" stroke="#94a3b8" />
        </g>
        <rect className="v-ff2a-gap" x="74" y="74" width="20" height="4" fill="#f97316" />
        <line x1="100" y1="108" x2="100" y2="113" stroke="#94a3b8" strokeWidth="1.2" />
        <polygon points="97,113 103,113 100,118" fill="#94a3b8" />
        <text x="84" y="136" fontSize="10" fontWeight="bold" fill="#fdba74" textAnchor="middle">
          расслоился
        </text>

        {/* Слои вдоль нагрузки: деталь держит груз и не расходится */}
        <text x="236" y="32" fontSize="10" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
          слои вдоль
        </text>
        <rect x="208" y="40" width="56" height="12" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="228" y="54" width="16" height="44" fill="#475569" stroke="#94a3b8" />
        {along.map((x) => (
          <line key={`along-${x}`} x1={x} y1="55" x2={x} y2="97" stroke="#34d399" strokeOpacity="0.6" />
        ))}
        <g className="v-ff2a-load">
          <rect x="224" y="102" width="24" height="12" rx="2" fill="#334155" stroke="#94a3b8" />
        </g>
        <line x1="252" y1="108" x2="252" y2="113" stroke="#94a3b8" strokeWidth="1.2" />
        <polygon points="249,113 255,113 252,118" fill="#94a3b8" />
        <text x="236" y="136" fontSize="10" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
          держит
        </text>

        <text x="12" y="170" fontSize="9" fill="#94a3b8">
          ориентация решает
        </text>

      </svg>
    </VisualWrapper>
  );
}
