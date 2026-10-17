import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const CASES = [
  {
    name: "кронштейн",
    load: "50 Н",
    orientation: "слои вдоль вылета",
    material: "PETG / PA-CF",
    walls: "4 × 0,45 · 40 %",
    accent: "#fbbf24",
    x: 12,
    y: 22,
  },
  {
    name: "шестерня",
    load: "2 Н·м",
    orientation: "плашмя · ось вверх",
    material: "POM / PA",
    walls: "4 перим. · 60 %",
    accent: "#38bdf8",
    x: 160,
    y: 22,
  },
  {
    name: "вал",
    load: "40 Н·м",
    orientation: "вертикально · вдоль",
    material: "PA-CF / PC",
    walls: "6 перим. · 80 %",
    accent: "#34d399",
    x: 12,
    y: 100,
  },
  {
    name: "корпус",
    load: "8–10 бар",
    orientation: "стоя · ось вверх",
    material: "PETG / PA",
    walls: "6 перим. · сплошное",
    accent: "#60a5fa",
    x: 160,
    y: 100,
  },
];

/**
 * Кадр блока 22 урока IN5 «Кейсы: кронштейн, шестерня, вал, корпус».
 *
 * Макет из описания `IN5_case_table.png`: четыре карточки, в каждой одинаковый
 * порядок строк — нагрузка, ориентация, материал, стенки и заполнение.
 * Карточки 2×2 вместо широкой таблицы: так подписи остаются не мельче 10 px.
 */
export function EngineerIN5Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Таблица четырёх кейсов. Кронштейн: нагрузка 50 ньютонов, слои вдоль вылета, PETG или PA-CF, 4 периметра по 0,45 и 40 процентов. Шестерня: 2 ньютон-метра, плашмя осью вверх, POM или PA, 4 периметра и 60 процентов. Вал: 40 ньютон-метров, вертикально, PA-CF или PC, 6 периметров и 80 процентов. Корпус: 8–10 бар, стоя осью вверх, PETG или PA, 6 периметров и сплошное заполнение"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          четыре кейса: строки идут в одном порядке
        </text>

        {CASES.map((item) => (
          <g key={item.name}>
            <rect
              x={item.x}
              y={item.y}
              width="148"
              height="74"
              rx="7"
              fill="#0f172a"
              fillOpacity="0.45"
              stroke="#334155"
            />
            <rect x={item.x} y={item.y} width="148" height="2.5" rx="1.2" fill={item.accent} fillOpacity="0.8" />
            <text x={item.x + 10} y={item.y + 17} fontSize="10" fontWeight="700" fill={item.accent}>
              {item.name} · {item.load}
            </text>
            <text x={item.x + 10} y={item.y + 33} fontSize="10" fill="#e2e8f0">
              {item.orientation}
            </text>
            <text x={item.x + 10} y={item.y + 49} fontSize="10" fill="#6ee7b7">
              {item.material}
            </text>
            <text x={item.x + 10} y={item.y + 65} fontSize="10" fill="#cbd5e1">
              {item.walls}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
