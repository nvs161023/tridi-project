import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const LAYERS = [
  {
    number: "1",
    title: "свет",
    detail: "окно сбоку",
    value: "5 минут",
    color: "#3b82f6",
    x: 10,
  },
  {
    number: "2",
    title: "фон",
    detail: "60–70 % кадра",
    value: "лист А2 · ткань",
    color: "#f59e0b",
    x: 112,
  },
  {
    number: "3",
    title: "ракурс",
    detail: "5 ракурсов",
    value: "сверху · крупно",
    color: "#10b981",
    x: 214,
  },
];

/**
 * Кадр блока 5 урока Z5 «Фото, маркетинг, продвижение».
 *
 * Макет из описания `Z5_photo_layers.png`: три слоя хорошего кадра. Числа из
 * блоков 5–8: на свет уходит около пяти минут, деталь занимает 60–70 % кадра,
 * обязательных ракурсов пять. Подвал повторяет порядок съёмки: сначала свет,
 * потом фон, потом ракурс.
 */
export function ProfitZ5Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три слоя хорошего кадра: свет из окна сбоку за пять минут, фон из листа А2 или серой ткани, деталь занимает 60–70 процентов кадра, и пять обязательных ракурсов. Снимать по порядку: сначала свет, потом фон, потом ракурс"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          три слоя одного кадра
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          один телефон · одно окно · без студии
        </text>

        {LAYERS.map((layer) => (
          <g key={layer.title}>
            <rect x={layer.x} y="38" width="96" height="94" rx="7" fill="#0f172a" stroke="#334155" />
            <rect x={layer.x} y="38" width="96" height="3" rx="1.5" fill={layer.color} />
            <circle cx={layer.x + 13} cy="53" r="7" fill={layer.color} fillOpacity="0.16" stroke={layer.color} />
            <text x={layer.x + 13} y="56.5" fontSize="10" fontWeight="700" fill={layer.color} textAnchor="middle">
              {layer.number}
            </text>
            <text x={layer.x + 25} y="56.5" fontSize="11" fontWeight="700" fill="#e2e8f0">
              {layer.title}
            </text>

            {layer.number === "1" ? (
              <g>
                <rect x={layer.x + 14} y="68" width="28" height="28" rx="2" fill="#3b82f6" fillOpacity="0.08" stroke="#60a5fa" />
                <path d={`M${layer.x + 28} 68 V96`} stroke="#60a5fa" strokeWidth="0.8" />
                <path d={`M${layer.x + 14} 82 H${layer.x + 42}`} stroke="#60a5fa" strokeWidth="0.8" />
                <path d={`M${layer.x + 47} 73 L${layer.x + 57} 69`} stroke="#fbbf24" strokeWidth="1" />
                <path d={`M${layer.x + 47} 81 L${layer.x + 59} 79`} stroke="#fbbf24" strokeWidth="1" />
                <path d={`M${layer.x + 47} 89 L${layer.x + 57} 89`} stroke="#fbbf24" strokeWidth="1" />
                <rect x={layer.x + 62} y="76" width="12" height="20" rx="1.5" fill="#1e293b" stroke="#94a3b8" />
              </g>
            ) : null}

            {layer.number === "2" ? (
              <g>
                <rect x={layer.x + 18} y="69" width="44" height="26" rx="2" fill="#f59e0b" fillOpacity="0.08" stroke="#fbbf24" />
                <rect x={layer.x + 35} y="79" width="10" height="12" rx="1.5" fill="#f59e0b" fillOpacity="0.35" stroke="#fbbf24" />
                <path d={`M${layer.x + 62} 95 V70`} stroke="#64748b" strokeWidth="1" />
                <path d={`M${layer.x + 58} 70 H${layer.x + 66}`} stroke="#64748b" strokeWidth="1" />
              </g>
            ) : null}

            {layer.number === "3" ? (
              <g>
                {[0, 1, 2, 3, 4].map((item) => (
                  <rect
                    key={item}
                    x={layer.x + 15 + item * 14}
                    y={79 - Math.abs(2 - item) * 2}
                    width="8"
                    height="12"
                    rx="1.5"
                    fill="#10b981"
                    fillOpacity="0.18"
                    stroke="#34d399"
                    transform={`rotate(${item * 9 - 18} ${layer.x + 19 + item * 14} ${85 - Math.abs(2 - item) * 2})`}
                  />
                ))}
                <path d={`M${layer.x + 15} 98 H${layer.x + 81}`} stroke="#334155" strokeWidth="0.8" />
              </g>
            ) : null}

            <text x={layer.x + 48} y="114" fontSize="10" fill="#cbd5e1" textAnchor="middle">
              {layer.detail}
            </text>
            <text x={layer.x + 48} y="128" fontSize="10" fontWeight="700" fill={layer.color} textAnchor="middle">
              {layer.value}
            </text>
          </g>
        ))}

        <rect x="12" y="142" width="296" height="24" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="160" y="158" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          сначала свет → потом фон → потом ракурс
        </text>
      </svg>
    </VisualWrapper>
  );
}
