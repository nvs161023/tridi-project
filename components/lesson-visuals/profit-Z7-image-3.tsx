import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const QUARTER_X = [56, 118, 180, 242, 304];

/**
 * Кадр блока 21 урока Z7 «Юр. оформление, налоги, лицензии».
 *
 * Макет из описания `Z7_tax_calendar.png`: чек, месячный платёж, квартальный
 * аванс, декларация и взносы. Самозанятый формирует чек в момент оплаты,
 * начисление — до 12-го, платёж — до 28-го. ИП платит аванс УСН по кварталам
 * до 28-го. Декларация — до конца апреля, взносы — до конца года, документы
 * хранят 4 года.
 */
export function ProfitZ7Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Год налогов в трёх ритмах. Каждый месяц: чек в момент оплаты, начисление до 12-го, оплата до 28-го. Каждый квартал: аванс УСН до 28-го. Раз в год: декларация до конца апреля, взносы до 31 декабря, документы хранят 4 года. Самозанятый работает без деклараций, налоговая видит чеки сама"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          год налогов
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          месяц · квартал · год
        </text>

        <rect x="10" y="36" width="300" height="104" rx="6" fill="#0f172a" stroke="#334155" />
        {QUARTER_X.map((x) => (
          <line key={x} x1={x} y1="41" x2={x} y2="137" stroke="#334155" strokeDasharray="2 3" />
        ))}
        {QUARTERS.map((quarter, index) => (
          <text key={quarter} x={(QUARTER_X[index] + QUARTER_X[index + 1]) / 2} y="46" fontSize="10" fill="#64748b" textAnchor="middle">
            {quarter}
          </text>
        ))}

        <text x="12" y="68" fontSize="10" fontWeight="700" fill="#06b6d4">
          месяц
        </text>
        <rect x="56" y="52" width="78" height="26" rx="4" fill="#1e293b" stroke="#06b6d4" strokeOpacity="0.6" />
        <text x="95" y="62" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          чек
        </text>
        <text x="95" y="75" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          при оплате
        </text>
        <rect x="140" y="52" width="78" height="26" rx="4" fill="#1e293b" stroke="#06b6d4" strokeOpacity="0.6" />
        <text x="179" y="62" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          начисление
        </text>
        <text x="179" y="75" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          до 12-го
        </text>
        <rect x="224" y="52" width="82" height="26" rx="4" fill="#1e293b" stroke="#06b6d4" strokeOpacity="0.6" />
        <text x="265" y="62" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          оплата
        </text>
        <text x="265" y="75" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          до 28-го
        </text>

        <text x="12" y="98" fontSize="10" fontWeight="700" fill="#3b82f6">
          квартал
        </text>
        <rect x="56" y="82" width="150" height="26" rx="4" fill="#1e293b" stroke="#3b82f6" strokeOpacity="0.6" />
        <text x="131" y="92" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          аванс УСН
        </text>
        <text x="131" y="105" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          до 28-го
        </text>
        <rect x="212" y="82" width="94" height="26" rx="4" fill="#1e293b" stroke="#3b82f6" strokeOpacity="0.6" />
        <text x="259" y="92" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          каждый
        </text>
        <text x="259" y="105" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          квартал
        </text>

        <text x="12" y="128" fontSize="10" fontWeight="700" fill="#f59e0b">
          год
        </text>
        <rect x="56" y="112" width="82" height="26" rx="4" fill="#1e293b" stroke="#f59e0b" strokeOpacity="0.6" />
        <text x="97" y="122" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          декларация
        </text>
        <text x="97" y="135" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          до конца апреля
        </text>
        <rect x="144" y="112" width="82" height="26" rx="4" fill="#1e293b" stroke="#f59e0b" strokeOpacity="0.6" />
        <text x="185" y="122" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          взносы
        </text>
        <text x="185" y="135" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          до 31 декабря
        </text>
        <rect x="232" y="112" width="72" height="26" rx="4" fill="#1e293b" stroke="#f59e0b" strokeOpacity="0.6" />
        <text x="268" y="122" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          документы
        </text>
        <text x="268" y="135" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          4 года
        </text>

        <rect x="10" y="142" width="300" height="34" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="18" y="155" fontSize="10" fill="#e2e8f0">
          чек — в момент оплаты · налоговая видит чеки сама
        </text>
        <text x="18" y="169" fontSize="10" fill="#94a3b8">
          самозанятый — без деклараций
        </text>
      </svg>
    </VisualWrapper>
  );
}
