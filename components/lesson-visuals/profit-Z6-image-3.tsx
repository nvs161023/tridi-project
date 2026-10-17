import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 21 урока Z6 «Упаковка, логистика, отправка».
 *
 * Макет из описания `Z6_fbo_fbs.png`: две схемы отправки. FBO — партия
 * едет на склад площадки, площадка хранит и отправляет клиенту; плюс —
 * короткий срок, минус — платное хранение. FBS — заказ собирают на своём
 * складе и везут в пункт приёма; плюс — нет платы за склад, минус — срок
 * отгрузки по часам. Новичку советуют FBS, пока продажи нерегулярные;
 * этикетку печатают только из личного кабинета.
 */
export function ProfitZ6Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Схема FBO: партия едет на склад площадки, площадка хранит и отправляет клиенту. Плюс — короткий срок, минус — платное хранение. Схема FBS: заказ собирают на своём складе и везут в пункт приёма. Плюс — нет платы за склад, минус — срок отгрузки по часам. Новичку подходит FBS, пока продажи нерегулярные, этикетку печатают только из личного кабинета"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="10" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          FBO или FBS
        </text>
        <text x="10" y="29" fontSize="10" fill="#94a3b8">
          кто собирает и везёт посылку
        </text>

        <rect x="10" y="34" width="145" height="116" rx="6" fill="#0f172a" stroke="#06b6d4" strokeOpacity="0.65" />
        <rect x="22" y="44" width="20" height="14" rx="2" fill="#06b6d4" fillOpacity="0.12" stroke="#06b6d4" />
        <path d="M22 49 L32 42 L42 49" fill="none" stroke="#22d3ee" strokeWidth="1.2" strokeLinejoin="round" />
        <rect x="26" y="51" width="5" height="5" rx="1" fill="#22d3ee" fillOpacity="0.65" />
        <rect x="33" y="51" width="5" height="5" rx="1" fill="#22d3ee" fillOpacity="0.65" />
        <text x="48" y="54" fontSize="11" fontWeight="700" fill="#67e8f9">
          FBO
        </text>
        <text x="48" y="68" fontSize="10" fill="#94a3b8">
          склад площадки
        </text>
        <text x="22" y="88" fontSize="10" fill="#cbd5e1">
          партия → склад
        </text>
        <text x="22" y="101" fontSize="10" fill="#cbd5e1">
          склад → клиент
        </text>
        <text x="22" y="119" fontSize="10" fontWeight="700" fill="#6ee7b7">
          + короткий срок
        </text>
        <text x="22" y="133" fontSize="10" fill="#fca5a5">
          − платное хранение
        </text>

        <rect x="165" y="34" width="145" height="116" rx="6" fill="#0f172a" stroke="#f59e0b" strokeOpacity="0.65" />
        <rect x="177" y="44" width="20" height="14" rx="2" fill="#f59e0b" fillOpacity="0.12" stroke="#f59e0b" />
        <path d="M180 50 L191 50 L194 47" fill="none" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="181" y="46" width="11" height="2" rx="1" fill="#fbbf24" fillOpacity="0.7" />
        <text x="203" y="54" fontSize="11" fontWeight="700" fill="#fcd34d">
          FBS
        </text>
        <text x="203" y="68" fontSize="10" fill="#94a3b8">
          свой склад
        </text>
        <text x="177" y="88" fontSize="10" fill="#cbd5e1">
          заказ → мой склад
        </text>
        <text x="177" y="101" fontSize="10" fill="#cbd5e1">
          → пункт приёма
        </text>
        <text x="177" y="119" fontSize="10" fontWeight="700" fill="#6ee7b7">
          + нет платы за склад
        </text>
        <text x="177" y="133" fontSize="10" fill="#fca5a5">
          − отгрузка по часам
        </text>

        <text x="160" y="160" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          новичку — FBS, пока продажи нерегулярные
        </text>
        <text x="160" y="174" fontSize="10" fill="#94a3b8" textAnchor="middle">
          этикетка — только из личного кабинета
        </text>
      </svg>
    </VisualWrapper>
  );
}
