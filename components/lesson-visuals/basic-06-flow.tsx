import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 6 · image «Поток: мало, норма, много» (Модуль 2: Настройка печати).
 *
 * Из описания блока: 90% — щели, стенки рыхлые; 100% — ровно, плотно;
 * 110% — бугры, наплывы, размеры больше заданных (пунктир — заданный размер).
 */
export function Basic06Flow({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три стенки: при 90% щели, при 100% ровно, при 110% бугры и размеры больше заданных"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <text x="75" y="28" fontSize="13" fill="#f59e0b" textAnchor="middle" fontWeight="bold">
          90%
        </text>
        <text x="175" y="28" fontSize="13" fill="#3b82f6" textAnchor="middle" fontWeight="bold">
          100%
        </text>
        <text x="272" y="28" fontSize="13" fill="#ef4444" textAnchor="middle" fontWeight="bold">
          110%
        </text>

        {[46, 62, 78, 94, 110].map((y) => (
          <g key={y}>
            <rect x="30" y={y} width="90" height="12" fill="#1e293b" stroke="#f59e0b" strokeWidth="0.8" />
            <line x1="60" y1={y + 2} x2="60" y2={y + 10} stroke="#f59e0b" strokeDasharray="3 3" />
            <line x1="92" y1={y + 2} x2="92" y2={y + 10} stroke="#f59e0b" strokeDasharray="3 3" />
          </g>
        ))}

        <rect x="130" y="42" width="90" height="88" fill="#1d4ed8" stroke="#3b82f6" />
        {[52, 62, 72, 82, 92, 102, 112].map((y) => (
          <line key={y} x1="130" y1={y} x2="220" y2={y} stroke="#93c5fd" />
        ))}

        <rect x="238" y="46" width="72" height="80" fill="none" stroke="#64748b" strokeDasharray="4 3" />
        <text x="238" y="42" fontSize="6.5" fill="#94a3b8">
          заданный размер
        </text>
        <polygon
          points="228,50 262,44 300,46 314,52 312,90 314,124 300,132 258,130 232,124 226,88"
          fill="#7f1d1d"
          stroke="#ef4444"
        />
        <ellipse cx="228" cy="72" rx="5" ry="7" fill="#ef4444" />
        <ellipse cx="312" cy="104" rx="5" ry="7" fill="#ef4444" />
        <ellipse cx="270" cy="131" rx="7" ry="4" fill="#ef4444" />

        <line x1="16" y1="134" x2="304" y2="134" stroke="#475569" strokeWidth="2" />
        <text x="75" y="148" fontSize="7.5" fill="#fcd34d" textAnchor="middle">
          90%: щели, стенки рыхлые
        </text>
        <text x="175" y="148" fontSize="7.5" fill="#93c5fd" textAnchor="middle">
          100%: ровно, плотно
        </text>
        <text x="272" y="148" fontSize="7.5" fill="#fca5a5" textAnchor="middle">
          110%: бугры, наплывы
        </text>
        <text x="272" y="160" fontSize="7" fill="#94a3b8" textAnchor="middle">
          размеры больше заданных
        </text>
        <text x="16" y="172" fontSize="7" fill="#64748b">
          наплывы — лишний пластик выходит за стенку
        </text>
      </svg>
    </VisualWrapper>
  );
}
