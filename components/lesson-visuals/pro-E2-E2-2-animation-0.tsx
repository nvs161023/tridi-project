import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Высокотемпературные материалы из content урока: «Обычный принтер vs
 * высокотемпературный. У второго — цельнометаллический хотэнд, камера 80 °C,
 * стол 120 °C, закалённое сопло».
 *
 * От «Разреза хотэнда» и «Теплового барьера» (B1) отличается предметом: там
 * устройство узла и процесс внутри шейки, здесь две сцены одного принтера и
 * результат печати — без камеры деталь идёт с расслоением, в камере выходит
 * ровной. От «Плана принтера» (C1-2) и изометрии базового урока — ракурс:
 * принтер показан фронтально, а от камеры виден только кожух с четырьмя
 * условиями рядом.
 *
 * Анимация 6 с, по кругу: трещины проступают в левой детали, кожух камеры
 * разогревается, четыре условия подсвечиваются по очереди.
 * При prefers-reduced-motion трещины видны, условия подсвечены все сразу.
 *
 * Классы с префиксом v-e22a: <style> внутри SVG действует на всю страницу.
 */
export function ProE2E22Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: слева обычный принтер без камеры — деталь из PC идёт с расслоением; справа принтер с закрытой камерой, деталь выходит ровной, а рядом четыре условия: цельнометаллический хотэнд, камера 80 градусов, стол 120 градусов и стальное сопло"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-e22a-crack { opacity: 0; animation: v-e22a-show 6s ease-in-out infinite; }
          .v-e22a-dome { animation: v-e22a-warm 6s ease-in-out infinite; }
          .v-e22a-cond { animation: v-e22a-pulse 6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          .v-e22a-c1 { animation-delay: 0s; }
          .v-e22a-c2 { animation-delay: 1.2s; }
          .v-e22a-c3 { animation-delay: 2.4s; }
          .v-e22a-c4 { animation-delay: 3.6s; }
          @keyframes v-e22a-show {
            0%, 30% { opacity: 0; }
            45%, 90% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes v-e22a-warm {
            0%, 20% { fill-opacity: 0.05; }
            40%, 80% { fill-opacity: 0.18; }
            100% { fill-opacity: 0.05; }
          }
          @keyframes v-e22a-pulse {
            0%, 100% { opacity: 0.35; transform: scale(0.8); }
            22% { opacity: 1; transform: scale(1.25); }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-e22a-crack { animation: none; opacity: 1; }
            .v-e22a-dome { animation: none; fill-opacity: 0.18; }
            .v-e22a-cond { animation: none; opacity: 1; transform: none; }
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
          печать PC и PEEK: что нужно принтеру
        </text>

        <text x="48" y="30" fontSize="9" fill="#fca5a5" textAnchor="middle">
          обычный
        </text>
        <text x="132" y="30" fontSize="9" fill="#6ee7b7" textAnchor="middle">
          в камере
        </text>
        {/* Слева: обычный принтер, деталь идёт с расслоением */}
        <rect x="18" y="42" width="60" height="7" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="18" y="42" width="5" height="58" fill="#334155" />
        <rect x="73" y="42" width="5" height="58" fill="#334155" />
        <rect x="16" y="100" width="64" height="6" rx="2" fill="#334155" />
        <rect x="36" y="54" width="22" height="12" rx="2" fill="#475569" stroke="#64748b" />
        <polygon points="42,66 52,66 47,76" fill="#94a3b8" />
        <rect x="38" y="78" width="22" height="12" rx="1" fill="#94a3b8" />
        <line
          className="v-e22a-crack"
          x1="40"
          y1="82"
          x2="58"
          y2="82"
          stroke="#f87171"
          strokeWidth="1.2"
        />
        <line
          className="v-e22a-crack"
          x1="42"
          y1="86"
          x2="56"
          y2="86"
          stroke="#f87171"
          strokeWidth="1.2"
        />
        <rect x="26" y="90" width="42" height="5" rx="2" fill="#475569" />
        <text x="48" y="126" fontSize="7.5" fill="#f87171" textAnchor="middle">
          расслоение
        </text>

        {/* Справа: тот же принтер, но в закрытой камере */}
        <rect
          className="v-e22a-dome"
          x="98"
          y="42"
          width="68"
          height="64"
          rx="6"
          fill="#f97316"
          fillOpacity="0.05"
          stroke="#fb923c"
          strokeDasharray="5 3"
        />
        <rect x="104" y="50" width="52" height="6" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="104" y="50" width="5" height="44" fill="#334155" />
        <rect x="151" y="50" width="5" height="44" fill="#334155" />
        <rect x="118" y="58" width="20" height="11" rx="2" fill="#475569" stroke="#64748b" />
        <polygon points="123,69 133,69 128,78" fill="#94a3b8" />
        <rect x="120" y="80" width="20" height="11" rx="1" fill="#6ee7b7" />
        <rect x="110" y="91" width="40" height="4" rx="2" fill="#475569" />
        <rect x="102" y="96" width="56" height="5" rx="2" fill="#334155" />
        <text x="132" y="126" fontSize="7.5" fill="#6ee7b7" textAnchor="middle">
          ровная
        </text>

        {/* Четыре условия высокотемпературной печати */}
        <circle className="v-e22a-cond v-e22a-c1" cx="170" cy="43" r="3" fill="#fb923c" />
        <circle className="v-e22a-cond v-e22a-c2" cx="170" cy="63" r="3" fill="#fb923c" />
        <circle className="v-e22a-cond v-e22a-c3" cx="170" cy="83" r="3" fill="#fb923c" />
        <circle className="v-e22a-cond v-e22a-c4" cx="170" cy="103" r="3" fill="#fb923c" />
        <text x="176" y="46" fontSize="8.5" fill="#e2e8f0">
          цельнометаллический хотэнд
        </text>
        <text x="176" y="66" fontSize="8.5" fill="#e2e8f0">
          камера 80 °C
        </text>
        <text x="176" y="86" fontSize="8.5" fill="#e2e8f0">
          стол 120 °C
        </text>
        <text x="176" y="106" fontSize="8.5" fill="#e2e8f0">
          стальное сопло
        </text>
      </svg>
    </VisualWrapper>
  );
}
