import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Пять пластиков из content урока и уровень выбросов у каждого: PLA — минимум,
 * PETG — средне, ABS — много, ASA — много, PC — максимум. Длина столбца и цвет
 * показывают уровень, справа он же написан словом.
 */
const plastics = [
  { name: "PLA", level: "минимум", width: 28, bar: "#22c55e", text: "#86efac" },
  { name: "PETG", level: "средне", width: 58, bar: "#eab308", text: "#fde68a" },
  { name: "ABS", level: "много", width: 104, bar: "#f97316", text: "#fdba74" },
  { name: "ASA", level: "много", width: 104, bar: "#f97316", text: "#fdba74" },
  { name: "PC", level: "максимум", width: 138, bar: "#dc2626", text: "#fca5a5" },
];

/**
 * Сравнение выбросов — горизонтальные столбцы: чем вреднее пластик, тем длиннее
 * столбец и горячее цвет.
 *
 * От таблицы филамента в базовом уроке 2 отличается приёмом: там текстовая
 * таблица про свойства (температуры, камера, гибкость), здесь диаграмма всего про
 * один параметр — выбросы. Такая подача в курсе впервые.
 */
export function ProABezABez1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Диаграмма выбросов по пластикам: PLA — минимум, PETG — средне, ABS и ASA — много, PC — максимум, столбцы растут и краснеют"
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

        <text x="16" y="16" fontSize="10" fill="#e2e8f0">
          UFP + VOC — выбросы при печати
        </text>

        {/* Ось: от неё вправо тянутся столбцы */}
        <line x1="94" y1="26" x2="94" y2="144" stroke="#475569" />

        {plastics.map((plastic, index) => {
          const y = 40 + index * 22;

          return (
            <g key={plastic.name}>
              <text x="86" y={y + 3.5} fontSize="10" fontWeight="bold" fill="#e2e8f0" textAnchor="end">
                {plastic.name}
              </text>
              <rect x="98" y={y - 8} width={plastic.width} height="16" rx="3" fill={plastic.bar} />
              <text x="246" y={y + 3.5} fontSize="10" fill={plastic.text}>
                {plastic.level}
              </text>
            </g>
          );
        })}

        <text x="16" y="162" fontSize="10" fill="#94a3b8">
          длина столбца — уровень выбросов, а не граммы
        </text>
      </svg>
    </VisualWrapper>
  );
}
