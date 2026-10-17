import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

type SchemeProps = {
  x: number;
  title: string;
  color: string;
  example: string;
  layer: string;
  layerNote: string;
};

/** Рамка схемы: заголовок, пример снизу и две строки про слои. */
function Scheme({ x, title, color, example, layer, layerNote }: SchemeProps) {
  return (
    <g>
      <rect
        x={x}
        y="24"
        width="96"
        height="118"
        rx="8"
        fill="#0f172a"
        fillOpacity="0.35"
        stroke="#334155"
      />
      <text x={x + 48} y="38" fontSize="10" fontWeight="700" fill={color} textAnchor="middle">
        {title}
      </text>
      <text x={x + 48} y="98" fontSize="10" fill="#e2e8f0" textAnchor="middle">
        {layer}
      </text>
      <text x={x + 48} y="111" fontSize="10" fill="#94a3b8" textAnchor="middle">
        {layerNote}
      </text>
      <text x={x + 48} y="128" fontSize="10" fill="#64748b" textAnchor="middle">
        {example}
      </text>
    </g>
  );
}

/**
 * Кадр блока 17 урока IN2 «Нагрузки и прочность детали».
 *
 * Макет из описания кадра `IN2_orientation.png`: три схемы ориентации из блока
 * 18 — слои вдоль силы, вдоль длины при изгибе и под 45° к оси вала.
 */
export function EngineerIN2Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три схемы ориентации слоёв. Растяжение: слои вдоль силы, так работают крючок и хомут. Изгиб: слои вдоль длины, так работают полка и рычаг. Кручение: слои под 45 градусов к оси вала, так работают вал и ручка. Внизу: поворот детали на 90 градусов даёт выигрыш в 2–3 раза без лишнего пластика"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in2-orient-green"
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
            id="in2-orient-amber"
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
            id="in2-orient-purple"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#a78bfa" />
          </marker>
          <clipPath id="in2-orient-shaft">
            <rect x="228" y="68" width="64" height="16" rx="8" />
          </clipPath>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          три схемы для трёх нагрузок
        </text>

        <Scheme x={12} title="растяжение" color="#10b981" example="крючок, хомут" layer="слои вдоль" layerNote="силы" />
        <Scheme x={112} title="изгиб" color="#f59e0b" example="полка, рычаг" layer="слои вдоль" layerNote="длины" />
        <Scheme x={212} title="кручение" color="#a78bfa" example="вал, ручка" layer="слои под 45°" layerNote="к оси вала" />

        {/* Растяжение: слои и сила вдоль планки. */}
        <rect x="28" y="64" width="64" height="14" rx="2" fill="#334155" stroke="#64748b" />
        <line x1="30" y1="69" x2="90" y2="69" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="30" y1="73" x2="90" y2="73" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="24" y1="71" x2="16" y2="71" stroke="#10b981" markerEnd="url(#in2-orient-green)" />
        <line x1="96" y1="71" x2="104" y2="71" stroke="#10b981" markerEnd="url(#in2-orient-green)" />

        {/* Изгиб: консоль, слои идут вдоль длины. */}
        <g transform="translate(100 0)">
          <rect x="20" y="56" width="6" height="42" fill="#475569" />
          <rect x="26" y="68" width="66" height="12" rx="2" fill="#334155" stroke="#64748b" />
          <line x1="28" y1="72" x2="90" y2="72" stroke="#94a3b8" strokeOpacity="0.5" />
          <line x1="28" y1="76" x2="90" y2="76" stroke="#94a3b8" strokeOpacity="0.5" />
          <path d="M 28 74 Q 60 74 92 86" fill="none" stroke="#f59e0b" strokeDasharray="3 2" />
          <line x1="88" y1="48" x2="88" y2="66" stroke="#f59e0b" markerEnd="url(#in2-orient-amber)" />
        </g>

        {/* Кручение: слои под 45°, стрелка вращения на торце вала. */}
        <rect x="228" y="68" width="64" height="16" rx="8" fill="#334155" stroke="#64748b" />
        <g clipPath="url(#in2-orient-shaft)">
          {[226, 234, 242, 250, 258, 266, 274, 282, 290].map((x) => (
            <line key={x} x1={x} y1="84" x2={x + 16} y2="68" stroke="#a78bfa" strokeOpacity="0.55" />
          ))}
        </g>
        <path
          d="M 288 64 A 6 12 0 1 1 288 88"
          fill="none"
          stroke="#a78bfa"
          markerEnd="url(#in2-orient-purple)"
        />

        <text x="160" y="159" fontSize="10" fill="#fcd34d" textAnchor="middle">
          поворот детали на 90° даёт выигрыш
        </text>
        <text x="160" y="173" fontSize="10" fill="#94a3b8" textAnchor="middle">
          в 2–3 раза без лишнего пластика
        </text>
      </svg>
    </VisualWrapper>
  );
}
