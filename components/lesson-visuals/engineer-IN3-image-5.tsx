import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 27 урока IN3 «Рёбра жёсткости и усиление деталей».
 *
 * Макет из описания кадра `IN3_gusset_shear.png`: прямоугольник без раскоса
 * превращается в ромб, диагональ делит его на два жёстких треугольника.
 * Внизу — косынка 45° с радиусом 1–2 мм и толщиной до 5 мм из блока 26.
 */
export function EngineerIN3Image5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Косынка и сдвиг. Слева прямоугольная рамка без раскоса под сдвигом становится ромбом. Справа диагональ делит рамку на два треугольника, и угол держит форму. Внизу косынка под 45 градусов, радиус в корне 1–2 мм, толщина до 5 мм"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          косынка превращает угол в треугольник
        </text>

        {/* Рамка без раскоса: сдвиг превращает её в ромб. */}
        <rect x="12" y="22" width="146" height="90" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="85" y="35" fontSize="10" fontWeight="700" fill="#f87171" textAnchor="middle">
          без раскоса
        </text>
        <rect x="40" y="44" width="90" height="48" fill="none" stroke="#f87171" strokeWidth="1.5" />
        <polygon
          points="55,44 130,56 115,92 40,84"
          fill="#f87171"
          fillOpacity="0.08"
          stroke="#f87171"
          strokeWidth="1.5"
          strokeDasharray="4 2"
        />
        <text x="85" y="106" fontSize="10" fill="#f87171" textAnchor="middle">
          угол гуляет
        </text>

        {/* Диагональ: два треугольника вместо ромба. */}
        <rect x="162" y="22" width="146" height="90" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="235" y="35" fontSize="10" fontWeight="700" fill="#10b981" textAnchor="middle">
          с диагональю
        </text>
        <rect x="190" y="44" width="90" height="48" fill="none" stroke="#10b981" strokeWidth="1.5" />
        <polygon points="190,44 280,44 280,92" fill="#10b981" fillOpacity="0.12" />
        <polygon points="190,44 190,92 280,92" fill="#10b981" fillOpacity="0.08" />
        <line x1="190" y1="92" x2="280" y2="44" stroke="#10b981" strokeWidth="2" />
        <text x="235" y="106" fontSize="10" fill="#10b981" textAnchor="middle">
          два треугольника
        </text>

        {/* Косынка в углу: 45°, галтель и толщина. */}
        <rect x="28" y="126" width="7" height="36" rx="1" fill="#334155" stroke="#64748b" />
        <rect x="35" y="156" width="65" height="7" rx="1" fill="#334155" stroke="#64748b" />
        <polygon points="35,126 65,156 35,156" fill="#3b82f6" fillOpacity="0.4" stroke="#60a5fa" />
        <path d="M 35 150 Q 35 156 41 156" fill="none" stroke="#10b981" strokeWidth="2" />
        <text x="40" y="142" fontSize="10" fill="#fcd34d">
          45°
        </text>
        <text x="72" y="152" fontSize="10" fill="#93c5fd">
          R 1–2
        </text>

        <text x="128" y="136" fontSize="10" fill="#cbd5e1">
          сдвиг не любит
        </text>
        <text x="128" y="150" fontSize="10" fill="#cbd5e1">
          острых углов
        </text>
        <text x="128" y="168" fontSize="10" fontWeight="700" fill="#fcd34d">
          45° · R1–2 · до 5 мм
        </text>
      </svg>
    </VisualWrapper>
  );
}
