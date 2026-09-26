import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Виды пластика — таблица из пяти строк.
 *
 * Все значения взяты из блока «Основные виды» того же урока: PLA боится 60 °C,
 * PETG 230–240 °C, ABS требует камеры, TPU гибкий и печатается медленно, ASA для
 * улицы. Там, где урок не даёт температуры, колонка пустая — придумывать числа
 * нельзя.
 *
 * Композиция: «терминал» из строк с цветной меткой вида, а не карточки и не
 * панели, — так этот блок не спутать с блоком «Сайты» из урока 11.
 */
export function Basic2Image0({ title, animated }: VisualProps) {
  const rows: { name: string; property: string; temp: string; color: string }[] = [
    {
      name: "PLA",
      property: "простой, безопасный",
      temp: "боится 60 °C",
      color: "#3b82f6",
    },
    {
      name: "PETG",
      property: "прочнее, термостойкий",
      temp: "230–240 °C",
      color: "#f59e0b",
    },
    {
      name: "ABS",
      property: "крепкий, но капризный",
      temp: "нужна камера",
      color: "#ef4444",
    },
    {
      name: "TPU",
      property: "гибкий, как резинка",
      temp: "медленно",
      color: "#94a3b8",
    },
    {
      name: "ASA",
      property: "как ABS",
      temp: "для улицы",
      color: "#94a3b8",
    },
  ];

  return (
    <VisualWrapper
      title={title}
      ariaLabel="Таблица пяти видов филамента со свойствами из урока: PLA боится 60 °C, PETG прочный и термостойкий 230–240 °C, ABS требует камеры, TPU гибкий и печатается медленно, ASA для улицы"
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

        {/* Шапка колонок */}
        <text x="42" y="14" fontSize="10" fill="#64748b" dominantBaseline="middle">
          вид
        </text>
        <text
          x="210"
          y="14"
          fontSize="10"
          fill="#64748b"
          textAnchor="end"
          dominantBaseline="middle"
        >
          свойства
        </text>
        <text
          x="298"
          y="14"
          fontSize="10"
          fill="#64748b"
          textAnchor="end"
          dominantBaseline="middle"
        >
          главное
        </text>

        {rows.map((row, index) => {
          const top = 20 + index * 28;

          return (
            <g key={row.name}>
              <rect
                x="14"
                y={top}
                width="292"
                height="24"
                rx="6"
                fill="#0f172a"
                fillOpacity="0.6"
                stroke="#334155"
              />
              <rect x="24" y={top + 7} width="10" height="10" rx="2" fill={row.color} />
              <text
                x="42"
                y={top + 12}
                fontSize="11"
                fontWeight="600"
                fill="#e2e8f0"
                dominantBaseline="middle"
              >
                {row.name}
              </text>
              <text
                x="210"
                y={top + 12}
                fontSize="10"
                fill="#94a3b8"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {row.property}
              </text>
              <text
                x="298"
                y={top + 12}
                fontSize="10"
                fill={row.color}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {row.temp}
              </text>
            </g>
          );
        })}

        <text x="14" y="170" fontSize="10" fill="#94a3b8" dominantBaseline="middle">
          Начни с PLA: прощает ошибки, закрытая камера не нужна
        </text>
      </svg>
    </VisualWrapper>
  );
}
