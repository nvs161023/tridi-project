import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Список замеров: одна панель 12…308, 20…102. */
const PANEL_TOP = 20;
const PANEL_H = 82;
const MARK_X = 24;
const TEXT_X = 44;
const ROW_Y = [36, 56, 76, 96];

const LEAD = "сначала факты, потом выводы: глаза не измеряют";
const LEAD_NOTE = "стенка тоньше 0,42 мм — недодача, толще 0,50 — перелив";
const NOTES = [
  "время и расход: совпало в 10–15 % — профиль согласован",
  "три числа рядом: задумано, вышло, отклонение",
];

/** Четыре замера из блока 29 и ожидаемые значения из блока 28. */
const MEASURES = [
  "габарит: из модели, плюс 0,1–0,2 мм — норма",
  "стенка: 0,45–0,48 мм при сопле 0,4 мм и слое 0,2 мм",
  "отверстие: сверяем с заложенным зазором 0,2–0,3 мм",
  "высота по Z: из модели, отклонение до 0,1–0,2 мм",
];

/**
 * Кадр блока 29 урока L8 «Что и чем померить: четыре замера».
 *
 * Штангенциркуль и четыре замера: габарит, толщина стенки, диаметр отверстия и
 * высота по Z — рядом ожидаемые значения. Снизу сверка с предпросмотром.
 *
 * Числа — из блоков 27, 28 и 30: замеры в пределах 0,1–0,2 мм от ожидаемых,
 * стенка 0,45–0,48 мм при сопле 0,4 мм и слое 0,2 мм, тоньше 0,42 мм — недодача,
 * толще 0,50 мм — перелив, время и расход совпадают в пределах 10–15 %.
 */
export function Basic8Diagram4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Что и чем померить: четыре замера штангенциркулем. Габарит детали из модели, плюс 0,1–0,2 мм — это норма. Стенка 0,45–0,48 мм при сопле 0,4 мм и слое 0,2 мм: тоньше 0,42 — недодача, толще 0,50 — перелив. Диаметр отверстия сверяют с заложенным зазором 0,2–0,3 мм. Высота по Z из модели с отклонением до 0,1–0,2 мм. Вторая сверка — с предпросмотром: время и расход совпадают в пределах 10–15 процентов"
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
          Что и чем померить: четыре замера
        </text>

        {/* Четыре замера штангенциркулем */}
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
        {MEASURES.map((measure, index) => (
          <g key={measure}>
            <rect
              x={MARK_X}
              y={ROW_Y[index] - 9}
              width="14"
              height="9"
              rx="1"
              fill="#38bdf8"
              fillOpacity="0.2"
              stroke="#38bdf8"
            />
            <line
              x1={MARK_X - 3}
              y1={ROW_Y[index] - 4.5}
              x2={MARK_X + 17}
              y2={ROW_Y[index] - 4.5}
              stroke="#38bdf8"
            />
            <text x={TEXT_X} y={ROW_Y[index]} fontSize="10" fill="#cbd5e1">
              {measure}
            </text>
          </g>
        ))}

        {/* Сверка с предпросмотром и запись трёх чисел */}
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
