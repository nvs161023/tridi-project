import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const CARDS = [
  { title: "бюджет", value: "3–5 тыс. ₽", detail: "в месяц", color: "#3b82f6" },
  { title: "отдача", value: "1 ₽ → 2 ₽", detail: "работает", color: "#f59e0b" },
  { title: "меньше", value: "<1 ₽", detail: "менять", color: "#f87171" },
];

/**
 * Кадр блока 29 урока Z5 «Фото, маркетинг, продвижение».
 *
 * Макет из описания `Z5_ad_money.png`: реклама начинается после порога, а не
 * вместо него. Числа из блока 29: порог — 5–10 продаж без рекламы, бюджет —
 * 3–5 тысяч рублей в месяц, отдача — рубль к двум. Если на рубль приходит
 * меньше рубля, объявление меняют. Проверка — раз в неделю, две недели на
 * запуск и 2–3 недели до праздника.
 */
export function ProfitZ5Image6({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Деньги в рекламу: сначала порог 5–10 продаж без рекламы. Бюджет 3–5 тысяч рублей в месяц. Отдача 1 рубль к 2 рублям — работает, меньше 1 рубля — менять. Два объявления, проверка раз в неделю, 2–3 недели до праздника"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          деньги в рекламу
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          сначала порог, потом бюджет
        </text>

        <rect x="12" y="38" width="296" height="28" rx="6" fill="#10b981" fillOpacity="0.08" stroke="#34d399" strokeOpacity="0.5" />
        <circle cx="28" cy="52" r="7" fill="#10b981" fillOpacity="0.18" stroke="#34d399" />
        <path d="M24.5 52 L27 54.5 L31.5 49.5" fill="none" stroke="#6ee7b7" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="40" y="52" fontSize="11" fontWeight="700" fill="#e2e8f0">
          5–10 продаж без рекламы
        </text>
        <text x="300" y="52" fontSize="10" fill="#34d399" textAnchor="end">
          порог
        </text>

        {CARDS.map((card, index) => {
          const x = 12 + index * 102;
          return (
            <g key={card.title}>
              <rect x={x} y="76" width="92" height="62" rx="6" fill="#0f172a" stroke="#334155" />
              <rect x={x} y="76" width="92" height="3" rx="1.5" fill={card.color} />
              <text x={x + 46} y="89" fontSize="10" fill="#94a3b8" textAnchor="middle">
                {card.title}
              </text>
              <text x={x + 46} y="111" fontSize="14" fontWeight="700" fill={card.color} textAnchor="middle">
                {card.value}
              </text>
              <text x={x + 46} y="126" fontSize="10" fill="#cbd5e1" textAnchor="middle">
                {card.detail}
              </text>
            </g>
          );
        })}

        <text x="160" y="152" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          2 объявления · проверка раз в неделю
        </text>
        <text x="160" y="168" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          2–3 недели до праздника
        </text>
      </svg>
    </VisualWrapper>
  );
}
