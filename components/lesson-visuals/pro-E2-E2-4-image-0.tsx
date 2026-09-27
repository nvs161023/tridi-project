import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Совместимость из content урока: «Таблица: материал × материал. Зелёный —
 * склеивается, жёлтый — с подготовкой, красный — нельзя», список «PLA + PLA —
 * отлично, суперклей», «PETG + PETG — эпоксидка», «ABS + ABS — ацетон»,
 * «PLA + PETG — плохо, эпоксидка», «PLA + ABS — плохо», «TPU + TPU — клей для
 * резины» и «PETG + TPU — разные температуры».
 *
 * Форма — симметричная матрица 6×6 с заполненным верхним треугольником и
 * диагональю: не плитки с миниатюрами (базовый урок 10, атлас I4) и не строки
 * свойств (базовый урок 2). Заливка стоит только у пар, которые урок разбирает;
 * контурная ячейка — пара, которой в уроке нет, придумывать данные нельзя.
 * Внизу — клей по материалу из подсказок урока.
 */
const MATERIALS = ["PLA", "PETG", "ABS", "TPU", "PA", "POM"];

const CELL = { x: 70, y: 48, size: 14, step: 16 };

const COLORS = { ok: "#34d399", prep: "#fbbf24", no: "#f87171" } as const;

/** Пары, которые разбирает урок (индексы по MATERIALS). */
const LINKS: { a: number; b: number; status: keyof typeof COLORS }[] = [
  { a: 0, b: 0, status: "ok" },
  { a: 1, b: 1, status: "ok" },
  { a: 2, b: 2, status: "ok" },
  { a: 3, b: 3, status: "ok" },
  { a: 0, b: 1, status: "prep" },
  { a: 0, b: 2, status: "no" },
  { a: 1, b: 3, status: "no" },
];

function linkAt(row: number, column: number) {
  const a = Math.min(row, column);
  const b = Math.max(row, column);
  return LINKS.find((link) => link.a === a && link.b === b);
}

const LEGEND = [
  { y: 48, color: COLORS.ok, text: "склеивается" },
  { y: 72, color: COLORS.prep, text: "с подготовкой" },
  { y: 96, color: COLORS.no, text: "нельзя" },
];

/** «Матрица совместимости» — что с чем склеивается и какой клей нужен. */
export function ProE2E24Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Матрица совместимости материалов шесть на шесть: на диагонали PLA, PETG, ABS и TPU склеиваются сами с собой, PLA с PETG — с подготовкой и эпоксидкой, PLA с ABS и PETG с TPU — нельзя; контурная ячейка означает пару, которой в уроке нет, внизу клей по материалу"
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

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          совместимость материалов: склейка деталей
        </text>
        {/* Названия материалов: столбцы сверху, строки слева */}
        {MATERIALS.map((name, index) => (
          <text
            key={`column-${name}`}
            x={CELL.x + CELL.size / 2 + index * CELL.step}
            y="38"
            fontSize="7"
            fill="#e2e8f0"
            textAnchor="middle"
          >
            {name}
          </text>
        ))}
        {MATERIALS.map((name, index) => (
          <text
            key={`row-${name}`}
            x={CELL.x - 6}
            y={CELL.y + CELL.size / 2 + index * CELL.step + 2.5}
            fontSize="7"
            fill="#e2e8f0"
            textAnchor="end"
          >
            {name}
          </text>
        ))}

        {/* Верхний треугольник с диагональю: только разобранные пары закрашены */}
        {MATERIALS.map((columnName, column) =>
          MATERIALS.map((rowName, row) => {
            if (column < row) return null;

            const link = linkAt(row, column);
            const x = CELL.x + column * CELL.step;
            const y = CELL.y + row * CELL.step;

            return (
              <rect
                key={`cell-${rowName}-${columnName}`}
                x={x}
                y={y}
                width={CELL.size}
                height={CELL.size}
                rx="2"
                fill={link ? COLORS[link.status] : "none"}
                fillOpacity={link ? 0.85 : undefined}
                stroke={link ? COLORS[link.status] : "#475569"}
              />
            );
          }),
        )}

        {/* Легенда: три состояния и контур для пар вне урока */}
        {LEGEND.map((item) => (
          <g key={`legend-${item.text}`}>
            <rect
              x="182"
              y={item.y}
              width="10"
              height="10"
              rx="2"
              fill={item.color}
              fillOpacity="0.85"
              stroke={item.color}
            />
            <text x="198" y={item.y + 9} fontSize="8" fill="#e2e8f0">
              {item.text}
            </text>
          </g>
        ))}
        <rect x="182" y="120" width="10" height="10" rx="2" fill="none" stroke="#475569" />
        <text x="198" y="129" fontSize="8" fill="#94a3b8">
          не разбирается в уроке
        </text>

        <text x="12" y="158" fontSize="7.5" fill="#94a3b8">
          клей: PLA — суперклей · PETG — эпоксидка
        </text>
        <text x="12" y="172" fontSize="7.5" fill="#94a3b8">
          ABS — ацетон · TPU — клей для резины
        </text>
      </svg>
    </VisualWrapper>
  );
}
