import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Бокс слева 12…188 и 24…138, столбец фильтров справа 196…304. */
const BOX_X = 12;
const BOX_W = 176;
const BOX_Y = 24;
const BOX_H = 114;
const COL_X = 196;
const COL_W = 108;
const COL_CX = COL_X + COL_W / 2;

/** Ступени фильтрации сверху вниз: 26…118, между ними зазор 4. */
const SLAB_Y = [26, 50, 74, 98];
const SLAB_H = 20;

type Filter = { name: string; color: string };

/** Порядок по потоку — блоки 5, 13 и 14: предфильтр, HEPA, уголь, вентилятор. */
const FILTERS: Filter[] = [
  { name: "предфильтр", color: "#10b981" },
  { name: "HEPA H13", color: "#3b82f6" },
  { name: "уголь", color: "#f59e0b" },
  { name: "вентилятор", color: "#cbd5e1" },
];

const NOTES = [
  "Порядок один: предфильтр, HEPA, уголь, вентилятор",
  "Воздух идёт в одну сторону: от принтера к фильтрам",
  "PLA и PETG печатают без бокса: внутри теплица",
];

/**
 * Кадр блока 14 урока C2 «Бокс своими руками».
 *
 * Разрез из описания кадра `C2_box_diy.png`: принтер внутри бокса, а дальше по
 * потоку предфильтр, HEPA, уголь и вентилятор — воздух идёт в одну сторону. Про
 * жару внутри бокса и про открытые решётки блока питания — блок 18: при печати ABS
 * там держится 40–60 °C, у платы, драйверов и блока питания есть свои пределы, а
 * наглухо закрытый корпус без потока воздуха приводит к перезагрузкам. Оттуда же
 * оговорка про PLA и PETG: бокс им не нужен, он превращает комнатную температуру в
 * теплицу.
 */
export function ConfidentC2Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Бокс своими руками: разрез и поток. Внутри герметичного бокса стоит принтер, при печати ABS там держится 40–60 °C, а решётки блока питания остаются открытыми. Дальше по потоку идут предфильтр, HEPA H13, уголь и вентилятор — воздух идёт в одну сторону, от принтера к фильтрам и наружу. Порядок один: предфильтр, HEPA, уголь, вентилятор. Для PLA и PETG бокс не нужен: он превращает комнатную температуру в теплицу"
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
          Бокс своими руками: разрез и поток
        </text>

        {/* Бокс: принтер внутри, дальше воздух уходит в фильтры */}
        <rect
          x={BOX_X}
          y={BOX_Y}
          width={BOX_W}
          height={BOX_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <text x="20" y="37" fontSize="10" fill="#94a3b8">
          герметичный бокс
        </text>
        <text x="20" y="52" fontSize="10" fill="#f59e0b">
          40–60 °C при печати ABS
        </text>
        <text x="20" y="63" fontSize="10" fill="#94a3b8">
          решётки БП открыты
        </text>

        {/* Поток внутри бокса: в одну сторону, к фильтрам */}
        <line x1="24" y1="78" x2="160" y2="78" stroke="#f87171" strokeOpacity="0.8" />
        <path d="M168 78 L160 74 L160 82 Z" fill="#f87171" fillOpacity="0.85" />

        <rect
          x="28"
          y="88"
          width="146"
          height="46"
          rx="4"
          fill="#1e293b"
          fillOpacity="0.4"
          stroke="#64748b"
          strokeOpacity="0.6"
        />
        <text x="101" y="110" fontSize="12" fontWeight="700" fill="#cbd5e1" textAnchor="middle">
          принтер
        </text>
        <text x="101" y="124" fontSize="10" fill="#94a3b8" textAnchor="middle">
          источник выбросов
        </text>

        {/* Ступени фильтрации: сверху вниз, вентилятор последним */}
        <line x1="182" y1="36" x2="194" y2="36" stroke="#f87171" strokeOpacity="0.8" />
        <path d="M196 36 L188 32 L188 40 Z" fill="#f87171" fillOpacity="0.85" />

        {FILTERS.map((filter, index) => (
          <g key={filter.name}>
            <rect
              x={COL_X}
              y={SLAB_Y[index]}
              width={COL_W}
              height={SLAB_H}
              rx="4"
              fill={filter.color}
              fillOpacity="0.2"
              stroke={filter.color}
              strokeOpacity="0.7"
            />
            <text
              x={COL_CX}
              y={SLAB_Y[index] + 14}
              fontSize="10"
              fill={filter.color}
              textAnchor="middle"
            >
              {filter.name}
            </text>
            {index < FILTERS.length - 1 ? (
              <path
                d={`M${COL_CX - 6} ${SLAB_Y[index] + SLAB_H + 4} L${COL_CX} ${SLAB_Y[index] + SLAB_H + 8} L${COL_CX + 6} ${SLAB_Y[index] + SLAB_H + 4}`}
                fill="none"
                stroke="#64748b"
                strokeWidth="1.5"
              />
            ) : null}
          </g>
        ))}

        <line x1={COL_CX} y1="118" x2={COL_CX} y2="126" stroke="#64748b" />
        <path d={`M${COL_CX} 132 L${COL_CX - 4} 124 L${COL_CX + 4} 124 Z`} fill="#64748b" />
        <text x={COL_CX} y="136" fontSize="10" fill="#94a3b8" textAnchor="middle">
          наружу
        </text>

        {/* Жара внутри бокса и оговорка про PLA и PETG */}
        <rect
          x="12"
          y="142"
          width="296"
          height="34"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="22"
            y={153 + index * 11}
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

