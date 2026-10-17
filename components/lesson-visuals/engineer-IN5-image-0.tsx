import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 4 урока IN5 «Кейсы: кронштейн, шестерня, вал, корпус».
 *
 * Макет из описания `IN5_bracket.png`: плечо 100 мм, сила 50 Н на конце,
 * момент 5 Н·м, ребро у основания и галтель R2. Справа — параметры печати
 * из блока 5; красная трещина у крепёжного уха — типичная поломка из блока 6.
 */
export function EngineerIN5Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Кронштейн на стене. Вылет 100 миллиметров, на конце сила 50 ньютонов от груза 5 килограммов, момент 5 ньютон-метров. В углу ребро 1 миллиметр и галтель R2. Справа параметры печати: PETG или PA-CF, 4 периметра по 0,45 миллиметра, 40 процентов гироид, болт с плюсом 0,2 миллиметра. У крепёжного уха красная трещина по слою"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in5-0-arrow"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#f59e0b" />
          </marker>
          <marker
            id="in5-0-moment"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#38bdf8" />
          </marker>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          кронштейн: вылет и плечо
        </text>

        {/* Стойка и полка */}
        <rect x="12" y="23" width="188" height="119" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <line x1="48" y1="44" x2="48" y2="126" stroke="#94a3b8" />
        {Array.from({ length: 10 }, (_, i) => (
          <line
            key={`in5-0-wall-${i}`}
            x1="48"
            y1={45 + i * 9}
            x2="40"
            y2={39 + i * 9}
            stroke="#94a3b8"
            strokeWidth="0.8"
            strokeOpacity="0.7"
          />
        ))}
        <polygon points="48,44 62,44 62,126 48,126" fill="#334155" stroke="#64748b" />
        <polygon points="62,106 158,106 158,120 62,120" fill="#334155" stroke="#64748b" />
        <polygon points="62,120 102,120 62,86" fill="#475569" fillOpacity="0.8" stroke="#94a3b8" strokeWidth="0.8" />
        <path d="M98 120 Q102 111 108 106" fill="none" stroke="#fbbf24" strokeWidth="1.2" />

        {/* Слои вдоль вылета */}
        <line x1="64" y1="110" x2="156" y2="110" stroke="#fbbf24" strokeWidth="0.7" strokeOpacity="0.55" />
        <line x1="64" y1="115" x2="156" y2="115" stroke="#fbbf24" strokeWidth="0.7" strokeOpacity="0.55" />

        {/* Крепёж и трещина по слою */}
        <circle cx="55" cy="58" r="3" fill="#0f172a" stroke="#cbd5e1" />
        <circle cx="55" cy="58" r="1.1" fill="#94a3b8" />
        <path d="M53 44 l4 5 -5 4 4 5" fill="none" stroke="#ef4444" strokeWidth="1.3" />
        <text x="70" y="53" fontSize="10" fill="#f87171">
          трещина по слою
        </text>
        <line x1="68" y1="57" x2="59" y2="61" stroke="#f87171" strokeWidth="0.8" />

        {/* Вылет */}
        <line x1="62" y1="98" x2="158" y2="98" stroke="#64748b" strokeWidth="0.8" />
        <line x1="62" y1="94" x2="62" y2="102" stroke="#64748b" strokeWidth="0.8" />
        <line x1="158" y1="94" x2="158" y2="102" stroke="#64748b" strokeWidth="0.8" />
        <text x="110" y="92" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          100 мм
        </text>

        {/* Нагрузка */}
        <line x1="152" y1="76" x2="152" y2="102" stroke="#f59e0b" strokeWidth="1.5" markerEnd="url(#in5-0-arrow)" />
        <text x="158" y="73" fontSize="10" fontWeight="700" fill="#fbbf24">
          50 Н
        </text>
        <text x="116" y="70" fontSize="10" fill="#94a3b8">
          5 кг
        </text>

        {/* Момент */}
        <path d="M88 128 A22 22 0 0 1 126 128" fill="none" stroke="#38bdf8" strokeWidth="1.2" markerEnd="url(#in5-0-moment)" />
        <text x="82" y="138" fontSize="10" fontWeight="700" fill="#7dd3fc">
          5 Н·м
        </text>

        {/* Параметры печати */}
        <rect x="208" y="23" width="100" height="119" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="218" y="38" fontSize="10" fontWeight="700" fill="#cbd5e1">
          печать
        </text>
        <text x="218" y="56" fontSize="10" fill="#6ee7b7">
          PETG / PA-CF
        </text>
        <text x="218" y="73" fontSize="10" fill="#cbd5e1">
          4 перим. × 0,45
        </text>
        <text x="218" y="90" fontSize="10" fill="#cbd5e1">
          40 % гироид
        </text>
        <text x="218" y="107" fontSize="10" fill="#cbd5e1">
          ребро 1 мм · R2
        </text>
        <text x="218" y="124" fontSize="10" fill="#cbd5e1">
          болт +0,2 мм
        </text>

        <text x="12" y="162" fontSize="10" fill="#94a3b8">
          слои вдоль вылета · ухо усиливают втулкой
        </text>
      </svg>
    </VisualWrapper>
  );
}
