import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * «Надеты на человеке» — фигура в СИЗ и подписи к каждой вещи с выноской.
 * Смысл кадра: не «что защищает от чего» списком, а что именно на человеке
 * к моменту работы и при какой работе это обязательно.
 *
 * От E-хим1 (таблица-соответствие «опасность → средство защиты», квадратики и
 * подписи под ними) отличается объектом: там перечень, здесь один человек в
 * надетом снаряжении. От T-тизер (силуэт в полный рост и таблички по бокам) —
 * тем, что кадр про конкретные вещи на лице и руках, а не про силуэт и статус.
 * Плашек и списков нет: только фигура, вещи и короткие выноски.
 */
export function ProCPozhCPozh2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Фигура человека в средствах защиты: очки, респиратор с угольным фильтром, перчатки и фартук. К каждой вещи идёт выноска: респиратор — угольный фильтр, очки — шкурка, нож и пайка, перчатки — эпоксидка и ацетон, фартук — химия. Рядом принтер с испарениями ABS."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          СИЗ: что надето и зачем это нужно
        </text>

        {/* Фигура: торс и голова, дальше СИЗ надеваются поверх */}
        <path
          d="M136,64 C120,64 108,72 106,86 L100,120 H172 L166,86 C164,72 152,64 136,64 Z"
          fill="#334155"
          stroke="#64748b"
          strokeWidth="0.9"
        />
        <rect x="130" y="56" width="12" height="12" rx="2" fill="#334155" />
        <circle cx="136" cy="46" r="15" fill="#334155" stroke="#64748b" strokeWidth="1.1" />

        {/* Очки: два стекла с дужкой вокруг головы */}
        <rect x="125" y="36" width="9" height="7" rx="1.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.1" />
        <rect x="138" y="36" width="9" height="7" rx="1.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.1" />
        <line x1="134" y1="39.5" x2="138" y2="39.5" stroke="#38bdf8" strokeWidth="1.1" />
        <line x1="125" y1="39.5" x2="118" y2="39.5" stroke="#94a3b8" strokeWidth="1.2" />
        <line x1="147" y1="39.5" x2="154" y2="39.5" stroke="#94a3b8" strokeWidth="1.2" />

        {/* Респиратор с двумя угольными фильтрами */}
        <line x1="117" y1="51" x2="110" y2="47" stroke="#94a3b8" strokeWidth="1" />
        <line x1="155" y1="51" x2="162" y2="47" stroke="#94a3b8" strokeWidth="1" />
        <circle cx="117" cy="55" r="5.5" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
        <circle cx="155" cy="55" r="5.5" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
        <rect x="122" y="48" width="28" height="13" rx="5" fill="#e2e8f0" fillOpacity="0.9" stroke="#94a3b8" strokeWidth="1.1" />

        {/* Фартук поверх одежды: завязки на плечах */}
        <path d="M116,72 H156 L164,120 H108 Z" fill="#fbbf24" fillOpacity="0.16" stroke="#fbbf24" strokeWidth="1.2" />
        <line x1="120" y1="72" x2="126" y2="63" stroke="#fbbf24" strokeWidth="1" />
        <line x1="152" y1="72" x2="146" y2="63" stroke="#fbbf24" strokeWidth="1" />

        {/* Перчатки на обеих руках */}
        <rect x="88" y="104" width="20" height="15" rx="6" fill="#1e3a8a" fillOpacity="0.7" stroke="#60a5fa" strokeWidth="1.1" />
        <circle cx="86" cy="111" r="3.5" fill="#1e3a8a" fillOpacity="0.7" stroke="#60a5fa" strokeWidth="1.1" />
        <rect x="164" y="104" width="20" height="15" rx="6" fill="#1e3a8a" fillOpacity="0.7" stroke="#60a5fa" strokeWidth="1.1" />
        <circle cx="186" cy="111" r="3.5" fill="#1e3a8a" fillOpacity="0.7" stroke="#60a5fa" strokeWidth="1.1" />
        {/* Принтер рядом: напоминание, от чего именно защищаемся */}
        <path d="M256,42 C258,34 254,30 256,22" fill="none" stroke="#a78bfa" strokeWidth="1" strokeOpacity="0.75" />
        <path d="M266,40 C268,32 264,28 266,20" fill="none" stroke="#a78bfa" strokeWidth="1" strokeOpacity="0.75" />
        <path d="M276,42 C278,34 274,30 276,22" fill="none" stroke="#a78bfa" strokeWidth="1" strokeOpacity="0.75" />
        <rect x="250" y="44" width="48" height="9" rx="2" fill="#334155" stroke="#94a3b8" strokeWidth="1" />
        <rect x="244" y="53" width="60" height="40" rx="3" fill="#334155" stroke="#60a5fa" strokeWidth="1.2" />
        <rect x="250" y="60" width="48" height="8" rx="1" fill="#0f172a" stroke="#475569" strokeWidth="0.8" />
        <circle cx="300" cy="46" r="8" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.1" />
        <circle cx="300" cy="46" r="3" fill="#f59e0b" fillOpacity="0.5" />
        <text x="274" y="110" fontSize="7.5" fill="#a78bfa" textAnchor="middle">
          ABS: испарения
        </text>

        {/* Выноски: вещь на фигуре → работа, для которой она нужна */}
        <line x1="100" y1="44" x2="113" y2="52" stroke="#64748b" strokeWidth="0.9" />
        <text x="98" y="40" fontSize="7.5" fill="#e2e8f0" textAnchor="end">
          респиратор
        </text>
        <text x="98" y="51" fontSize="7.5" fill="#94a3b8" textAnchor="end">
          угольный фильтр
        </text>

        <line x1="154" y1="40" x2="172" y2="36" stroke="#64748b" strokeWidth="0.9" />
        <text x="176" y="28" fontSize="7.5" fill="#e2e8f0">
          очки
        </text>
        <text x="176" y="39" fontSize="7.5" fill="#94a3b8">
          шкурка, нож,
        </text>
        <text x="176" y="50" fontSize="7.5" fill="#94a3b8">
          пайка
        </text>

        <line x1="97" y1="124" x2="95" y2="120" stroke="#64748b" strokeWidth="0.9" />
        <text x="100" y="132" fontSize="7.5" fill="#e2e8f0" textAnchor="end">
          перчатки
        </text>
        <text x="100" y="143" fontSize="7.5" fill="#94a3b8" textAnchor="end">
          эпоксидка, ацетон
        </text>

        <line x1="176" y1="130" x2="166" y2="120" stroke="#64748b" strokeWidth="0.9" />
        <text x="178" y="126" fontSize="7.5" fill="#e2e8f0">
          фартук
        </text>
        <text x="178" y="137" fontSize="7.5" fill="#94a3b8">
          химия
        </text>

        <text x="12" y="168" fontSize="8" fill="#94a3b8">
          СИЗ надевают до работы, а не после первой ошибки
        </text>
      </svg>
    </VisualWrapper>
  );
}
