import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 4 · image «Температурные настройки» (Модуль 2: Настройка печати).
 *
 * Из описания блока: экран принтера — сопло (Nozzle) и стол (Bed); для PLA —
 * 210 °C и 60 °C; для PETG — 240 °C и 80 °C; точные значения — на катушке.
 */
export function Basic04Temperatures({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Экран принтера с температурой сопла 210 °C и стола 60 °C, рядом катушки PLA 210/60 и PETG 240/80"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <text x="12" y="26" fontSize="8.5" fill="#cbd5e1">
          Экран принтера
        </text>
        <rect x="12" y="34" width="136" height="108" rx="6" fill="#0b1220" stroke="#475569" />
        <rect x="18" y="40" width="124" height="96" rx="3" fill="#0f172a" stroke="#334155" />
        <text x="28" y="62" fontSize="8" fill="#94a3b8">
          Nozzle — сопло
        </text>
        <text x="28" y="86" fontSize="17" fill="#f59e0b" fontWeight="bold">
          210 °C
        </text>
        <text x="28" y="108" fontSize="8" fill="#94a3b8">
          Bed — стол
        </text>
        <text x="28" y="132" fontSize="17" fill="#3b82f6" fontWeight="bold">
          60 °C
        </text>

        <circle cx="182" cy="74" r="22" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
        <circle cx="182" cy="74" r="6" fill="#334155" stroke="#64748b" />
        <text x="182" y="32" fontSize="10" fill="#e2e8f0" textAnchor="middle" fontWeight="bold">
          PLA
        </text>
        <text x="182" y="112" fontSize="7.5" fill="#f59e0b" textAnchor="middle">
          сопло 210 °C
        </text>
        <text x="182" y="124" fontSize="7.5" fill="#3b82f6" textAnchor="middle">
          стол 60 °C
        </text>

        <circle cx="266" cy="74" r="22" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
        <circle cx="266" cy="74" r="6" fill="#334155" stroke="#64748b" />
        <text x="266" y="32" fontSize="10" fill="#e2e8f0" textAnchor="middle" fontWeight="bold">
          PETG
        </text>
        <text x="266" y="112" fontSize="7.5" fill="#f59e0b" textAnchor="middle">
          сопло 240 °C
        </text>
        <text x="266" y="124" fontSize="7.5" fill="#3b82f6" textAnchor="middle">
          стол 80 °C
        </text>

        <text x="164" y="152" fontSize="7.5" fill="#94a3b8">
          Точные значения — на катушке
        </text>
      </svg>
    </VisualWrapper>
  );
}
