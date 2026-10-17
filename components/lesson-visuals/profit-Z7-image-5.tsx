import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const MANDATORY = [
  { title: "дети", lines: ["материалы", "прочность", "возраст + знак"], color: "#06b6d4" },
  { title: "медицина", lines: ["изделия", "и их части", "ТР ТС"], color: "#3b82f6" },
  { title: "посуда", lines: ["контакт", "с едой", "ТР ТС"], color: "#10b981" },
];

/**
 * Кадр блока 26 урока Z7 «Юр. оформление, налоги, лицензии».
 *
 * Макет из описания `Z7_certification.png`: детские, медицинские и пищевые
 * товары сертифицируются обязательно. У детских проверяют материалы, прочность
 * и маркировку. Подставки, органайзеры, держатели, крепления, полки и декор для
 * взрослых обычно не требуют сертификата. Декларация проще сертификата,
 * добровольный знак — доверие, партия стоит десятки тысяч рублей.
 */
export function ProfitZ7Image5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Обязательная сертификация по ТР ТС: детские товары и игрушки — материалы, прочность, возраст и маркировка; медицинские изделия и их части; посуда и всё, что контактирует с едой. Обычно не нужно: подставки, органайзеры, держатели, крепления, полки и декор для взрослых. Декларация о соответствии проще сертификата, решение принимает производитель. Добровольный знак — доверие, а не обязанность. Сертификат на партию стоит десятки тысяч рублей"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          что сертифицируют обязательно
        </text>
        <rect x="270" y="4" width="38" height="14" rx="7" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeOpacity="0.6" />
        <text x="289" y="14" fontSize="10" fontWeight="700" fill="#fbbf24" textAnchor="middle">
          ТР ТС
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          три группы — без вариантов
        </text>

        {MANDATORY.map((group, index) => {
          const x = 10 + index * 102;
          return (
            <g key={group.title}>
              <rect x={x} y="36" width="96" height="62" rx="5" fill="#0f172a" stroke="#334155" />
              <rect x={x} y="36" width="96" height="3" rx="1.5" fill={group.color} />
              <text x={x + 48} y="50" fontSize="10" fontWeight="700" fill={group.color} textAnchor="middle">
                {group.title}
              </text>
              {group.lines.map((line, lineIndex) => (
                <text key={line} x={x + 8} y={66 + lineIndex * 13} fontSize="10" fill="#cbd5e1">
                  {line}
                </text>
              ))}
            </g>
          );
        })}

        <rect x="10" y="104" width="150" height="72" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="18" y="118" fontSize="10" fontWeight="700" fill="#e2e8f0">
          обычно не нужно
        </text>
        <text x="18" y="132" fontSize="10" fill="#cbd5e1">
          подставки, органайзеры
        </text>
        <text x="18" y="145" fontSize="10" fill="#cbd5e1">
          держатели, крепления
        </text>
        <text x="18" y="158" fontSize="10" fill="#cbd5e1">
          полки, декор
        </text>
        <text x="18" y="171" fontSize="10" fill="#94a3b8">
          одной подставке не нужен
        </text>

        <rect x="166" y="104" width="144" height="72" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="174" y="118" fontSize="10" fontWeight="700" fill="#e2e8f0">
          декларация и знак
        </text>
        <text x="174" y="132" fontSize="10" fill="#cbd5e1">
          декларация проще
        </text>
        <text x="174" y="145" fontSize="10" fill="#cbd5e1">
          решает производитель
        </text>
        <text x="174" y="158" fontSize="10" fill="#cbd5e1">
          знак — доверие
        </text>
        <text x="174" y="171" fontSize="10" fill="#94a3b8">
          партия — десятки тыс. ₽
        </text>
      </svg>
    </VisualWrapper>
  );
}
