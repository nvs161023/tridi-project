import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Дуги эха у четырёх углов башни: по три на угол, внутрь от контура. */
const RIPPLES = [
  "M54,62 q8,1 9,9",
  "M60,62 q14,2 16,16",
  "M66,62 q20,3 23,23",
  "M130,62 q-8,1 -9,9",
  "M124,62 q-14,2 -16,16",
  "M118,62 q-20,3 -23,23",
  "M54,146 q8,-1 9,-9",
  "M60,146 q14,-2 16,-16",
  "M66,146 q20,-3 23,-23",
  "M130,146 q-8,-1 -9,-9",
  "M124,146 q-14,-2 -16,-16",
  "M118,146 q-20,-3 -23,-23",
];

/**
 * Ringing до и после Input Shaper — из content урока: «Волны на стенках исчезают
 * после Input Shaper. Скорость печати возрастает в 2 раза».
 *
 * Кадр — ОДНА деталь (башня в плане) с соплом, которое обходит её по контуру: у
 * углов за соплом проступают дуги эха. В панели справа — тумблер Input Shaper,
 * значения амплитуды и счётчик скорости. Двух стенок-колонн рядом нет: этот язык
 * занят («Как скорость влияет» в базовом уроке 7 и «Klipper и скорость» в B4), тут
 * одна деталь и переключатель. Трещин и крошек тоже нет — это не расслоение.
 *
 * Анимация 8 с: сопло идёт по периметру, эхо у углов держится, пока Input Shaper
 * выключен, и гаснет после переключения тумблера. При prefers-reduced-motion кадр
 * статичен и показывает результат: Input Shaper включён, волн нет.
 *
 * Классы с префиксом v-ii4a: <style> внутри SVG действует на всю страницу.
 */
export function ProII4Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: сопло обходит башню по периметру, у углов проступают волны эха; после включения Input Shaper волны гаснут, амплитуда падает с 0,4 до 0,05 мм, скорость вырастает вдвое"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-ii4a-nozzle { animation: v-ii4a-run 8s linear infinite; }
          .v-ii4a-ripple { animation: v-ii4a-echo 8s ease-in-out infinite; }
          .v-ii4a-off { animation: v-ii4a-off 8s steps(1, end) infinite; }
          .v-ii4a-on { animation: v-ii4a-on 8s steps(1, end) infinite; }
          .v-ii4a-before { animation: v-ii4a-before 8s ease-in-out infinite; }
          @keyframes v-ii4a-run {
            0% { transform: translate(0, 0); }
            25% { transform: translate(80px, 0); }
            50% { transform: translate(80px, 84px); }
            75% { transform: translate(0, 84px); }
            100% { transform: translate(0, 0); }
          }
          @keyframes v-ii4a-echo {
            0%, 45% { opacity: 0.95; }
            55%, 100% { opacity: 0.12; }
          }
          @keyframes v-ii4a-off {
            0%, 52% { opacity: 1; }
            53%, 100% { opacity: 0.25; }
          }
          @keyframes v-ii4a-on {
            0%, 52% { opacity: 0.25; }
            53%, 100% { opacity: 1; }
          }
          @keyframes v-ii4a-before {
            0%, 45% { opacity: 1; }
            55%, 100% { opacity: 0.35; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-ii4a-nozzle { animation: none; }
            .v-ii4a-ripple { animation: none; opacity: 0.12; }
            .v-ii4a-off { animation: none; opacity: 0.25; }
            .v-ii4a-on { animation: none; opacity: 1; }
            .v-ii4a-before { animation: none; opacity: 0.35; }
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

        <text x="12" y="14" fontSize="9" fill="#94a3b8">
          ringing: волны у углов детали
        </text>

        {/* Башня в плане: стенки по периметру, внутри пусто */}
        <rect x="44" y="56" width="96" height="96" fill="#0f172a" stroke="#94a3b8" />
        <rect x="44" y="56" width="96" height="5" fill="#475569" />
        <rect x="44" y="147" width="96" height="5" fill="#475569" />
        <rect x="44" y="56" width="5" height="96" fill="#475569" />
        <rect x="135" y="56" width="5" height="96" fill="#475569" />

        {/* Эхо у углов: пока Input Shaper выключен — дуги видны */}
        <g className="v-ii4a-ripple" fill="none" stroke="#f87171" strokeWidth="1.3">
          {RIPPLES.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        {/* Сопло обходит башню по контуру */}
        <circle className="v-ii4a-nozzle" cx="52" cy="62" r="4" fill="#e2e8f0" />

        {/* Панель: тумблер Input Shaper, амплитуда и скорость */}
        <rect x="176" y="56" width="136" height="112" rx="8" fill="#0f172a" stroke="#475569" />

        <text x="188" y="76" fontSize="9.5" fontWeight="bold" fill="#e2e8f0">
          Input Shaper
        </text>

        <rect x="188" y="86" width="54" height="18" rx="9" fill="#1e293b" stroke="#475569" />
        <rect className="v-ii4a-off" x="190" y="88" width="14" height="14" rx="7" fill="#f87171" />
        <rect className="v-ii4a-on" x="226" y="88" width="14" height="14" rx="7" fill="#34d399" />
        <text x="252" y="99" fontSize="8" fill="#94a3b8">
          off / on
        </text>

        <text className="v-ii4a-before" x="188" y="126" fontSize="9" fill="#f87171">
          до: 0,4 мм
        </text>
        <text x="188" y="144" fontSize="9" fill="#6ee7b7">
          после: 0,05 мм
        </text>
        <text x="188" y="160" fontSize="9" fill="#e2e8f0">
          скорость: выше в 2 раза
        </text>

        <text x="20" y="170" fontSize="9" fill="#94a3b8">
          волны у углов — эхо ускорений
        </text>
      </svg>
    </VisualWrapper>
  );
}

