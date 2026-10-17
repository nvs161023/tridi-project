import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const ZONES = [
  { range: "<10", verdict: "проверь спрос", color: "#93c5fd" },
  { range: "10–100", verdict: "смотри карточки", color: "#cbd5e1" },
  { range: ">100", verdict: "цена низкая", color: "#f87171" },
];

/**
 * Кадр блока 22 урока Z1 «Что продавать: ниши и маржа».
 *
 * Макет из описания `Z1_competition.png`: сколько продавцов рядом и по каким
 * ценам они продают. Пороги «больше сотни» и «меньше десяти», разбор десяти
 * отзывов и повторяющиеся 3–4 жалобы — блок 10, таблица на десять строк и
 * проверка за пять минут — там же.
 */
export function ProfitZ1Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Конкуренция на площадке. Если продавцов меньше десяти, проверь спрос особенно внимательно. Если от десяти до ста — смотри их карточки. Если больше сотни, цена будет низкой. Возьми десять отзывов конкурента: если три или четыре жалобы повторяются, это готовая ниша. Таблица на десять строк: продавец, цена, отзывы, дата. Такая проверка занимает пять минут"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          конкуренция на площадке
        </text>

        <rect x="12" y="24" width="188" height="110" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="22" y="38" fontSize="10" fontWeight="700" fill="#e2e8f0">
          продавцов на первой странице
        </text>
        {ZONES.map((zone, i) => {
          const y = 56 + i * 30;
          return (
            <g key={zone.range}>
              {i > 0 ? <path d={`M22 ${y - 18} H190`} stroke="#334155" strokeWidth="0.7" /> : null}
              <text x="22" y={y} fontSize="11" fontWeight="700" fill={zone.color}>
                {zone.range}
              </text>
              <text x="80" y={y} fontSize="10" fill="#cbd5e1">
                {zone.verdict}
              </text>
            </g>
          );
        })}

        <rect x="208" y="24" width="100" height="110" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="218" y="38" fontSize="10" fontWeight="700" fill="#e2e8f0">
          отзывы
        </text>
        <text x="218" y="62" fontSize="20" fontWeight="700" fill="#e2e8f0">
          10
        </text>
        <text x="244" y="59" fontSize="10" fill="#94a3b8">
          отзывов
        </text>
        <text x="218" y="80" fontSize="10" fontWeight="700" fill="#6ee7b7">
          3–4 жалобы
        </text>
        <text x="218" y="94" fontSize="10" fill="#94a3b8">
          повторяются
        </text>
        <path d="M218 104 H298" stroke="#334155" strokeWidth="0.7" />
        <text x="218" y="120" fontSize="10" fontWeight="700" fill="#fcd34d">
          = готовая ниша
        </text>

        <rect x="12" y="142" width="296" height="28" rx="5" fill="#3b82f6" fillOpacity="0.08" stroke="#3b82f6" strokeOpacity="0.3" />
        <text x="22" y="154" fontSize="10" fill="#e2e8f0">
          10 строк: продавец, цена, отзывы, дата
        </text>
        <text x="22" y="166" fontSize="10" fill="#94a3b8">
          такая проверка — за 5 минут
        </text>
      </svg>
    </VisualWrapper>
  );
}
