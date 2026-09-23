import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 11 · image «Схема SLA» (Модуль 4: Знакомство со SLA).
 *
 * Из описания блока: ванна с жидкой смолой, платформа, источник света (лазер или LCD),
 * подписанные узлы и рядом миниатюра, напечатанная на SLA.
 */
export function Basic11SlaScheme({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Разрез SLA-принтера: ванна с жидкой смолой, платформа с деталью, источник света лазер или LCD и миниатюра"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <text x="8" y="16" fontSize="8.5" fill="#cbd5e1">
          Разрез SLA-принтера
        </text>

        <rect x="120" y="8" width="8" height="28" fill="#475569" />
        <rect x="88" y="36" width="72" height="9" rx="2" fill="#334155" stroke="#64748b" />
        <text x="166" y="44" fontSize="8" fill="#cbd5e1">
          платформа
        </text>
        <line x1="164" y1="42" x2="161" y2="42" stroke="#475569" />

        <circle cx="124" cy="52" r="9" fill="#3b82f6" opacity="0.5" />
        <rect x="108" y="58" width="32" height="18" rx="2" fill="#3b82f6" opacity="0.5" />

        <path d="M36 92 V142 H212 V92" fill="none" stroke="#64748b" strokeWidth="3" />
        <rect x="38" y="102" width="172" height="38" fill="#1d4ed8" opacity="0.22" />
        <line x1="38" y1="102" x2="210" y2="102" stroke="#3b82f6" opacity="0.7" />
        <text x="36" y="86" fontSize="8" fill="#93c5fd">
          ванна с жидкой смолой
        </text>

        <rect x="96" y="150" width="56" height="14" rx="2" fill="#334155" stroke="#f59e0b" />
        {[106, 118, 130, 142].map((x) => (
          <line key={x} x1={x} y1="148" x2={x} y2="142" stroke="#f59e0b" strokeDasharray="3 2" />
        ))}
        <text x="36" y="176" fontSize="7.5" fill="#fcd34d">
          источник света: лазер или LCD
        </text>

        <rect x="232" y="44" width="76" height="112" rx="4" fill="#0f172a" stroke="#475569" />
        <circle cx="270" cy="76" r="12" fill="#93c5fd" opacity="0.45" />
        <rect x="256" y="90" width="28" height="34" rx="3" fill="#93c5fd" opacity="0.45" />
        <rect x="250" y="124" width="40" height="8" rx="2" fill="#3b82f6" opacity="0.55" />
        <text x="232" y="168" fontSize="7" fill="#94a3b8">
          миниатюра,
        </text>
        <text x="232" y="178" fontSize="7" fill="#94a3b8">
          напечатанная на SLA
        </text>
      </svg>
    </VisualWrapper>
  );
}
