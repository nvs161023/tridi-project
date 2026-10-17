import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 4 урока IN3 «Рёбра жёсткости и усиление деталей».
 *
 * Макет из описания кадра `IN3_rib_basics.png`: стенка без ребра и с ребром,
 * а внизу одно и то же сечение 10 × 2 мм плашмя и на ребро. Цифры — из блока 6:
 * высота 10 мм против 2 мм даёт 25× жёсткости с учётом ширины.
 */
export function EngineerIN3Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Ребро и стенка. Слева стенка толщиной 2 мм под боковой нагрузкой гнётся, справа та же стенка с ребром 10 мм держит форму. Внизу сечение 10 на 2 мм: плашмя высота 2 мм, на ребро 10 мм — в 25 раз жёстче"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in3-rib-load"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#f59e0b" />
          </marker>
          <pattern id="in3-rib-fixed" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#64748b" strokeWidth="1.5" />
          </pattern>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          сечение решает, кто гнётся
        </text>

        {/* Стенка без ребра: тонкая, с боковой нагрузкой и дугой прогиба. */}
        <rect x="12" y="22" width="146" height="82" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="85" y="35" fontSize="10" fontWeight="700" fill="#f87171" textAnchor="middle">
          без ребра
        </text>
        <rect x="48" y="50" width="9" height="38" rx="1" fill="#334155" stroke="#64748b" />
        <rect x="34" y="88" width="38" height="6" fill="url(#in3-rib-fixed)" stroke="#64748b" />
        <line x1="76" y1="56" x2="59" y2="56" stroke="#f59e0b" markerEnd="url(#in3-rib-load)" />
        <path d="M 52 87 Q 64 86 72 55" fill="none" stroke="#f87171" strokeWidth="1.5" strokeDasharray="3 2" />
        <text x="84" y="66" fontSize="10" fill="#cbd5e1">
          стенка 2 мм
        </text>
        <text x="84" y="84" fontSize="10" fill="#f87171">
          гнётся
        </text>

        {/* Стенка с ребром: та же нагрузка, ребро поперёк изгиба. */}
        <rect x="162" y="22" width="146" height="82" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="235" y="35" fontSize="10" fontWeight="700" fill="#10b981" textAnchor="middle">
          с ребром
        </text>
        <rect x="198" y="50" width="9" height="38" rx="1" fill="#334155" stroke="#64748b" />
        <rect x="207" y="60" width="30" height="6" rx="2" fill="#3b82f6" fillOpacity="0.85" stroke="#93c5fd" />
        <rect x="184" y="88" width="38" height="6" fill="url(#in3-rib-fixed)" stroke="#64748b" />
        <line x1="226" y1="56" x2="209" y2="56" stroke="#f59e0b" markerEnd="url(#in3-rib-load)" />
        <text x="240" y="52" fontSize="10" fill="#93c5fd">
          ребро 10 мм
        </text>
        <text x="240" y="84" fontSize="10" fill="#10b981">
          держит
        </text>

        {/* Сравнение сечения: плашмя против «на ребро». */}
        <text x="12" y="116" fontSize="10" fill="#94a3b8">
          сечение 10 × 2 мм
        </text>
        <rect x="30" y="128" width="80" height="10" rx="2" fill="#3b82f6" fillOpacity="0.55" stroke="#93c5fd" />
        <text x="70" y="152" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          плашмя · h = 2
        </text>
        <rect x="210" y="112" width="10" height="56" rx="2" fill="#3b82f6" fillOpacity="0.55" stroke="#93c5fd" />
        <text x="226" y="132" fontSize="10" fill="#cbd5e1">
          на ребро · h = 10
        </text>
        <line x1="120" y1="138" x2="198" y2="138" stroke="#f59e0b" markerEnd="url(#in3-rib-load)" />
        <text x="160" y="130" fontSize="12" fontWeight="700" fill="#fcd34d" textAnchor="middle">
          25× жёстче
        </text>
        <text x="12" y="170" fontSize="10" fill="#94a3b8">
          125× по формуле, 25× с учётом ширины
        </text>
      </svg>
    </VisualWrapper>
  );
}
