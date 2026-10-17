import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 21 урока IN3 «Рёбра жёсткости и усиление деталей».
 *
 * Макет из описания кадра `IN3_layers_vs_ribs.png`: ребро, напечатанное
 * поперёк слоёв, рвётся по шву; ребро вдоль слоёв держит. Внизу — цифры
 * из блока 20: рёбра дают ×2–3 жёсткости, 3 периметра и толщина 0,8–1,2 мм.
 */
export function EngineerIN3Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Слои и рёбра. Слева ребро напечатано поперёк слоёв: нагрузка отрывает его по шву. Справа ребро вдоль слоёв держит нагрузку. Рёбра дают жёсткость в два-три раза, печатаются в три периметра толщиной 0,8–1,2 мм и идут вдоль нагрузки"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in3-layers-load"
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
          слои решают, где рвётся ребро
        </text>

        {/* Ребро поперёк слоёв: трещина идёт по шву. */}
        <rect x="12" y="22" width="146" height="86" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="85" y="35" fontSize="10" fontWeight="700" fill="#f87171" textAnchor="middle">
          поперёк слоёв
        </text>
        <rect x="70" y="44" width="18" height="52" rx="2" fill="#334155" stroke="#64748b" />
        {[50, 56, 62, 68, 74, 80, 86, 92].map((y) => (
          <line key={y} x1="70" y1={y} x2="88" y2={y} stroke="#94a3b8" strokeOpacity="0.45" />
        ))}
        <path d="M 70 82 L 76 79 L 82 84 L 88 81" fill="none" stroke="#f87171" strokeWidth="2" />
        <line x1="79" y1="37" x2="79" y2="43" stroke="#f59e0b" markerEnd="url(#in3-layers-load)" />
        <text x="85" y="104" fontSize="10" fill="#f87171" textAnchor="middle">
          рвётся по шву
        </text>

        {/* Ребро вдоль слоёв: нагрузка идёт по слоям. */}
        <rect x="162" y="22" width="146" height="86" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="235" y="35" fontSize="10" fontWeight="700" fill="#10b981" textAnchor="middle">
          вдоль слоёв
        </text>
        <rect x="192" y="66" width="80" height="16" rx="2" fill="#334155" stroke="#64748b" />
        {[70, 74, 78].map((y) => (
          <line key={y} x1="192" y1={y} x2="272" y2={y} stroke="#94a3b8" strokeOpacity="0.45" />
        ))}
        <line x1="274" y1="74" x2="286" y2="74" stroke="#f59e0b" markerEnd="url(#in3-layers-load)" />
        <path d="M 248 56 L 253 61 L 263 51" fill="none" stroke="#10b981" strokeWidth="2" />
        <text x="235" y="104" fontSize="10" fill="#10b981" textAnchor="middle">
          держит
        </text>

        <text x="12" y="146" fontSize="18" fontWeight="700" fill="#fcd34d">
          ×2–3
        </text>
        <text x="64" y="138" fontSize="10" fill="#cbd5e1">
          к жёсткости
        </text>
        <text x="64" y="152" fontSize="10" fill="#94a3b8">
          3 периметра · 0,8–1,2 мм
        </text>
        <text x="12" y="170" fontSize="10" fill="#94a3b8">
          рёбра вдоль нагрузки, а не поперёк
        </text>
      </svg>
    </VisualWrapper>
  );
}
