import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Левая сцена: деталь с поднятыми углами на столе. */
const TABLE_Y = 106;
const PART_PATH = "M30,82 Q91,98 152,82";
const ARROW_X = [26, 156];

/** Правая панель: усадка по материалам, шкала 0–0,8 % на 118 px. */
const SHRINK_PANEL = { x: 166, y: 22, w: 142, h: 102 };
const SHRINK_X = 178;
const SHRINK_W = 118;
const SHRINK_MAX = 0.8;
const SHRINK_TOP = [42, 62, 82, 102];

const NOTES = [
  "кайма 5–8 мм на острые углы, плот при сложной геометрии",
  "проверка: планка 100 × 20 × 5 и квадрат 100 × 100 × 10",
];

type Shrink = { name: string; value: string; from: number; to: number; color: string };

/** Усадка из блока 5: ABS и ASA 0,6–0,8 %, PETG 0,2–0,4 %, PLA 0,2–0,3 %. */
const SHRINKS: Shrink[] = [
  { name: "ABS", value: "0,6–0,8 %", from: 0.6, to: 0.8, color: "#f87171" },
  { name: "ASA", value: "0,6–0,8 %", from: 0.6, to: 0.8, color: "#f87171" },
  { name: "PETG", value: "0,2–0,4 %", from: 0.2, to: 0.4, color: "#f59e0b" },
  { name: "PLA", value: "0,2–0,3 %", from: 0.2, to: 0.3, color: "#10b981" },
];

/**
 * Кадр блока 6 урока L7 «Коробление: где начинается отрыв».
 *
 * Слева разрез: центр детали лежит на столе ровно, а острые углы подняты на
 * 0,5–3 мм, красные стрелки — усадка, которая тянет кромки вверх. Справа шкала
 * усадки по материалам, снизу две сноски с ручками и тестами.
 *
 * Числа — из блока 5: ABS и ASA 0,6–0,8 %, PETG 0,2–0,4 %, PLA 0,2–0,3 %;
 * кайма 5–8 мм, плот, обдув выключен на 3–5 слоёв.
 */
export function Basic7Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Коробление: усадка материала против адгезии. Центр детали лежит на столе ровно, а острые углы и кромки подняты на 0,5–3 мм, под ними виден просвет. Усадка: ABS и ASA 0,6–0,8 процента, PETG 0,2–0,4, PLA 0,2–0,3 процента. Ручки: кайма 5–8 мм на острые углы, плот для сложной геометрии, обдув выключен на первые 3–5 слоёв. Проверка — планка 100 на 20 на 5 и квадрат 100 на 100 на 10"
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
          Коробление: где начинается отрыв
        </text>

        {/* Левая сцена: стол, деталь дугой и поднятые углы */}
        <rect
          x="12"
          y="22"
          width="158"
          height="102"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="20" y="36" fontSize="10" fill="#94a3b8">
          где начинается отрыв
        </text>
        <text x="24" y="58" fontSize="10" fontWeight="700" fill="#f87171">
          углы подняты на 0,5–3 мм
        </text>
        {ARROW_X.map((x) => (
          <g key={x}>
            <line x1={x} y1="86" x2={x} y2="70" stroke="#f87171" />
            <polygon points={`${x},66 ${x - 3},72 ${x + 3},72`} fill="#f87171" />
          </g>
        ))}
        <path d={PART_PATH} fill="none" stroke="#3b82f6" strokeWidth="12" />
        <line x1="20" y1={TABLE_Y} x2="162" y2={TABLE_Y} stroke="#475569" />
        {[30, 54, 78, 102, 126, 150].map((x) => (
          <line
            key={x}
            x1={x}
            y1={TABLE_Y + 2}
            x2={x - 5}
            y2={TABLE_Y + 8}
            stroke="#475569"
          />
        ))}
        <text x="52" y="122" fontSize="10" fill="#10b981">
          центр лежит ровно
        </text>

        {/* Правая панель: усадка по материалам */}
        <rect
          x={SHRINK_PANEL.x}
          y={SHRINK_PANEL.y}
          width={SHRINK_PANEL.w}
          height={SHRINK_PANEL.h}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x={SHRINK_X} y="36" fontSize="10" fill="#94a3b8">
          усадка материала
        </text>
        {SHRINKS.map((shrink, index) => {
          const top = SHRINK_TOP[index];

          return (
            <g key={shrink.name}>
              <text x={SHRINK_X} y={top + 8} fontSize="11" fontWeight="700" fill={shrink.color}>
                {shrink.name}
              </text>
              <text
                x={SHRINK_X + SHRINK_W}
                y={top + 8}
                fontSize="10"
                fill="#94a3b8"
                textAnchor="end"
              >
                {shrink.value}
              </text>
              <rect
                x={SHRINK_X}
                y={top + 12}
                width={SHRINK_W}
                height="6"
                rx="3"
                fill="#334155"
                fillOpacity="0.6"
              />
              <rect
                x={SHRINK_X + (shrink.from / SHRINK_MAX) * SHRINK_W}
                y={top + 12}
                width={((shrink.to - shrink.from) / SHRINK_MAX) * SHRINK_W}
                height="6"
                rx="3"
                fill={shrink.color}
              />
            </g>
          );
        })}

        {/* Сноски: ручки и проверка */}
        {NOTES.map((note, index) => (
          <g key={note}>
            <rect
              x="12"
              y={132 + index * 24}
              width="296"
              height="20"
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text x="22" y={145 + index * 24} fontSize="10" fill="#94a3b8">
              {note}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
