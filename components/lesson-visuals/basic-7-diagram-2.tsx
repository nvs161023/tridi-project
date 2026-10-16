import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две панели: «железо» на 12…158, «числа» на 162…308, 48…124. */
const PANEL_TOP = 48;
const PANEL_H = 76;
const PANEL_X = [12, 162];
const PANEL_ROW_Y = [80, 96, 112];

const NOTES = [
  "тест: куб 0,45 ± 0,02 мм · подача 120 → 100 мм",
  "> 2 мм на подаче — экструдер, а не профиль",
];

type Group = { title: string; color: string; rows: string[] };

/** Порядок из блока 9: сначала железо (сопло, экструдер, нить), потом числа профиля. */
const GROUPS: Group[] = [
  {
    title: "сначала железо",
    color: "#f87171",
    rows: ["сопло: нагар и пробка", "шестерня подачи, стружка", "нить: 5 замеров"],
  },
  {
    title: "потом числа",
    color: "#3b82f6",
    rows: ["множитель потока: шаг 1 %", "сверить с пределом потока", "расслоение: +5 °C"],
  },
];

/**
 * Кадр блока 10 урока L7 «Щели и пористые стенки».
 *
 * Сверху правило разбора, ниже две панели: слева проверяемое железо — сопло,
 * экструдер и диаметр нити; справа числа профиля — множитель потока, сверка с
 * пределом потока и поправка температуры при расслоении. Снизу тесты.
 *
 * Числа — из блока 9: стенка 0,45 ± 0,02 мм, подача 120 → 100 мм, расхождение
 * больше 2 мм означает экструдер, шаг множителя 1–2 %, при расслоении +5 °C.
 */
export function Basic7Diagram2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Щели между линиями и пористые стенки: порядок разбора — сначала железо, потом числа. Железо: сопло с нагаром или пробкой, шестерня подачи и стружка, пять замеров диаметра нити. Числа: множитель потока шагом 1 процент, сверка с пределом потока хотэнда, при расслоении плюс 5 градусов. Тесты — одностенный куб со стенкой 0,45 плюс-минус 0,02 мм и подача 120 в 100 мм; расхождение больше 2 мм означает экструдер"
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
          Щели и пористые стенки
        </text>

        {/* Правило разбора */}
        <rect
          x="12"
          y="20"
          width="296"
          height="24"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="32" fontSize="10" fontWeight="700" fill="#e2e8f0">
          недодача: сначала железо, потом числа
        </text>
        <text x="22" y="42" fontSize="10" fill="#94a3b8">
          щели между линиями, пористая стенка, хруст
        </text>

        {/* Две панели: железо и числа */}
        {GROUPS.map((group, index) => (
          <g key={group.title}>
            <rect
              x={PANEL_X[index]}
              y={PANEL_TOP}
              width="146"
              height={PANEL_H}
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text x={PANEL_X[index] + 10} y="64" fontSize="11" fontWeight="700" fill={group.color}>
              {group.title}
            </text>
            {group.rows.map((row, rowIndex) => (
              <text
                key={row}
                x={PANEL_X[index] + 10}
                y={PANEL_ROW_Y[rowIndex]}
                fontSize="10"
                fill="#94a3b8"
              >
                {row}
              </text>
            ))}
          </g>
        ))}

        {/* Сноски: тесты */}
        {NOTES.map((note, index) => (
          <g key={note}>
            <rect
              x="12"
              y={132 + index * 24}
              width="296"
              height="20"
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text x="22" y={145 + index * 24} fontSize="10" fill="#94a3b8">
              {note}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
