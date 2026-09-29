import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Два независимых кольца на одной плате. Путь нарисован по часовой стрелке,
 * поэтому бегущий импульс обходит узлы в правильном порядке.
 */
const LOOP_DRIVE =
  "M62,28 H258 A16,16 0 0 1 274,44 V66 A16,16 0 0 1 258,82 H62 A16,16 0 0 1 46,66 V44 A16,16 0 0 1 62,28 Z";
const LOOP_HEAT =
  "M62,110 H258 A16,16 0 0 1 274,126 V146 A16,16 0 0 1 258,162 H62 A16,16 0 0 1 46,146 V126 A16,16 0 0 1 62,110 Z";

/**
 * «Сигнал на плате»: два контура обратной связи идут по кругу, а не цепочкой —
 * процессор → драйвер → мотор и термистор → АЦП → процессор → нагрев.
 */
export function ProC2C21Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Два замкнутых контура обратной связи на плате принтера: сигнал идёт по кругу процессор → драйвер → мотор → обратно и термистор → АЦП → процессор → нагрев → обратно, по обоим кольцам бегут импульсы."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-c2a-flow-1 { animation: v-c2a-flow 1.8s linear infinite; }
          .v-c2a-flow-2 { animation: v-c2a-flow 2.6s linear infinite; }
          @keyframes v-c2a-flow { to { stroke-dashoffset: -18; } }
          @media (prefers-reduced-motion: reduce) {
            .v-c2a-flow-1, .v-c2a-flow-2 { animation: none; stroke-dasharray: none; }
          }
        `}</style>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Сигнал на плате: два контура обратной связи
        </text>

        {/* Контур приводов: кольцо целиком, импульс бежит по нему */}
        <path d={LOOP_DRIVE} fill="#0f172a" fillOpacity="0.55" stroke="#475569" strokeWidth="1.6" />
        <path
          d={LOOP_DRIVE}
          fill="#0f172a"
          fillOpacity="0.55"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5 13"
          className="v-c2a-flow-1"
        />

        <rect x="78" y="18" width="64" height="20" rx="4" fill="#334155" stroke="#60a5fa" strokeWidth="1.3" />
        <text x="110" y="31" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          CPU
        </text>
        <rect x="247" y="45" width="54" height="20" rx="4" fill="#334155" stroke="#f59e0b" strokeWidth="1.3" />
        <text x="274" y="58" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          драйвер
        </text>
        <rect x="123" y="72" width="54" height="20" rx="4" fill="#334155" stroke="#34d399" strokeWidth="1.3" />
        <text x="150" y="85" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          мотор
        </text>
        <text x="70" y="58" fontSize="8" fill="#94a3b8">
          CPU → драйвер → мотор → обратно
        </text>
        {/* Контур нагрева: своё кольцо и свой темп бегущего импульса */}
        <path d={LOOP_HEAT} fill="#0f172a" fillOpacity="0.55" stroke="#475569" strokeWidth="1.6" />
        <path
          d={LOOP_HEAT}
          fill="#0f172a"
          fillOpacity="0.55"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5 13"
          className="v-c2a-flow-2"
        />

        <rect x="13" y="126" width="66" height="20" rx="4" fill="#334155" stroke="#a78bfa" strokeWidth="1.3" />
        <text x="46" y="139" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          термистор
        </text>
        <rect x="130" y="100" width="40" height="20" rx="4" fill="#334155" stroke="#38bdf8" strokeWidth="1.3" />
        <text x="150" y="113" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          АЦП
        </text>
        <rect x="246" y="126" width="56" height="20" rx="4" fill="#334155" stroke="#60a5fa" strokeWidth="1.3" />
        <text x="274" y="139" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          CPU
        </text>
        <rect x="123" y="152" width="54" height="20" rx="4" fill="#334155" stroke="#f87171" strokeWidth="1.3" />
        <text x="150" y="165" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          нагрев
        </text>
        <text x="90" y="140" fontSize="8" fill="#94a3b8">
          термистор → АЦП → CPU → нагрев
        </text>
      </svg>
    </VisualWrapper>
  );
}
