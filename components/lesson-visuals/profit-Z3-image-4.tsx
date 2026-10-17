import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const CIRCLES = [1, 2, 3];

/**
 * Кадр блока 24 урока Z3 «Клиенты: бриф, ТЗ, споры».
 *
 * Макет из описания `Z3_revision_limit.png`: три бесплатных круга правок,
 * дальше — платные часы. Числа из блока 22: три правки входят в заказ,
 * дальше час работы 400 ₽; правка — кольцо на 0,5 мм, отверстие, скругление;
 * новый заказ — вторая деталь, рост габаритов больше 20 %, другой материал.
 * Норма в тексте — две-три правки, поэтому подпись говорит «норма 2–3».
 */
export function ProfitZ3Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три бесплатные правки, дальше платные часы по 400 рублей. Правка — это кольцо на полмиллиметра, отверстие или скругление. Новый заказ — вторая деталь, рост габаритов больше 20 процентов или другой материал"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          три круга правок
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          3 бесплатные правки · норма 2–3
        </text>

        {CIRCLES.map((n) => {
          const cx = 52 + (n - 1) * 52;
          return (
            <g key={n}>
              <circle cx={cx} cy="62" r="18" fill="#10b981" fillOpacity="0.12" stroke="#10b981" strokeWidth="1.2" />
              <text x={cx} y="68" fontSize="18" fontWeight="700" fill="#34d399" textAnchor="middle">
                {n}
              </text>
            </g>
          );
        })}
        <text x="104" y="94" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          бесплатно
        </text>

        <path d="M176 62 H186" stroke="#64748b" strokeWidth="1.2" />
        <path d="M190 62 L185 58.5 V65.5 Z" fill="#64748b" />

        <rect x="190" y="40" width="118" height="50" rx="6" fill="#f59e0b" fillOpacity="0.08" stroke="#f59e0b" strokeOpacity="0.35" />
        <text x="249" y="52" fontSize="10" fill="#94a3b8" textAnchor="middle">
          дальше
        </text>
        <text x="249" y="70" fontSize="13" fontWeight="700" fill="#fcd34d" textAnchor="middle">
          400 ₽ / час
        </text>
        <text x="249" y="86" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          платные правки
        </text>

        <rect x="12" y="104" width="142" height="64" rx="6" fill="#0f172a" fillOpacity="0.7" stroke="#334155" />
        <rect x="12" y="104" width="142" height="3" rx="1.5" fill="#10b981" />
        <text x="20" y="121" fontSize="10" fontWeight="700" fill="#34d399">
          правка
        </text>
        <text x="20" y="135" fontSize="10" fill="#e2e8f0">
          кольцо +0,5 мм
        </text>
        <text x="20" y="149" fontSize="10" fill="#e2e8f0">
          отверстие, скругление
        </text>
        <text x="20" y="163" fontSize="10" fill="#94a3b8">
          входит в заказ
        </text>

        <rect x="166" y="104" width="142" height="64" rx="6" fill="#0f172a" fillOpacity="0.7" stroke="#334155" />
        <rect x="166" y="104" width="142" height="3" rx="1.5" fill="#f59e0b" />
        <text x="174" y="121" fontSize="10" fontWeight="700" fill="#fcd34d">
          новый заказ
        </text>
        <text x="174" y="135" fontSize="10" fill="#e2e8f0">
          вторая деталь
        </text>
        <text x="174" y="149" fontSize="10" fill="#e2e8f0">
          габариты +20 %
        </text>
        <text x="174" y="163" fontSize="10" fill="#e2e8f0">
          другой материал
        </text>
      </svg>
    </VisualWrapper>
  );
}
