import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 14 урока IN3 «Рёбра жёсткости и усиление деталей».
 *
 * Макет из описания кадра `IN3_load_path.png`: L-кронштейн, груз на конце и
 * диагональ от груза к опоре. Ребро лежит вдоль этой диагонали; вертикальное
 * ребро поперёк пути показано как бесполезное.
 */
export function EngineerIN3Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Путь нагрузки. L-кронштейн: груз на конце полки, опора у стены. Пунктирная диагональ идёт от груза к опоре, синее ребро лежит вдоль неё. Внизу справа вертикальное ребро поперёк пути перечёркнуто — оно почти не работает"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in3-path-load"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#f59e0b" />
          </marker>
          <pattern id="in3-path-fixed" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#64748b" strokeWidth="1.5" />
          </pattern>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          ребро идёт вдоль пути силы
        </text>

        {/* Стена и полка кронштейна. */}
        <rect x="24" y="34" width="12" height="100" rx="1" fill="#334155" stroke="#64748b" />
        <rect x="18" y="34" width="6" height="100" fill="url(#in3-path-fixed)" stroke="#64748b" />
        <rect x="36" y="102" width="220" height="10" rx="2" fill="#334155" stroke="#64748b" />

        {/* Ребро-косынка вдоль диагонали. */}
        <polygon
          points="43,48 240,103 243,94 46,39"
          fill="#3b82f6"
          fillOpacity="0.35"
          stroke="#60a5fa"
          strokeWidth="1"
        />
        <line x1="44" y1="44" x2="242" y2="99" stroke="#60a5fa" strokeWidth="1.5" />

        {/* Путь силы от груза к опоре. */}
        <line
          x1="242"
          y1="102"
          x2="42"
          y2="54"
          stroke="#f59e0b"
          strokeWidth="1.6"
          strokeDasharray="5 3"
        />
        <circle cx="42" cy="54" r="3" fill="#f59e0b" />
        <circle cx="242" cy="102" r="3" fill="#f59e0b" />

        <line x1="242" y1="82" x2="242" y2="101" stroke="#f59e0b" markerEnd="url(#in3-path-load)" />
        <text x="248" y="88" fontSize="10" fill="#fcd34d">
          груз
        </text>

        <text x="95" y="60" fontSize="10" fontWeight="700" fill="#fcd34d" stroke="#0f172a" strokeWidth="3" paintOrder="stroke">
          путь силы
        </text>
        <text x="168" y="76" fontSize="10" fontWeight="700" fill="#93c5fd" stroke="#0f172a" strokeWidth="3" paintOrder="stroke">
          ребро
        </text>

        <text x="12" y="142" fontSize="10" fill="#cbd5e1">
          ребро работает на сжатие и растяжение
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          вдоль диагонали, а не поперёк
        </text>

        {/* Контрпример: ребро поперёк пути. */}
        <rect x="214" y="114" width="94" height="58" rx="7" fill="#0f172a" fillOpacity="0.5" stroke="#334155" />
        <rect x="224" y="134" width="74" height="6" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="250" y="118" width="6" height="22" rx="1" fill="#f87171" fillOpacity="0.45" stroke="#f87171" />
        <path d="M 244 124 L 262 140 M 262 124 L 244 140" stroke="#f87171" strokeWidth="1.5" />
        <text x="218" y="154" fontSize="10" fill="#f87171">
          поперёк пути
        </text>
        <text x="218" y="168" fontSize="10" fill="#94a3b8">
          почти бесполезно
        </text>
      </svg>
    </VisualWrapper>
  );
}
