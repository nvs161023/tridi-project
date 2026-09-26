import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Девять дат из content урока: от патента Кодамы до Klipper и CoreXY.
 *
 * Эпоха важна для смысла: до 2009 года технология была закрыта патентом, и это
 * разделяет ленту на две части. Первые четыре даты — серая эпоха патентов,
 * пятая (2009, патент FDM истёк) — янтарная точка перелома, последние четыре —
 * синяя открытая эра. Так одна деталь несёт идею урока, а не только год.
 */
/** К какой эпохе относится дата: до патента, перелом, открытая эра. */
type Era = "closed" | "pivot" | "open";

const events: { year: string; text: string; era: Era }[] = [
  { year: "1981", text: "Кодама: послойное отверждение", era: "closed" },
  { year: "1984", text: "Чак Халл патентует SLA", era: "closed" },
  { year: "1989", text: "Крамп патентует FDM", era: "closed" },
  { year: "2005", text: "стартует проект RepRap", era: "closed" },
  { year: "2009", text: "патент FDM истёк — бум дома", era: "pivot" },
  { year: "2011", text: "Ultimaker", era: "open" },
  { year: "2014", text: "Prusa i3", era: "open" },
  { year: "2020", text: "Bambu Lab: скорость", era: "open" },
  { year: "2024", text: "Klipper и CoreXY дома", era: "open" },
];

/** Цвета трёх эпох: до патента, перелом, открытая эра. */
const eraStyles = {
  closed: { stroke: "#475569", year: "#cbd5e1", text: "#94a3b8", dot: "#64748b" },
  pivot: { stroke: "#f59e0b", year: "#fbbf24", text: "#fcd34d", dot: "#f59e0b" },
  open: { stroke: "#3b82f6", year: "#93c5fd", text: "#bfdbfe", dot: "#3b82f6" },
} as const;

/**
 * Хронология 3D-печати — вертикальная лента из девяти дат.
 *
 * От «Твоего пути» в базовом курсе отличается осью: там дорога по горизонтали с
 * точками этапов, здесь ось времени вертикальная — слева точки на шпинделе,
 * справа год в плашке и событие. Приём один на курс: горизонтальная дорога уже
 * занята финалом базового курса.
 */
export function ProAA1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Хронология 3D-печати: девять дат столбиком от 1981 до 2024 — патенты Кодамы, Халла и Крампа, RepRap, 2009 год и бум домашних принтеров, Ultimaker, Prusa, Bambu Lab, Klipper"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
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

        {/* Ось времени: вертикальная линия слева, к ней — штрихи-связки */}
        <line x1="46" y1="26" x2="46" y2="158" stroke="#475569" strokeWidth="1.2" />

        {events.map((event, index) => {
          const y = 30 + index * 16.5;
          const style = eraStyles[event.era];

          return (
            <g key={event.year}>
              <line x1="46" y1={y} x2="54" y2={y} stroke={style.dot} strokeWidth="1" />
              <circle cx="46" cy={y} r={event.era === "pivot" ? 3.4 : 2.2} fill={style.dot} />
              <rect
                x="54"
                y={y - 6.5}
                width="40"
                height="13"
                rx="4"
                fill="#0f172a"
                stroke={style.stroke}
              />
              <text
                x="74"
                y={y + 3.5}
                fontSize="10"
                fontWeight="bold"
                fill={style.year}
                textAnchor="middle"
              >
                {event.year}
              </text>
              <text
                x="104"
                y={y + 3.5}
                fontSize="10"
                fontWeight={event.era === "pivot" ? "bold" : "normal"}
                fill={style.text}
              >
                {event.text}
              </text>
            </g>
          );
        })}

        {/* Эпохи — словами сверху, чтобы подписи читались горизонтально */}
        <text x="16" y="15" fontSize="10" fill="#64748b">
          патенты 1981–2005
        </text>
        <text x="306" y="15" fontSize="10" fill="#64748b" textAnchor="end">
          открыто с 2009
        </text>
      </svg>
    </VisualWrapper>
  );
}
