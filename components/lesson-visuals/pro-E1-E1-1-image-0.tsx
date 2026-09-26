import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Пять пластиков из content урока и списка температур: катушка, цвет филамента
 * и карточка под ней — сопло, стол, свойство и применение.
 *
 * Пятый столбец (ASA) отличается от ABS только применением: у них одинаковые
 * температуры и похожий характер, разница — стойкость к солнцу, поэтому цвета
 * катушек совпадают, а подписи разные.
 */
type Plastic = {
  x: number;
  name: string;
  nozzle: string;
  bed: string;
  property: string;
  use: string;
  accent: string;
  bright: string;
};

const plastics: Plastic[] = [
  {
    x: 14,
    name: "PLA",
    nozzle: "200–210",
    bed: "стол 60",
    property: "хрупкий",
    use: "декор",
    accent: "#22c55e",
    bright: "#86efac",
  },
  {
    x: 74,
    name: "PETG",
    nozzle: "230–240",
    bed: "стол 80",
    property: "прочный",
    use: "нагрузки",
    accent: "#eab308",
    bright: "#fde68a",
  },
  {
    x: 134,
    name: "ABS",
    nozzle: "240–250",
    bed: "стол 100",
    property: "капризный",
    use: "камера",
    accent: "#f97316",
    bright: "#fdba74",
  },
  {
    x: 194,
    name: "TPU",
    nozzle: "220–240",
    bed: "стол 50",
    property: "гибкий",
    use: "резинка",
    accent: "#38bdf8",
    bright: "#7dd3fc",
  },
  {
    x: 254,
    name: "ASA",
    nozzle: "240–250",
    bed: "стол 100",
    property: "для улицы",
    use: "солнце",
    accent: "#f97316",
    bright: "#fdba74",
  },
];

/**
 * Сравнение пластиков — пять катушек в ряд, у каждой свой цвет филамента и
 * карточка: сопло, стол, свойство, применение. Не таблица и не диаграмма:
 * предмет здесь — сама катушка, а числа под ней читаются как её паспорт.
 *
 * От таблицы филамента в базовом уроке 2 и от диаграммы выбросов в модуле A-без
 * отличается приёмом: там строки таблицы и столбцы одного параметра, здесь
 * предметные катушки с подписанными данными.
 */
export function ProE1E11Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пять катушек пластиков с данными: PLA — сопло 200–210, стол 60, хрупкий, для декора; PETG — 230–240, стол 80, прочный, для нагрузок; ABS — 240–250, стол 100, капризный, нужна камера; TPU — 220–240, стол 50, гибкий, как резинка; ASA — 240–250, стол 100, для улицы"
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

        <text x="14" y="20" fontSize="10" fill="#94a3b8">
          числа — сопло и стол, °C
        </text>

        {/* Катушки: два фланца, намотка филамента и ступица */}
        {plastics.map((plastic) => (
          <g key={plastic.name}>
            <rect
              x={plastic.x + 3}
              y="31"
              width="8"
              height="34"
              rx="2"
              fill="#334155"
              stroke="#64748b"
            />
            <rect
              x={plastic.x + 41}
              y="31"
              width="8"
              height="34"
              rx="2"
              fill="#334155"
              stroke="#64748b"
            />
            <rect
              x={plastic.x + 13}
              y="38"
              width="26"
              height="20"
              rx="2"
              fill={plastic.accent}
              fillOpacity="0.5"
              stroke={plastic.accent}
            />
            <line
              x1={plastic.x + 15}
              y1="43"
              x2={plastic.x + 37}
              y2="43"
              stroke={plastic.bright}
              strokeWidth="0.8"
            />
            <line
              x1={plastic.x + 15}
              y1="48"
              x2={plastic.x + 37}
              y2="48"
              stroke={plastic.bright}
              strokeWidth="0.8"
            />
            <line
              x1={plastic.x + 15}
              y1="53"
              x2={plastic.x + 37}
              y2="53"
              stroke={plastic.bright}
              strokeWidth="0.8"
            />
            <circle cx={plastic.x + 26} cy="48" r="4" fill="#0f172a" stroke="#64748b" />

            <text
              x={plastic.x + 26}
              y="82"
              fontSize="10"
              fontWeight="bold"
              fill={plastic.bright}
              textAnchor="middle"
            >
              {plastic.name}
            </text>
            <text
              x={plastic.x + 26}
              y="96"
              fontSize="10"
              fill="#cbd5e1"
              textAnchor="middle"
            >
              {plastic.nozzle}
            </text>
            <text
              x={plastic.x + 26}
              y="110"
              fontSize="10"
              fill="#cbd5e1"
              textAnchor="middle"
            >
              {plastic.bed}
            </text>
            <text
              x={plastic.x + 26}
              y="124"
              fontSize="10"
              fill="#e2e8f0"
              textAnchor="middle"
            >
              {plastic.property}
            </text>
            <text
              x={plastic.x + 26}
              y="138"
              fontSize="10"
              fill="#94a3b8"
              textAnchor="middle"
            >
              {plastic.use}
            </text>
          </g>
        ))}

        <text x="14" y="166" fontSize="10" fill="#94a3b8">
          ABS и ASA капризны: камера и вентиляция
        </text>
      </svg>
    </VisualWrapper>
  );
}
