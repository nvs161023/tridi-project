import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const CARRIERS = [
  { name: "Почта", term: "3–10 дней", note: "до 2 кг", extra: "дешевле всех", color: "#3b82f6" },
  { name: "СДЭК", term: "2–5 дней", note: "до 2 кг", extra: "пункты рядом", color: "#06b6d4" },
  { name: "Boxberry", term: "3–7 дней", note: "до 2 кг", extra: "пункты ПВЗ", color: "#f59e0b" },
  { name: "Ozon / WB", term: "склад", note: "логистика", extra: "в комиссии", color: "#8b5cf6" },
];

/**
 * Кадр блока 17 урока Z6 «Упаковка, логистика, отправка».
 *
 * Макет из описания `Z6_carrier_choice.png`: сравнение четырёх способов
 * отправки по сроку, весу и цене. Почта 3–10 дней, СДЭК 2–5, Boxberry
 * 3–7, у маркетплейса логистика в комиссии. Курьер 300–500 ₽, формула
 * объёмного веса делит на 5000, 300 г могут стать 3,5 кг, разница
 * в цене — до 1,5 раза.
 */
export function ProfitZ6Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сравнение перевозчиков: Почта 3–10 дней, СДЭК 2–5 дней, Boxberry 3–7 дней, у маркетплейса логистика входит в комиссию. До двух килограммов тарифы похожи, курьер стоит 300–500 рублей. Платный вес считают как максимум из фактического и объёма, делённого на 5000: 300 граммов могут стать 3,5 килограмма. Разница в цене до 1,5 раза, тарифы меняются"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          выбор перевозчика
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          по весу, сроку и цене
        </text>

        {CARRIERS.map((carrier, index) => {
          const x = 12 + index * 74;
          const center = x + 36;
          return (
            <g key={carrier.name}>
              <rect x={x} y="34" width="72" height="66" rx="5" fill="#0f172a" stroke="#334155" />
              <rect x={x} y="34" width="72" height="3" rx="1.5" fill={carrier.color} />
              <text x={center} y="49" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
                {carrier.name}
              </text>
              <text x={center} y="65" fontSize="11" fontWeight="700" fill={carrier.color} textAnchor="middle">
                {carrier.term}
              </text>
              <text x={center} y="79" fontSize="10" fill="#cbd5e1" textAnchor="middle">
                {carrier.note}
              </text>
              <text x={center} y="92" fontSize="10" fill="#94a3b8" textAnchor="middle">
                {carrier.extra}
              </text>
            </g>
          );
        })}

        <rect x="12" y="106" width="296" height="34" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="20" y="117" fontSize="10" fontWeight="700" fill="#e2e8f0">
          платный вес = max(факт; Д×Ш×В / 5000)
        </text>
        <text x="20" y="131" fontSize="10" fill="#cbd5e1">
          300 г → платишь как за 3,5 кг
        </text>

        <text x="160" y="152" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          курьер 300–500 ₽ · сравни 2–3 компании
        </text>
        <text x="160" y="166" fontSize="10" fill="#94a3b8" textAnchor="middle">
          разница до 1,5× · тарифы меняются
        </text>
      </svg>
    </VisualWrapper>
  );
}
