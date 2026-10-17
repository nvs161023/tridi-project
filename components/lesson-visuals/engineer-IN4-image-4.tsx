import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 18 урока IN4 «Симуляция в CAD (Stress Analysis)».
 *
 * Макет из описания `IN4_stress_map.png`: карта напряжений на кронштейне,
 * легенда 0–20 МПа и расчёт запаса. Пример из блока 19: при напряжении
 * 20 МПа запас около 1,0, а норма для печатной детали — 2,5.
 */
export function EngineerIN4Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Карта напряжений. На кронштейне красная зона у внутреннего угла, легенда от 0 до 20 мегапаскалей. Справа запас прочности около 1,0 при напряжении 20 мегапаскалей, норма 2,5. Красное пятно без числа ничего не значит"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <linearGradient id="in4-4-base" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1d4ed8" />
            <stop offset="0.55" stopColor="#0ea5e9" />
            <stop offset="1" stopColor="#22c55e" />
          </linearGradient>
          <radialGradient id="in4-4-hot">
            <stop offset="0" stopColor="#ef4444" />
            <stop offset="0.35" stopColor="#f97316" />
            <stop offset="0.7" stopColor="#facc15" stopOpacity="0.8" />
            <stop offset="1" stopColor="#facc15" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="in4-4-legend" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1d4ed8" />
            <stop offset="0.4" stopColor="#22d3ee" />
            <stop offset="0.7" stopColor="#facc15" />
            <stop offset="1" stopColor="#ef4444" />
          </linearGradient>
          <clipPath id="in4-4-part">
            <polygon points="34,50 56,50 56,98 166,98 166,116 34,116" />
          </clipPath>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          карта напряжений: цвет и число
        </text>

        {/* Карта */}
        <rect x="12" y="23" width="184" height="118" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="22" y="38" fontSize="10" fontWeight="700" fill="#cbd5e1">
          напряжение
        </text>
        <polygon points="34,50 56,50 56,98 166,98 166,116 34,116" fill="url(#in4-4-base)" stroke="#64748b" />
        <circle cx="58" cy="98" r="42" fill="url(#in4-4-hot)" clipPath="url(#in4-4-part)" />
        <path d="M34 70 Q 50 76 62 93" fill="none" stroke="#fde68a" strokeWidth="0.8" strokeOpacity="0.6" clipPath="url(#in4-4-part)" />
        <path d="M34 76 Q 52 82 66 97" fill="none" stroke="#fdba74" strokeWidth="0.8" strokeOpacity="0.55" clipPath="url(#in4-4-part)" />
        <text x="94" y="72" fontSize="10" fontWeight="700" fill="#fca5a5">
          максимум
        </text>
        <line x1="101" y1="76" x2="66" y2="95" stroke="#f87171" strokeWidth="0.8" />

        <rect x="24" y="121" width="130" height="6" rx="2" fill="url(#in4-4-legend)" stroke="#475569" strokeWidth="0.5" />
        <text x="24" y="135" fontSize="10" fill="#94a3b8">
          0
        </text>
        <text x="126" y="135" fontSize="10" fill="#f87171">
          20 МПа
        </text>

        {/* Запас */}
        <rect x="206" y="23" width="102" height="118" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="216" y="38" fontSize="10" fontWeight="700" fill="#cbd5e1">
          запас
        </text>
        <text x="216" y="62" fontSize="16" fontWeight="700" fill="#f87171">
          ≈ 1,0
        </text>
        <text x="216" y="78" fontSize="10" fill="#94a3b8">
          при 20 МПа
        </text>
        <line x1="216" y1="86" x2="298" y2="86" stroke="#334155" />
        <text x="216" y="103" fontSize="10" fontWeight="700" fill="#6ee7b7">
          норма 2,5
        </text>
        <rect x="216" y="111" width="82" height="7" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="0.6" />
        <rect x="216" y="111" width="16" height="7" rx="3" fill="#ef4444" />
        <line x1="257" y1="108" x2="257" y2="121" stroke="#10b981" strokeWidth="1.4" />
        <text x="216" y="134" fontSize="10" fill="#cbd5e1">
          предел / напряжение
        </text>

        <text x="12" y="162" fontSize="10" fill="#94a3b8">
          красное пятно без числа ничего не значит
        </text>
      </svg>
    </VisualWrapper>
  );
}
