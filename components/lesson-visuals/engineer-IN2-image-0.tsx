import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

type PanelProps = {
  x: number;
  y: number;
  title: string;
  color: string;
  note: string;
};

/** Рамка одной из четырёх схем: заголовок сверху, подпись снизу. */
function Panel({ x, y, title, color, note }: PanelProps) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="146"
        height="68"
        rx="8"
        fill="#0f172a"
        fillOpacity="0.35"
        stroke="#334155"
      />
      <text x={x + 73} y={y + 13} fontSize="10" fontWeight="700" fill={color} textAnchor="middle">
        {title}
      </text>
      <text x={x + 73} y={y + 62} fontSize="10" fill="#94a3b8" textAnchor="middle">
        {note}
      </text>
    </g>
  );
}

/**
 * Кадр блока 4 урока IN2 «Нагрузки и прочность детали».
 *
 * Макет из описания кадра `IN2_load_types.png`: четыре схемы нагрузки и слой
 * печати в каждой. Подписи — из блоков 3 и 18: сжатие держат слои поперёк
 * нагрузки, растяжение и изгиб — вдоль, кручение — под 45° к оси.
 */
export function EngineerIN2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Четыре нагрузки и направление слоёв. Сжатие: сила давит на деталь, слои поперёк силы. Растяжение: сила тянет деталь, слои вдоль силы. Изгиб: сила гнёт консоль, слои вдоль длины. Кручение: сила закручивает вал, слои под 45 градусов к оси. Внизу: сдвиг прячется внутри — шпонка, клей, слои"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in2-load-blue"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#60a5fa" />
          </marker>
          <marker
            id="in2-load-green"
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
            id="in2-load-amber"
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
            id="in2-load-purple"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#a78bfa" />
          </marker>
          <clipPath id="in2-load-shaft">
            <rect x="198" y="126" width="74" height="16" rx="8" />
          </clipPath>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          одна деталь — четыре схемы
        </text>

        <Panel x={12} y={22} title="сжатие" color="#60a5fa" note="слои поперёк силы" />
        <Panel x={162} y={22} title="растяжение" color="#10b981" note="слои вдоль силы" />
        <Panel x={12} y={96} title="изгиб" color="#f59e0b" note="слои вдоль длины" />
        <Panel x={162} y={96} title="кручение" color="#a78bfa" note="слои под 45° к оси" />

        {/* Сжатие: площадка под стрелками, слои горизонтальные. */}
        <rect x="57" y="46" width="56" height="22" rx="2" fill="#334155" stroke="#64748b" />
        <line x1="59" y1="53" x2="111" y2="53" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="59" y1="61" x2="111" y2="61" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="71" y1="39" x2="71" y2="46" stroke="#60a5fa" markerEnd="url(#in2-load-blue)" />
        <line x1="99" y1="39" x2="99" y2="46" stroke="#60a5fa" markerEnd="url(#in2-load-blue)" />
        <line x1="71" y1="75" x2="71" y2="68" stroke="#60a5fa" markerEnd="url(#in2-load-blue)" />
        <line x1="99" y1="75" x2="99" y2="68" stroke="#60a5fa" markerEnd="url(#in2-load-blue)" />

        {/* Растяжение: планка, стрелки наружу. */}
        <rect x="198" y="55" width="74" height="14" rx="2" fill="#334155" stroke="#64748b" />
        <line x1="200" y1="60" x2="270" y2="60" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="200" y1="64" x2="270" y2="64" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="194" y1="62" x2="184" y2="62" stroke="#10b981" markerEnd="url(#in2-load-green)" />
        <line x1="276" y1="62" x2="286" y2="62" stroke="#10b981" markerEnd="url(#in2-load-green)" />

        {/* Изгиб: консоль у стены, груз на конце. */}
        <rect x="18" y="118" width="6" height="28" fill="#475569" />
        <rect x="24" y="124" width="96" height="12" rx="2" fill="#334155" stroke="#64748b" />
        <line x1="26" y1="128" x2="118" y2="128" stroke="#94a3b8" strokeOpacity="0.5" />
        <line x1="26" y1="132" x2="118" y2="132" stroke="#94a3b8" strokeOpacity="0.5" />
        <path d="M 26 130 Q 76 130 118 142" fill="none" stroke="#f59e0b" strokeDasharray="3 2" />
        <line x1="114" y1="112" x2="114" y2="123" stroke="#f59e0b" markerEnd="url(#in2-load-amber)" />

        {/* Кручение: вал, слои под 45°, стрелка вращения на торце. */}
        <rect x="198" y="126" width="74" height="16" rx="8" fill="#334155" stroke="#64748b" />
        <g clipPath="url(#in2-load-shaft)">
          {[196, 205, 214, 223, 232, 241, 250, 259, 268, 277].map((x) => (
            <line key={x} x1={x} y1="142" x2={x + 16} y2="126" stroke="#a78bfa" strokeOpacity="0.55" />
          ))}
        </g>
        <path
          d="M 280 122 A 6 12 0 1 1 280 146"
          fill="none"
          stroke="#a78bfa"
          markerEnd="url(#in2-load-purple)"
        />

        <text x="12" y="172" fontSize="10" fill="#fcd34d">
          сдвиг прячется внутри: шпонка, клей, слои
        </text>
      </svg>
    </VisualWrapper>
  );
}
