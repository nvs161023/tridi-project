import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 24 урока Z7 «Юр. оформление, налоги, лицензии».
 *
 * `Z7_receipt_flow.png`: оплата, касса или приложение, ОФД, налоговая и клиент.
 * Самозанятому касса не нужна. ИП и ООО при продажах людям используют кассу
 * с ОФД; заводы по счёту обычно проходят без кассы. Возврат — отдельный чек.
 */
export function ProfitZ7Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Две дороги чека. Самозанятый: оплата, приложение «Мой налог», чек клиенту, данные в ФНС. ИП или ООО: оплата, онлайн-касса, ОФД, ФНС, чек клиенту. Самозанятому касса не нужна. Касса — от нескольких тысяч рублей. Завод по счёту обычно без кассы. Возврат — отдельный чек"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          путь чека
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          от оплаты до налоговой
        </text>

        <rect x="10" y="36" width="300" height="42" rx="5" fill="#0f172a" stroke="#334155" />
        <line x1="80" y1="57" x2="304" y2="57" stroke="#475569" strokeWidth="1.5" />
        <text x="16" y="53" fontSize="10" fontWeight="700" fill="#06b6d4">
          самозанятый
        </text>
        <rect x="84" y="42" width="52" height="30" rx="4" fill="#1e293b" stroke="#06b6d4" strokeOpacity="0.65" />
        <text x="110" y="55" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          оплата
        </text>
        <text x="110" y="68" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          клиента
        </text>
        <rect x="140" y="42" width="52" height="30" rx="4" fill="#1e293b" stroke="#06b6d4" strokeOpacity="0.65" />
        <text x="166" y="55" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          «Мой
        </text>
        <text x="166" y="68" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          налог»
        </text>
        <rect x="196" y="42" width="52" height="30" rx="4" fill="#1e293b" stroke="#06b6d4" strokeOpacity="0.65" />
        <text x="222" y="55" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          чек
        </text>
        <text x="222" y="68" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          клиенту
        </text>
        <rect x="252" y="42" width="52" height="30" rx="4" fill="#1e293b" stroke="#06b6d4" strokeOpacity="0.65" />
        <text x="278" y="55" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          ФНС
        </text>
        <text x="278" y="68" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          данные
        </text>

        <rect x="10" y="82" width="300" height="42" rx="5" fill="#0f172a" stroke="#334155" />
        <line x1="80" y1="103" x2="304" y2="103" stroke="#475569" strokeWidth="1.5" />
        <text x="16" y="99" fontSize="10" fontWeight="700" fill="#f59e0b">
          ИП / ООО
        </text>
        <rect x="84" y="88" width="52" height="30" rx="4" fill="#1e293b" stroke="#f59e0b" strokeOpacity="0.65" />
        <text x="110" y="101" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          оплата
        </text>
        <text x="110" y="114" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          клиента
        </text>
        <rect x="140" y="88" width="52" height="30" rx="4" fill="#1e293b" stroke="#f59e0b" strokeOpacity="0.65" />
        <text x="166" y="101" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          касса
        </text>
        <text x="166" y="114" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          онлайн
        </text>
        <rect x="196" y="88" width="52" height="30" rx="4" fill="#1e293b" stroke="#f59e0b" strokeOpacity="0.65" />
        <text x="222" y="101" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          ОФД
        </text>
        <text x="222" y="114" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          оператор
        </text>
        <rect x="252" y="88" width="52" height="30" rx="4" fill="#1e293b" stroke="#f59e0b" strokeOpacity="0.65" />
        <text x="278" y="101" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          ФНС
        </text>
        <text x="278" y="114" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          данные
        </text>

        <rect x="10" y="128" width="96" height="44" rx="5" fill="#0f172a" stroke="#06b6d4" strokeOpacity="0.45" />
        <text x="18" y="141" fontSize="10" fontWeight="700" fill="#e2e8f0">
          самозанятый
        </text>
        <text x="18" y="154" fontSize="10" fill="#cbd5e1">
          касса не нужна
        </text>
        <text x="18" y="167" fontSize="10" fill="#94a3b8">
          приложение
        </text>

        <rect x="112" y="128" width="96" height="44" rx="5" fill="#0f172a" stroke="#f59e0b" strokeOpacity="0.45" />
        <text x="120" y="141" fontSize="10" fontWeight="700" fill="#e2e8f0">
          ИП / ООО
        </text>
        <text x="120" y="154" fontSize="10" fill="#cbd5e1">
          касса + ОФД
        </text>
        <text x="120" y="167" fontSize="10" fill="#94a3b8">
          от неск. тысяч ₽
        </text>

        <rect x="214" y="128" width="96" height="44" rx="5" fill="#0f172a" stroke="#10b981" strokeOpacity="0.45" />
        <text x="222" y="141" fontSize="10" fontWeight="700" fill="#e2e8f0">
          завод по счёту
        </text>
        <text x="222" y="154" fontSize="10" fill="#cbd5e1">
          обычно без кассы
        </text>
        <text x="222" y="167" fontSize="10" fill="#94a3b8">
          возврат — чек
        </text>
      </svg>
    </VisualWrapper>
  );
}
