import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 14 урока IN2 «Нагрузки и прочность детали».
 *
 * Макет из описания кадра `IN2_anisotropy.png`: одна деталь и две прочности.
 * Вдоль слоёв — 100% паспорта, поперёк — 30–50%. Внизу перевод на числа блока 9:
 * у PLA 50 МПа вдоль и 15–25 МПа поперёк.
 */
export function EngineerIN2Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Прочность по осям: одна деталь, две прочности. Вдоль слоёв деталь держит 100 процентов паспорта, сила идёт по нитям. Поперёк слоёв остаётся 30–50 процентов, сила отрывает нити. Для PLA это 50 МПа вдоль и 15–25 МПа поперёк: слои режут прочность в 2–3 раза"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in2-aniso-green"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#10b981" />
          </marker>
          <marker
            id="in2-aniso-red"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#f87171" />
          </marker>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          печатная деталь: две прочности
        </text>

        <rect x="14" y="36" width="30" height="24" rx="2" fill="#334155" stroke="#475569" />
        <line x1="16" y1="43" x2="42" y2="43" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="16" y1="49" x2="42" y2="49" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="16" y1="55" x2="42" y2="55" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="48" y1="48" x2="64" y2="48" stroke="#10b981" markerEnd="url(#in2-aniso-green)" />

        <text x="70" y="43" fontSize="10" fontWeight="700" fill="#e2e8f0">
          вдоль слоёв
        </text>
        <text x="70" y="56" fontSize="10" fill="#94a3b8">
          сила по нитям
        </text>
        <rect x="70" y="62" width="180" height="9" rx="4" fill="#334155" />
        <rect x="70" y="62" width="180" height="9" rx="4" fill="#10b981" fillOpacity="0.85" />
        <text x="256" y="70" fontSize="10" fontWeight="700" fill="#10b981">
          100%
        </text>

        <rect x="14" y="90" width="30" height="24" rx="2" fill="#334155" stroke="#475569" />
        <line x1="16" y1="96" x2="42" y2="96" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="16" y1="108" x2="42" y2="108" stroke="#94a3b8" strokeOpacity="0.5" />
        <polyline
          points="16,102 22,99 28,105 34,101 42,103"
          fill="none"
          stroke="#f87171"
          strokeWidth="1.5"
        />
        <line x1="50" y1="102" x2="50" y2="92" stroke="#f87171" markerEnd="url(#in2-aniso-red)" />
        <line x1="50" y1="102" x2="50" y2="112" stroke="#f87171" markerEnd="url(#in2-aniso-red)" />

        <text x="70" y="97" fontSize="10" fontWeight="700" fill="#e2e8f0">
          поперёк слоёв
        </text>
        <text x="70" y="110" fontSize="10" fill="#94a3b8">
          сила отрывает нити
        </text>
        <rect x="70" y="116" width="180" height="9" rx="4" fill="#334155" />
        <rect x="70" y="116" width="90" height="9" rx="4" fill="#f87171" fillOpacity="0.85" />
        <text x="256" y="124" fontSize="10" fontWeight="700" fill="#f87171">
          30–50%
        </text>

        <rect
          x="12"
          y="134"
          width="296"
          height="36"
          rx="8"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />
        <text x="20" y="149" fontSize="10" fill="#fcd34d">
          PLA: 50 МПа вдоль → 15–25 МПа поперёк
        </text>
        <text x="20" y="164" fontSize="10" fill="#94a3b8">
          поперёк слоёв деталь держит в 2–3 раза хуже
        </text>
      </svg>
    </VisualWrapper>
  );
}
