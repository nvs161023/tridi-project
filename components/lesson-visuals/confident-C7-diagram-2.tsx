import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Таблица: шапка на 32, пять строк через 17, название 16…104, пояс 110…170. */
const HEAD_Y = 32;
const ROW_TOP = 48;
const ROW_STEP = 17;
const NAME_X = 16;
const NOTE_X = 110;
const VALUE_X = 304;

type Row = { name: string; note: string; value: string; color: string };

/** Рабочая таблица зазоров — блоки 22 и 16–19; границы 0,2…0,4 мм — блок 20. */
const ROWS: Row[] = [
  { name: "Шип-паз", note: "на сторону", value: "0,2–0,3 мм", color: "#10b981" },
  { name: "Ласточкин хвост", note: "на сторону", value: "0,2–0,3 мм", color: "#10b981" },
  { name: "Штифт 3 мм", note: "отверстие", value: "3,1 мм", color: "#60a5fa" },
  { name: "Магнит", note: "карман больше", value: "+0,1 мм", color: "#f59e0b" },
  { name: "Резьба M3", note: "под метчик", value: "2,9 мм", color: "#60a5fa" },
];

const NOTES = [
  "Меньше 0,2 мм не влезет, больше 0,4 мм люфтит",
  "Таблица — старт, точный зазор даёт образец",
];

/**
 * Кадр блока 21 урока C7 «Зазоры по соединениям».
 *
 * Таблица из описания кадра `C7_tolerance_table.png` и блока 22: шип-паз и
 * ласточкин хвост — 0,2–0,3 мм на сторону, штифт 3 мм — отверстие 3,1 мм,
 * магнит — карман на 0,1 мм больше, резьба M3 — отверстие 2,9 мм под метчик.
 * Нижние строки — правило блока 20: ниже 0,2 мм шип не входит, выше 0,4 мм
 * стык болтается, а таблица остаётся только стартовой точкой — настоящий зазор
 * показывает образец.
 */
export function ConfidentC7Diagram2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Зазоры по соединениям. Шип-паз — 0,2–0,3 миллиметра на сторону. Ласточкин хвост — 0,2–0,3 миллиметра на сторону. Штифт 3 миллиметра — отверстие 3,1 миллиметра. Магнит — карман на 0,1 миллиметра больше магнита. Резьба M3 — отверстие 2,9 миллиметра под метчик. Меньше 0,2 миллиметра шип не влезет, больше 0,4 миллиметра стык люфтит. Таблица — только старт, точный зазор даёт образец"
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
          рабочие значения, мм
        </text>

        {/* Шапка таблицы */}
        <text x={NAME_X} y={HEAD_Y} fontSize="10" fill="#64748b">
          Соединение
        </text>
        <text x={VALUE_X} y={HEAD_Y} fontSize="10" fill="#64748b" textAnchor="end">
          Зазор или размер
        </text>
        <line x1="12" y1="37" x2="308" y2="37" stroke="#334155" />

        {ROWS.map((row, index) => {
          const y = ROW_TOP + index * ROW_STEP;
          return (
            <g key={row.name}>
              {index === 0 ? (
                <rect
                  x="12"
                  y={y - 12}
                  width="296"
                  height="16"
                  rx="3"
                  fill="#10b981"
                  fillOpacity="0.08"
                />
              ) : null}
              <text x={NAME_X} y={y} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {row.name}
              </text>
              <text x={NOTE_X} y={y} fontSize="10" fill="#94a3b8">
                {row.note}
              </text>
              <text x={VALUE_X} y={y} fontSize="10" fontWeight="700" fill={row.color} textAnchor="end">
                {row.value}
              </text>
            </g>
          );
        })}

        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={146 + index * 16}
            fontSize="10"
            fontWeight={index === 0 ? "700" : "400"}
            fill={index === 0 ? "#e2e8f0" : "#94a3b8"}
          >
            {note}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
