import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 31 урока IN3 «Рёбра жёсткости и усиление деталей».
 *
 * Макет из описания кадра `IN3_test_sample.png`: две одинаковые балки на опорах,
 * с ребром и без. Внизу — план испытания из блока 30: две детали, 20 минут,
 * 100 циклов; белое пятно показывает начало разрушения.
 */
export function EngineerIN3Image6({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Образец с ребром и без. Слева балка без ребра прогибается, справа балка с ребром почти прямая. Внизу план: две детали, 20 минут, 100 циклов. Белое пятно на образце показывает начало разрушения"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in3-test-load"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#f59e0b" />
          </marker>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          образец с ребром и без
        </text>

        {/* Балка без ребра: большой прогиб и белое пятно. */}
        <rect x="12" y="22" width="146" height="96" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="85" y="35" fontSize="10" fontWeight="700" fill="#f87171" textAnchor="middle">
          без ребра
        </text>
        <rect x="24" y="78" width="122" height="8" rx="2" fill="#334155" stroke="#64748b" />
        <polygon points="30,94 40,94 35,84" fill="#475569" stroke="#64748b" />
        <polygon points="130,94 140,94 135,84" fill="#475569" stroke="#64748b" />
        <line x1="85" y1="58" x2="85" y2="77" stroke="#f59e0b" markerEnd="url(#in3-test-load)" />
        <path d="M 24 84 Q 85 100 146 84" fill="none" stroke="#f87171" strokeWidth="1.5" strokeDasharray="4 2" />
        <circle cx="118" cy="82" r="2.4" fill="#f8fafc" stroke="#f87171" />
        <text x="85" y="112" fontSize="10" fill="#f87171" textAnchor="middle">
          большой прогиб
        </text>

        {/* Балка с ребром: прогиб почти незаметен. */}
        <rect x="162" y="22" width="146" height="96" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="235" y="35" fontSize="10" fontWeight="700" fill="#10b981" textAnchor="middle">
          с ребром
        </text>
        <rect x="174" y="78" width="122" height="8" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="230" y="86" width="26" height="6" rx="2" fill="#3b82f6" fillOpacity="0.75" stroke="#93c5fd" />
        <polygon points="180,94 190,94 185,84" fill="#475569" stroke="#64748b" />
        <polygon points="280,94 290,94 285,84" fill="#475569" stroke="#64748b" />
        <line x1="235" y1="58" x2="235" y2="77" stroke="#f59e0b" markerEnd="url(#in3-test-load)" />
        <path d="M 174 84 Q 235 90 296 84" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x="235" y="112" fontSize="10" fill="#10b981" textAnchor="middle">
          почти прямой
        </text>

        <text x="12" y="142" fontSize="10" fontWeight="700" fill="#fcd34d">
          2 детали · 20 минут · 100 циклов
        </text>
        <text x="12" y="162" fontSize="10" fill="#94a3b8">
          белое пятно — начало разрушения
        </text>
      </svg>
    </VisualWrapper>
  );
}
