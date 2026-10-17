import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 12 урока IN9 «G-код: чтение и написание».
 *
 * Макет из описания `IN9_modes.png`: одна точка двумя режимами. Слева адрес
 * (G90) — X40 Y60 от нуля, справа шаг (G91) — X10 Y10 от текущего места.
 * Пример X30 в G91 и правило возврата в G90 — блок 11.
 */
export function EngineerIN9Diagram2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="G90 против G91: слева абсолютный режим читает X40 Y60 как адрес точки от нуля, справа относительный режим читает X10 Y10 как шаг от текущего места. X30 в G91 означает сдвиг на тридцать миллиметров, а не точку тридцать от нуля. После каждого G91 возвращай G90"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          g90 против g91: адрес и шаг
        </text>

        <defs>
          <marker id="in9-2-axis" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#64748b" />
          </marker>
          <marker id="in9-2-step" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#fbbf24" />
          </marker>
        </defs>

        {/* G90 — адрес */}
        <rect x="12" y="24" width="146" height="108" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="20" y="38" fontSize="10" fontWeight="700" fill="#38bdf8">
          G90 — адрес
        </text>
        <path d="M28 116 H146" stroke="#64748b" strokeWidth="1" markerEnd="url(#in9-2-axis)" />
        <path d="M28 116 V52" stroke="#64748b" strokeWidth="1" markerEnd="url(#in9-2-axis)" />
        <text x="138" y="127" fontSize="10" fill="#94a3b8">
          X
        </text>
        <text x="18" y="52" fontSize="10" fill="#94a3b8">
          Y
        </text>
        <path d="M68 56 V116 M28 56 H68" stroke="#38bdf8" strokeWidth="0.9" strokeDasharray="3 3" strokeOpacity="0.6" />
        <circle cx="68" cy="56" r="2.8" fill="#38bdf8" />
        <text x="84" y="50" fontSize="10" fontWeight="700" fill="#38bdf8">
          X40 Y60
        </text>
        <text x="60" y="128" fontSize="10" fill="#cbd5e1">
          40
        </text>
        <text x="15" y="60" fontSize="10" fill="#cbd5e1" textAnchor="end">
          60
        </text>
        <circle cx="28" cy="116" r="2.2" fill="#94a3b8" />
        <text x="34" y="128" fontSize="10" fill="#94a3b8">
          0
        </text>

        {/* G91 — шаг */}
        <rect x="164" y="24" width="144" height="108" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="172" y="38" fontSize="10" fontWeight="700" fill="#fbbf24">
          G91 — шаг
        </text>
        <circle cx="196" cy="104" r="2.8" fill="#94a3b8" />
        <path d="M196 104 L226 74" stroke="#fbbf24" strokeWidth="1.2" markerEnd="url(#in9-2-step)" />
        <path d="M196 104 H226 M226 104 V74" stroke="#fbbf24" strokeWidth="0.9" strokeDasharray="3 3" strokeOpacity="0.45" />
        <text x="200" y="64" fontSize="10" fontWeight="700" fill="#fbbf24">
          X10 Y10
        </text>
        <text x="176" y="120" fontSize="10" fill="#cbd5e1">
          сейчас здесь
        </text>

        <rect x="12" y="138" width="296" height="36" rx="6" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeOpacity="0.4" />
        <text x="22" y="152" fontSize="10" fill="#fbbf24">
          X30 в G91 — сдвиг на 30 мм, а не точка 30
        </text>
        <text x="22" y="167" fontSize="10" fill="#e2e8f0">
          после каждого G91 возвращай G90
        </text>
      </svg>
    </VisualWrapper>
  );
}
