import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * PEI при нагреве — поведение из content урока: при 60 °C стол держит деталь,
 * при 30 °C отпускает, и секрет в разном тепловом расширении. Нагретая пластина
 * показана шире пунктирного номинала, деталь лежит на ней; остывшая сжимается
 * обратно, и деталь поднимается сама.
 *
 * От «Теплового барьера» из соседнего урока отличается предметом: там разрез
 * узла и засор, здесь пара «стол и деталь» и два состояния температуры.
 *
 * Анимация 4 с, по кругу: нагрев, удержание, остывание, снятие. Чип температуры
 * и подписи двух состояний стоят в разных углах кадра, поэтому в каждый момент
 * читается активное.
 * При prefers-reduced-motion показан нагретый стол с лежащей деталью.
 *
 * Классы с префиксом v-pb2a: <style> внутри SVG действует на всю страницу.
 */
export function ProB2Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: нагретая до 60 градусов пластина PEI расширяется и держит деталь, а при остывании до 30 градусов сжимается обратно и отпускает её — дело в разном тепловом расширении"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-pb2a-plate { animation: v-pb2a-expand 4s ease-in-out infinite; transform-origin: 160px 118px; }
          .v-pb2a-part { animation: v-pb2a-lift 4s ease-in-out infinite; }
          .v-pb2a-up { animation: v-pb2a-show 4s ease-in-out infinite; }
          .v-pb2a-hot { animation: v-pb2a-first 4s ease-in-out infinite; }
          .v-pb2a-cold { animation: v-pb2a-second 4s ease-in-out infinite; }
          @keyframes v-pb2a-expand {
            0%, 40% { transform: scaleX(1.04); }
            55%, 90% { transform: scaleX(1); }
            100% { transform: scaleX(1.04); }
          }
          @keyframes v-pb2a-lift {
            0%, 40% { transform: translateY(0); }
            55%, 90% { transform: translateY(-14px); }
            100% { transform: translateY(0); }
          }
          @keyframes v-pb2a-show {
            0%, 40% { opacity: 0.1; }
            55%, 90% { opacity: 1; }
            100% { opacity: 0.1; }
          }
          @keyframes v-pb2a-first {
            0%, 40% { opacity: 1; }
            55%, 90% { opacity: 0.3; }
            100% { opacity: 1; }
          }
          @keyframes v-pb2a-second {
            0%, 40% { opacity: 0.3; }
            55%, 90% { opacity: 1; }
            100% { opacity: 0.3; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-pb2a-plate, .v-pb2a-part, .v-pb2a-hot, .v-pb2a-cold { animation: none; }
            .v-pb2a-up { animation: none; opacity: 0; }
            .v-pb2a-hot, .v-pb2a-cold { opacity: 1; }
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

        {/* Нагретое состояние: чип температуры и что происходит со столом */}
        <rect x="14" y="18" width="64" height="22" rx="6" fill="#0f172a" stroke="#f97316" />
        <text x="46" y="33" fontSize="10" fontWeight="bold" fill="#fdba74" textAnchor="middle">
          60 °C
        </text>
        <g className="v-pb2a-hot">
          <text x="90" y="26" fontSize="10" fill="#fdba74">
            стол расширен
          </text>
          <text x="90" y="44" fontSize="10" fill="#fdba74">
            PEI держит деталь
          </text>
        </g>

        <text x="14" y="64" fontSize="10" fill="#94a3b8">
          секрет — разное тепловое расширение
        </text>

        {/* Стол: лист PEI сверху и основа — расширяются вместе */}
        <g className="v-pb2a-plate">
          <rect
            x="44"
            y="104"
            width="232"
            height="8"
            fill="#f59e0b"
            fillOpacity="0.3"
            stroke="#f59e0b"
          />
          <rect x="44" y="112" width="232" height="14" rx="2" fill="#334155" stroke="#64748b" />
        </g>

        {/* Пунктирный номинал: по нему видно, насколько расширилась нагретая пластина */}
        <rect
          x="48"
          y="104"
          width="224"
          height="22"
          fill="none"
          stroke="#94a3b8"
          strokeDasharray="4 3"
        />

        {/* Куда уходит пластина при нагреве */}
        <line x1="60" y1="131" x2="46" y2="131" stroke="#f59e0b" strokeWidth="1.2" />
        <polygon points="46,128 40,131 46,134" fill="#f59e0b" />
        <line x1="260" y1="131" x2="274" y2="131" stroke="#f59e0b" strokeWidth="1.2" />
        <polygon points="274,128 280,131 274,134" fill="#f59e0b" />

        {/* Деталь: на горячем столе лежит, на холодном поднимается */}
        <g className="v-pb2a-part">
          <rect x="130" y="78" width="60" height="26" rx="2" fill="#1e3a5f" stroke="#38bdf8" />
          <line x1="136" y1="88" x2="184" y2="88" stroke="#38bdf8" strokeWidth="0.8" />
          <line x1="136" y1="96" x2="184" y2="96" stroke="#38bdf8" strokeWidth="0.8" />
        </g>
        <g className="v-pb2a-up">
          <line x1="200" y1="104" x2="200" y2="94" stroke="#fbbf24" strokeWidth="1.4" />
          <polygon points="197,94 203,94 200,88" fill="#fbbf24" />
        </g>

        {/* Остывшее состояние: чип температуры и что делает деталь */}
        <rect x="14" y="136" width="64" height="22" rx="6" fill="#0f172a" stroke="#38bdf8" />
        <text x="46" y="151" fontSize="10" fontWeight="bold" fill="#93c5fd" textAnchor="middle">
          30 °C
        </text>
        <g className="v-pb2a-cold">
          <text x="90" y="144" fontSize="10" fill="#93c5fd">
            стол сжался
          </text>
          <text x="90" y="160" fontSize="10" fill="#93c5fd">
            деталь отходит сама
          </text>
        </g>
      </svg>
    </VisualWrapper>
  );
}
