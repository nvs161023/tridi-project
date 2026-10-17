import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const MESSAGES = [
  { number: "1", title: "заказ принят", line1: "сроки", line2: "названы", color: "#3b82f6" },
  { number: "2", title: "посылка ушла", line1: "трек", line2: "внутри", color: "#06b6d4" },
  { number: "3", title: "прибыло", line1: "в пункт", line2: "выдачи", color: "#f59e0b" },
  { number: "4", title: "пару дней", line1: "всё в порядке?", line2: "попроси отзыв", color: "#10b981" },
];

/**
 * Кадр блока 24 урока Z6 «Упаковка, логистика, отправка».
 *
 * Макет из описания `Z6_track_messages.png`: четыре сообщения клиенту —
 * заказ принят со сроками, посылка ушла с треком, прибыло в пункт выдачи,
 * через пару дней — проверка и просьба об отзыве. Трек-номер и ссылку
 * отправляют сразу; если три дня нет движения, звонят в поддержку.
 * Четыре шаблона экономят 10 минут на отправке.
 */
export function ProfitZ6Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Четыре сообщения клиенту: заказ принят и названы сроки; посылка ушла, трек внутри; прибыло в пункт выдачи; через пару дней — всё в порядке и просьба об отзыве. Трек-номер и ссылку отправляют сразу, если три дня нет движения — звонят в поддержку. Четыре шаблона экономят десять минут на отправке"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="10" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          сообщения клиенту
        </text>
        <text x="10" y="29" fontSize="10" fill="#94a3b8">
          четыре шага и 10 минут экономии
        </text>

        <line x1="48" y1="54" x2="276" y2="54" stroke="#475569" strokeWidth="1.5" />
        {MESSAGES.map((message, index) => {
          const center = 48 + index * 76;
          return (
            <g key={message.number}>
              <circle cx={center} cy="54" r="10" fill="#0f172a" stroke={message.color} strokeWidth="1.5" />
              <text x={center} y="57.5" fontSize="10" fontWeight="700" fill={message.color} textAnchor="middle">
                {message.number}
              </text>
              <text x={center} y="86" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
                {message.title}
              </text>
              <text x={center} y="100" fontSize="10" fill="#cbd5e1" textAnchor="middle">
                {message.line1}
              </text>
              <text x={center} y="113" fontSize="10" fill="#94a3b8" textAnchor="middle">
                {message.line2}
              </text>
            </g>
          );
        })}

        <rect x="10" y="124" width="300" height="48" rx="6" fill="#0f172a" stroke="#334155" />
        <text x="160" y="137" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          трек-номер и ссылка — сразу клиенту
        </text>
        <text x="160" y="150" fontSize="10" fill="#fca5a5" textAnchor="middle">
          нет движения 3 дня → звони в поддержку
        </text>
        <text x="160" y="163" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          4 шаблона экономят 10 минут на отправке
        </text>
      </svg>
    </VisualWrapper>
  );
}
