import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три ряда: 12…308 и 26…130, шаг 36, высота 32; значок средства — 20…44. */
const ROW_Y = [26, 62, 98];
const ROW_H = 32;
const ICON_X = 20;
const TEXT_X = 54;
const TAG_X = 300;

type Means = {
  name: string;
  tag: string;
  note: string;
  kind: "gas" | "powder" | "water";
  color: string;
};

/** Чем тушить пластик — блок 12; капли, 230 В и вода — блок 4. */
const MEANS: Means[] = [
  {
    name: "CO2 2 кг",
    tag: "от 4 тыс. ₽",
    note: "гасит пластик и электронику, следов не оставляет",
    kind: "gas",
    color: "#3b82f6",
  },
  {
    name: "Порошковый АВС",
    tag: "около 1,5 тыс. ₽",
    note: "тушит надёжно, но порошок потом везде",
    kind: "powder",
    color: "#f59e0b",
  },
  {
    name: "Вода и полотенце",
    tag: "нельзя",
    note: "при 230 В это удар током: сначала сними питание",
    kind: "water",
    color: "#f87171",
  },
];

const NOTES = [
  "10–15 секунд — одно полное нажатие",
  "Два баллона по 2 кг лучше одного на 5 кг",
  "Держи баллон у двери на высоте руки",
];

/**
 * Кадр блока 11 урока C3 «Чем тушить пластик».
 *
 * Три средства из описания кадра `C3_extinguishers.png` и списка блока 12:
 * баллон CO2 на 2 кг гасит пластик и электронику и не оставляет следов, от
 * 4 тыс. ₽; порошковый АВС тушит надёжно, но порошок потом везде, около
 * 1,5 тыс. ₽; воду и мокрое полотенце при включённом принтере нельзя. Нижние
 * строки — тоже блок 12: 10–15 секунд это одно полное нажатие, два баллона по
 * 2 кг лучше одного на 5 кг, а баллон держат у двери на высоте руки, потому что
 * за принтером его не найдут. Капля воды и 230 В в розетке — блок 4.
 */
export function ConfidentC3Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Чем тушить пластик: CO2 2 кг гасит пластик и электронику без следов, от 4 тыс. ₽. Порошковый АВС тушит надёжно, но порошок потом везде, около 1,5 тыс. ₽. Воду и мокрое полотенце при включённом принтере нельзя: при 230 В это удар током, сначала снимают питание. 10–15 секунд — это одно полное нажатие, два баллона по 2 кг лучше одного на 5 кг, а баллон держат у двери на высоте руки"
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
          Что тушит пластик, а что делает хуже
        </text>

        {/* Средства сверху вниз: баллон, порошок и перечёркнутое ведро */}
        {MEANS.map((means, index) => {
          const y = ROW_Y[index];
          return (
            <g key={means.name}>
              <rect
                x="12"
                y={y}
                width="296"
                height={ROW_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <rect
                x={ICON_X}
                y={y + 4}
                width="24"
                height="24"
                rx="4"
                fill="#0f172a"
                fillOpacity="0.5"
                stroke={means.color}
                strokeOpacity="0.45"
              />
              {means.kind === "water" ? (
                <>
                  <polygon
                    points={`27,${y + 10} 41,${y + 10} 38,${y + 26} 30,${y + 26}`}
                    fill={means.color}
                    fillOpacity="0.2"
                    stroke={means.color}
                    strokeOpacity="0.8"
                  />
                  <line
                    x1="20"
                    y1={y + 4}
                    x2="44"
                    y2={y + 28}
                    stroke={means.color}
                    strokeOpacity="0.8"
                  />
                  <line
                    x1="44"
                    y1={y + 4}
                    x2="20"
                    y2={y + 28}
                    stroke={means.color}
                    strokeOpacity="0.8"
                  />
                </>
              ) : (
                <>
                  <rect
                    x="29"
                    y={y + 8}
                    width="6"
                    height="16"
                    rx="3"
                    fill={means.color}
                    fillOpacity="0.35"
                    stroke={means.color}
                    strokeOpacity="0.8"
                  />
                  <line
                    x1="32"
                    y1={y + 8}
                    x2="32"
                    y2={y + 4}
                    stroke={means.color}
                    strokeOpacity="0.8"
                  />
                  <line
                    x1="35"
                    y1={y + 10}
                    x2="40"
                    y2={y + 6}
                    stroke={means.color}
                    strokeOpacity="0.8"
                  />
                  {means.kind === "powder" && (
                    <circle cx="41" cy={y + 8} r="3" fill={means.color} fillOpacity="0.35" />
                  )}
                </>
              )}
              <text x={TEXT_X} y={y + 13} fontSize="11" fontWeight="700" fill={means.color}>
                {means.name}
              </text>
              <text x={TAG_X} y={y + 13} fontSize="10" fill={means.color} textAnchor="end">
                {means.tag}
              </text>
              <text x={TEXT_X} y={y + 26} fontSize="10" fill="#cbd5e1">
                {means.note}
              </text>
            </g>
          );
        })}

        {/* Нажатие, число баллонов и место у двери */}
        <rect
          x="12"
          y="134"
          width="296"
          height="36"
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
            y={145 + index * 11}
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
