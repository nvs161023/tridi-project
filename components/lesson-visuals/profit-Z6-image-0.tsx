import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const LAYERS = [
  { number: "1", title: "зип-пакет", detail: "от влаги", color: "#06b6d4" },
  { number: "2", title: "плёнка", detail: "2 слоя", color: "#3b82f6" },
  { number: "3", title: "крафт", detail: "форма", color: "#f59e0b" },
  { number: "4", title: "наполнитель", detail: "по кругу", color: "#8b5cf6" },
  { number: "5", title: "коробка", detail: "по размеру", color: "#10b981" },
  { number: "6", title: "маркировка", detail: "«хрупкое»", color: "#f472b6" },
];

/**
 * Кадр блока 7 урока Z6 «Упаковка, логистика, отправка».
 *
 * Макет из описания `Z6_layers.png`: разрез коробки и шесть слоёв защиты.
 * Порядок слоёв из блока 7, свойства материалов — из блока 5, проверка
 * коробки — из блоков 8–10. Числа: плёнка в два слоя, зазор 2–3 см,
 * пустота больше 3 см опасна, дно и углы проклеивают скотчем в два слоя,
 * деталь тяжелее 2 кг требует двойной стенки.
 */
export function ProfitZ6Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Шесть слоёв защиты детали: зип-пакет от влаги, два слоя пузырчатой плёнки пузырьками наружу, крафт для формы, наполнитель по кругу с пустотой не больше трёх сантиметров, коробка по размеру с проклейкой дна и углов в два слоя, маркировка «хрупкое» и «верх». Зазор два-три сантиметра, деталь тяжелее двух килограммов требует двойной стенки"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          слои защиты
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          от детали к коробке
        </text>

        <rect x="16" y="34" width="124" height="100" rx="4" fill="#10b981" fillOpacity="0.08" stroke="#10b981" strokeOpacity="0.7" />
        <rect x="23" y="41" width="110" height="86" rx="3" fill="#8b5cf6" fillOpacity="0.1" stroke="#8b5cf6" strokeOpacity="0.7" />
        <rect x="30" y="48" width="96" height="72" rx="3" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeOpacity="0.7" />
        <rect x="37" y="55" width="82" height="58" rx="2" fill="#3b82f6" fillOpacity="0.13" stroke="#3b82f6" strokeOpacity="0.8" />
        <rect x="44" y="62" width="68" height="44" rx="2" fill="#06b6d4" fillOpacity="0.15" stroke="#06b6d4" strokeOpacity="0.85" />
        <rect x="57" y="72" width="42" height="24" rx="2" fill="#e2e8f0" fillOpacity="0.18" stroke="#cbd5e1" />
        <rect x="108" y="37" width="24" height="7" rx="1.5" fill="#f472b6" fillOpacity="0.8" />
        <text x="78" y="87" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          деталь
        </text>

        {LAYERS.map((layer, index) => {
          const y = 40 + index * 16;
          return (
            <g key={layer.title}>
              <circle cx="159" cy={y - 3.5} r="6.5" fill={layer.color} fillOpacity="0.16" stroke={layer.color} />
              <text x="159" y={y} fontSize="10" fontWeight="700" fill={layer.color} textAnchor="middle">
                {layer.number}
              </text>
              <text x="170" y={y} fontSize="10" fill="#cbd5e1">
                <tspan fontWeight="700" fill="#e2e8f0">
                  {layer.title}
                </tspan>
                <tspan> — {layer.detail}</tspan>
              </text>
            </g>
          );
        })}

        <rect x="12" y="136" width="296" height="36" rx="6" fill="#0f172a" stroke="#334155" />
        <circle cx="24" cy="149" r="6" fill="#10b981" fillOpacity="0.18" stroke="#34d399" />
        <path d="M21 149 L23 151 L27 146.5" fill="none" stroke="#6ee7b7" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="36" y="152" fontSize="10" fontWeight="700" fill="#e2e8f0">
          зазор 2–3 см · пустота ≤ 3 см
        </text>
        <text x="20" y="166" fontSize="10" fill="#cbd5e1">
          дно и углы — скотч ×2 · &gt;2 кг — двойная стенка
        </text>
      </svg>
    </VisualWrapper>
  );
}
