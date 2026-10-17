import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const LEFT = [
  { label: "стол · адгезия", detail: "помыть, обезжирить" },
  { label: "первый слой", detail: "без щелей и волн" },
  { label: "поток", detail: "стенка по размеру" },
  { label: "ремни · люфт", detail: "каретка без стука" },
];

const RIGHT = [
  { label: "сопло", detail: "без нагара" },
  { label: "катушка", detail: "сушёная, та же марка" },
  { label: "остаток", detail: "с запасом на брак" },
];

/**
 * Кадр блока 9 урока Z4 «Серия: повторяемость, QC, допуски».
 *
 * Макет из описания `Z4_preflight.png`: чек-лист из семи пунктов блока 8.
 * Семь пунктов раскладываются в две колонки 4 + 3, чтобы подписи оставались
 * кеглем 10 px и не переносились. В кадре нет чисел, кроме количества пунктов.
 */
export function ProfitZ4Image1({ title, animated }: VisualProps) {
  const renderCheck = (item: { label: string; detail: string }, x: number, y: number) => (
    <g key={item.label}>
      <rect x={x} y={y} width={x === 12 ? 144 : 148} height="28" rx="5" fill="#0f172a" stroke="#334155" />
      <rect x={x + 8} y={y + 8} width="9" height="9" rx="2" fill="#3b82f6" fillOpacity="0.14" stroke="#3b82f6" />
      <path d={`M${x + 10} ${y + 12.5} L${x + 12.5} ${y + 15} L${x + 16} ${y + 10}`} fill="none" stroke="#60a5fa" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <text x={x + 23} y={y + 11} fontSize="10" fill="#e2e8f0">
        {item.label}
      </text>
      <text x={x + 23} y={y + 25} fontSize="10" fill="#94a3b8">
        {item.detail}
      </text>
    </g>
  );

  return (
    <VisualWrapper
      title={title}
      ariaLabel="Чек-лист перед партией из семи пунктов: стол и адгезия, первый слой, поток пластика, ремни и люфт, сопло, катушка и остаток пластика. Стол помыть и обезжирить, первый слой без щелей и волн, поток со стенкой по размеру, каретка без стука, сопло без нагара, катушка сушёная той же марки, остаток с запасом на брак"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          чек-лист перед партией
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          семь пунктов · от стола до катушки
        </text>

        {LEFT.map((item, index) => renderCheck(item, 12, 38 + index * 31))}
        {RIGHT.map((item, index) => renderCheck(item, 160, 38 + index * 31))}

        <text x="160" y="172" fontSize="10" fill="#94a3b8" textAnchor="middle">
          список держи рядом с принтером
        </text>
      </svg>
    </VisualWrapper>
  );
}
