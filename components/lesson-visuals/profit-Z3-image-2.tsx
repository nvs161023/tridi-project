import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 13 урока Z3 «Клиенты: бриф, ТЗ, споры».
 *
 * Макет из описания `Z3_spec_message.png`: ТЗ одним сообщением в переписке.
 * Числа — блоки 11 и 20: цена 750 ₽, срок три дня, две бесплатные правки,
 * предоплата 50 %. Габариты и материал — из примера брифа (блок 6).
 */
export function ProfitZ3Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Техническое задание в переписке: подставка 180 на 120 на 25, PETG, чёрный. Цена 750 рублей, срок три дня, две бесплатные правки, предоплата 50 процентов. Клиент отвечает согласен, после этого начинается печать"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          ТЗ в переписке
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          цена, срок и правки — одним сообщением
        </text>

        <rect x="12" y="36" width="296" height="134" rx="8" fill="#0f172a" fillOpacity="0.65" stroke="#334155" />
        <circle cx="22" cy="46" r="2.5" fill="#10b981" />
        <text x="30" y="49" fontSize="10" fill="#cbd5e1">
          чат · заказ подставки
        </text>

        <rect x="20" y="54" width="94" height="24" rx="7" fill="#1e293b" stroke="#334155" />
        <text x="28" y="69" fontSize="10" fill="#e2e8f0">
          Сколько стоит?
        </text>

        <rect x="114" y="80" width="194" height="64" rx="8" fill="#1d4ed8" fillOpacity="0.2" stroke="#3b82f6" strokeOpacity="0.55" />
        <rect x="122" y="86" width="24" height="12" rx="3" fill="#f59e0b" fillOpacity="0.18" stroke="#f59e0b" strokeOpacity="0.5" />
        <text x="134" y="95" fontSize="10" fill="#fcd34d" textAnchor="middle">
          ТЗ
        </text>
        <text x="152" y="96" fontSize="10" fill="#cbd5e1">
          подставка
        </text>
        <text x="122" y="112" fontSize="10" fill="#e2e8f0">
          180×120×25 · PETG · чёрный
        </text>
        <text x="122" y="126" fontSize="10" fill="#e2e8f0">
          750 ₽ · срок 3 дня · 2 правки
        </text>
        <text x="122" y="140" fontSize="10" fill="#fcd34d">
          предоплата 50 %
        </text>

        <rect x="20" y="96" width="86" height="24" rx="7" fill="#1e293b" stroke="#334155" />
        <text x="28" y="111" fontSize="10" fill="#e2e8f0">
          Согласен
        </text>
        <path d="M90 112 L95 117 L103 107" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        <text x="160" y="160" fontSize="10" fill="#94a3b8" textAnchor="middle">
          после согласия — печать
        </text>
      </svg>
    </VisualWrapper>
  );
}
