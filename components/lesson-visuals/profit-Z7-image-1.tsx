import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 12 урока Z7 «Юр. оформление, налоги, лицензии».
 *
 * Макет из описания `Z7_usn_choice.png`: две схемы УСН. 6 % считаются со всего
 * дохода и выгодны, когда расходов мало; 15 % — с разницы дохода и расходов,
 * выгодны при больших закупках, а расходы нужно подтверждать документами.
 * Лимит УСН — 300 млн ₽/год, взносы ИП уменьшают налог, декларация раз в год.
 */
export function ProfitZ7Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Две схемы УСН для ИП. Шесть процентов с дохода: налог равен шести процентам от всей выручки, расходов мало, себестоимость не вычитается. Пятнадцать процентов с разницы: налог равен пятнадцати процентам от дохода минус расходы, выгодно при больших закупках, расходы подтверждаются документами. Лимит УСН 300 миллионов рублей в год, взносы ИП уменьшают налог, декларация раз в год и КУДиР постоянно"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          УСН: 6 % или 15 %
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          с дохода или с разницы
        </text>

        <rect x="10" y="36" width="145" height="104" rx="6" fill="#0f172a" stroke="#06b6d4" strokeOpacity="0.6" />
        <rect x="10" y="36" width="145" height="3" rx="1.5" fill="#06b6d4" />
        <text x="20" y="59" fontSize="18" fontWeight="700" fill="#22d3ee">
          6 %
        </text>
        <text x="20" y="78" fontSize="10" fontWeight="700" fill="#e2e8f0">
          с дохода
        </text>
        <text x="20" y="94" fontSize="10" fill="#cbd5e1">
          налог = 6 % × доход
        </text>
        <text x="20" y="111" fontSize="10" fill="#94a3b8">
          расходы малы
        </text>
        <text x="20" y="126" fontSize="10" fill="#94a3b8">
          себестоимость не в счёт
        </text>

        <rect x="165" y="36" width="145" height="104" rx="6" fill="#0f172a" stroke="#f59e0b" strokeOpacity="0.6" />
        <rect x="165" y="36" width="145" height="3" rx="1.5" fill="#f59e0b" />
        <text x="175" y="59" fontSize="18" fontWeight="700" fill="#fbbf24">
          15 %
        </text>
        <text x="175" y="78" fontSize="10" fontWeight="700" fill="#e2e8f0">
          с разницы
        </text>
        <text x="175" y="94" fontSize="10" fill="#cbd5e1">
          налог = 15 % ×
        </text>
        <text x="175" y="108" fontSize="10" fill="#cbd5e1">
          (доход − расходы)
        </text>
        <text x="175" y="123" fontSize="10" fill="#94a3b8">
          крупные закупки
        </text>
        <text x="175" y="136" fontSize="10" fill="#94a3b8">
          расходы с документами
        </text>

        <rect x="10" y="144" width="145" height="32" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="18" y="156" fontSize="10" fill="#cbd5e1">
          лимит УСН — 300 млн ₽/год
        </text>
        <text x="18" y="170" fontSize="10" fill="#94a3b8">
          взносы уменьшают налог
        </text>

        <rect x="165" y="144" width="145" height="32" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="173" y="156" fontSize="10" fill="#cbd5e1">
          декларация — раз в год
        </text>
        <text x="173" y="170" fontSize="10" fill="#94a3b8">
          КУДиР — постоянно
        </text>
      </svg>
    </VisualWrapper>
  );
}
