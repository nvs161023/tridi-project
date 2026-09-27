import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Шкала температур из content урока: «PLA 60 °C, PETG 80 °C, ABS 100 °C,
 * ASA 100 °C, PC 120 °C, PA 120 °C, POM 110 °C, PEEK 250 °C» и «PLA размягчается
 * при 60 °C… для подкапотного пространства и духовки нужны материалы на 120–250 °C».
 *
 * Это ПОТОЛОК ЭКСПЛУАТАЦИИ (при какой температуре деталь теряет форму), а не
 * температура печати: печатные режимы уже показаны катушками в E1-1 и таблицей
 * базового урока 2, а шкала 180/210/240 — в базовой анимации про температуру.
 * Поэтому здесь горизонтальная шкала-линейка: ось в градусах, восемь полос-флажков
 * длиной до своей температуры и три зоны применения — быт, техника,
 * промышленность.
 */
const SCALE = { x: 64, perDegree: 0.75, rows: 46, step: 14 };

const ITEMS = [
  { name: "PLA", temp: 60, color: "#22c55e" },
  { name: "PETG", temp: 80, color: "#f59e0b" },
  { name: "ABS", temp: 100, color: "#f97316" },
  { name: "ASA", temp: 100, color: "#fb923c" },
  { name: "POM", temp: 110, color: "#38bdf8" },
  { name: "PC", temp: 120, color: "#60a5fa" },
  { name: "PA", temp: 120, color: "#a78bfa" },
  { name: "PEEK", temp: 250, color: "#f472b6" },
];

/** Подписи шкалы: 0…300 °C с шагом 50. */
const TICKS = [0, 50, 100, 150, 200, 250, 300];

/** «Потолок эксплуатации» — при какой температуре материал теряет форму. */
export function ProE2E22Image0({ title, animated }: VisualProps) {
  const x = (temp: number) => SCALE.x + temp * SCALE.perDegree;

  return (
    <VisualWrapper
      title={title}
      ariaLabel="Шкала эксплуатационных температур: PLA теряет форму при 60 градусах, PETG при 80, ABS и ASA при 100, POM при 110, PC и PA при 120, PEEK при 250 — зоны применения быт, техника и промышленность отмечены на шкале"
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
          потолок эксплуатации, °C: где деталь держит форму
        </text>

        {/* Три зоны применения */}
        <line x1={x(100)} y1="36" x2={x(100)} y2="150" stroke="#475569" />
        <line x1={x(150)} y1="36" x2={x(150)} y2="150" stroke="#475569" />
        <text x={(SCALE.x + x(100)) / 2} y="30" fontSize="8" fill="#94a3b8" textAnchor="middle">
          быт
        </text>
        <text x={(x(100) + x(150)) / 2} y="30" fontSize="8" fill="#94a3b8" textAnchor="middle">
          техника
        </text>
        <text x={(x(150) + x(300)) / 2} y="30" fontSize="8" fill="#94a3b8" textAnchor="middle">
          промышленность
        </text>

        {/* Ось и засечки в градусах */}
        <line x1={SCALE.x} y1="36" x2={SCALE.x} y2="150" stroke="#64748b" />
        {TICKS.map((tick) => (
          <line key={`tick-${tick}`} x1={x(tick)} y1="150" x2={x(tick)} y2="155" stroke="#475569" />
        ))}
        {TICKS.map((tick, index) => (
          <text
            key={`label-${tick}`}
            x={x(tick)}
            y="165"
            fontSize="8"
            fill="#94a3b8"
            textAnchor="middle"
          >
            {index === TICKS.length - 1 ? `${tick} °C` : tick}
          </text>
        ))}

        {/* Восемь материалов: длина полосы — температура потери формы */}
        {ITEMS.map((item, index) => {
          const rowY = SCALE.rows + index * SCALE.step;
          const width = item.temp * SCALE.perDegree;

          return (
            <g key={item.name}>
              <rect
                x={SCALE.x}
                y={rowY - 3}
                width={width}
                height="6"
                rx="3"
                fill={item.color}
                fillOpacity="0.75"
              />
              <text x="12" y={rowY + 3} fontSize="8.5" fill="#e2e8f0">
                {item.name}
              </text>
              <text x="48" y={rowY + 3} fontSize="8" fill="#94a3b8">
                {item.temp}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
