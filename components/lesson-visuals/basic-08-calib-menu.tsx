import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 8 · image «Где найти калибровки» (Модуль 2: Настройка печати).
 *
 * Из описания блока: Bambu Studio — вкладка «Calibration» в верхнем меню;
 * Orca Slicer — значок «Calibration» на панели; FlashPrint — раздел «Tools» →
 * «Calibration». Помечены места, где искать.
 */
export function Basic08CalibMenu({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три интерфейса: в Bambu Studio вкладка Calibration в верхнем меню, в Orca Slicer значок на панели, в FlashPrint Tools → Calibration"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        {/* Bambu Studio */}
        <rect x="8" y="24" width="96" height="104" rx="4" fill="#0f172a" stroke="#475569" />
        <rect x="8" y="24" width="96" height="14" rx="4" fill="#1e293b" />
        <text x="14" y="34" fontSize="7" fill="#e2e8f0">
          Bambu Studio
        </text>
        {["File", "Edit", "View", "Settings"].map((item, i) => (
          <text key={item} x={16 + i * 20} y="50" fontSize="5.5" fill="#94a3b8">
            {item}
          </text>
        ))}
        <rect x="66" y="43" width="34" height="11" rx="2" fill="none" stroke="#3b82f6" />
        <text x="68" y="51" fontSize="5.5" fill="#93c5fd">
          Calibration
        </text>
        <path d="M92 58 L98 66 L92 68 Z" fill="#f59e0b" />
        {[62, 74, 86, 98, 110].map((y) => (
          <line key={y} x1="14" y1={y} x2="98" y2={y} stroke="#334155" />
        ))}
        <text x="8" y="142" fontSize="6.5" fill="#93c5fd">
          вкладка «Calibration»
        </text>
        <text x="8" y="152" fontSize="6.5" fill="#93c5fd">
          в верхнем меню
        </text>

        {/* Orca Slicer */}
        <rect x="112" y="24" width="96" height="104" rx="4" fill="#0f172a" stroke="#475569" />
        <rect x="112" y="24" width="96" height="14" rx="4" fill="#1e293b" />
        <text x="118" y="34" fontSize="7" fill="#e2e8f0">
          Orca Slicer
        </text>
        <rect x="116" y="42" width="16" height="80" rx="3" fill="#1e293b" stroke="#334155" />
        {[48, 62, 76, 90, 104].map((y) => (
          <rect key={y} x="121" y={y} width="6" height="6" rx="1" fill="#475569" />
        ))}
        <rect x="118" y="58" width="12" height="12" rx="2" fill="none" stroke="#3b82f6" />
        <text x="136" y="68" fontSize="5.5" fill="#93c5fd">
          Calibration
        </text>
        <path d="M128 72 L134 78 L128 80 Z" fill="#f59e0b" />
        <rect x="140" y="88" width="60" height="34" rx="3" fill="#0b1220" stroke="#334155" />
        <text x="8" y="142" fontSize="6.5" fill="#93c5fd">
          значок «Calibration»
        </text>
        <text x="8" y="152" fontSize="6.5" fill="#93c5fd">
          на панели
        </text>

        {/* FlashPrint */}
        <rect x="216" y="24" width="96" height="104" rx="4" fill="#0f172a" stroke="#475569" />
        <rect x="216" y="24" width="96" height="14" rx="4" fill="#1e293b" />
        <text x="222" y="34" fontSize="7" fill="#e2e8f0">
          FlashPrint
        </text>
        {["Home", "View", "Help"].map((item, i) => (
          <text key={item} x="224" y={48 + i * 14} fontSize="5.5" fill="#94a3b8">
            {item}
          </text>
        ))}
        <rect x="220" y="61" width="40" height="11" rx="2" fill="none" stroke="#3b82f6" />
        <text x="224" y="69" fontSize="5.5" fill="#93c5fd">
          Tools
        </text>
        <path d="M262 66 L268 72 L262 74 Z" fill="#f59e0b" />
        <rect x="268" y="58" width="40" height="60" rx="3" fill="#0b1220" stroke="#334155" />
        {["Settings", "Leveling", "Calibration"].map((item, i) => (
          <text key={item} x="274" y={70 + i * 14} fontSize="5.5" fill="#94a3b8">
            {item}
          </text>
        ))}
        <rect x="270" y="88" width="36" height="11" rx="2" fill="none" stroke="#3b82f6" />
        <text x="274" y="96" fontSize="5.5" fill="#93c5fd">
          Calibration
        </text>
        <text x="8" y="144" fontSize="6.5" fill="#93c5fd">
          раздел «Tools» → «Calibration»
        </text>
      </svg>
    </VisualWrapper>
  );
}
