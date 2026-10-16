import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Список проверок: одна панель 12…308, 20…102. */
const PANEL_TOP = 20;
const PANEL_H = 82;
const MARK_X = 26;
const TEXT_X = 38;
const ROW_Y = [36, 51, 66, 81, 96];

const LEAD = "профиль от другого сопла — это 240 °C и паутина";
const LEAD_NOTE = "на принтере сопло 0,4 мм — в слайсере то же";
const NOTES = [
  "кайма 5–8 мм только узкой детали · юбка бесполезна",
  "заполнение 100 % — это удвоенное время, не прочность",
];

/** Пять проверок из блока 14 и ошибок из блока 16. */
const CHECKS = [
  "первый слой: Z-offset и тест-квадрат 20 на 20",
  "стенки: 2–3 периметра, заполнение 15–20 %",
  "поддержки: зазор 0,2–0,3 мм, плотность 10–15 %",
  "время и расход: сравнить с фактом, 10–15 %",
  "посадка и габариты: запас 5 мм по краям",
];

/**
 * Кадр блока 15 урока L8 «Пять проверок в предпросмотре».
 *
 * Список из пяти пунктов: первый слой, стенки, поддержки, время и расход,
 * посадка с габаритами. Снизу — две ошибки подготовки, которые видно ещё до
 * расчёта. Все числа взяты из блока 14 (профиль перед расчётом) и блока 16
 * (три ошибки подготовки).
 */
export function Basic8Diagram2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пять проверок в предпросмотре: первый слой и Z-offset с тест-квадратом 20 на 20, стенки из 2–3 периметров с заполнением 15–20 процентов, поддержки с зазором 0,2–0,3 мм и плотностью 10–15 процентов, время и расход против факта в пределах 10–15 процентов, посадка и габариты с запасом 5 мм по краям области печати. Ошибки подготовки: профиль от другого сопла — это 240 градусов и паутина, заполнение 100 процентов удваивает время и расход, а прочность дают периметры"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect
          x="0.5"
          y="0.5"
          width="319"
          height="179"
          rx="12"
          fill="#1e293b"
          fillOpacity="0.5"
          stroke="#475569"
        />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          Пять проверок в предпросмотре
        </text>

        {/* Пять отметок: первый слой, стенки, поддержки, время, посадка */}
        <rect
          x="12"
          y={PANEL_TOP}
          width="296"
          height={PANEL_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {CHECKS.map((check, index) => (
          <g key={check}>
            <circle cx={MARK_X} cy={ROW_Y[index] - 4} r="4.5" fill="#10b981" fillOpacity="0.2" />
            <path
              d={`M${MARK_X - 2.5} ${ROW_Y[index] - 4} L${MARK_X - 0.5} ${ROW_Y[index] - 1.5} L${MARK_X + 3} ${ROW_Y[index] - 7}`}
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
            />
            <text x={TEXT_X} y={ROW_Y[index]} fontSize="10" fill="#cbd5e1">
              {check}
            </text>
          </g>
        ))}

        {/* Ошибки подготовки */}
        <rect
          x="12"
          y="106"
          width="296"
          height="24"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="118" fontSize="10" fontWeight="700" fill="#e2e8f0">
          {LEAD}
        </text>
        <text x="22" y="128" fontSize="10" fill="#94a3b8">
          {LEAD_NOTE}
        </text>
        {NOTES.map((note, index) => (
          <g key={note}>
            <rect
              x="12"
              y={134 + index * 24}
              width="296"
              height={index === 1 ? 18 : 20}
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text x="22" y={147 + index * 24} fontSize="10" fill="#94a3b8">
              {note}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
