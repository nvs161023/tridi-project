import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Корпус хотэнда: 24…74 по X, 24…146 по Y. */
const BODY_X = 24;
const BODY_W = 50;
const BODY_TOP = 24;
const BODY_BOTTOM = 146;

/** Радиатор холодной стороны — четыре ребра по 4 px. */
const FINS = [30, 38, 46, 54];
const FIN_X = 30;
const FIN_W = 38;
const FIN_H = 4;

/** Нагревательный блок 70…116, сопло ниже — до 142. */
const BLOCK_TOP = 70;
const BLOCK_BOTTOM = 116;
const NOZZLE_BOTTOM = 142;
const FILAMENT_X = 45;
const FILAMENT_W = 8;

/** Подписи разреза справа от корпуса, материалы — в правой колонке. */
const LABEL_X = 82;
const MATERIAL_X = 200;
const MATERIAL_ROWS = [40, 70, 100];
const MATERIAL_NAME_Y = 14;
const MATERIAL_VALUE_Y = 26;

/** Сноска под кадром: формула потока и вывод про узкое место. */
const NOTE_TOP = 151;
const NOTE_H = 25;

type Material = { name: string; value: string; color: string };

/**
 * Потолки материалов — из блока 4: PLA 10–15 мм³/с, PETG 8–10, TPU 2–4. Разница
 * в четыре раза при одном и том же железе: теплопроводность и вязкость разные.
 */
const MATERIALS: Material[] = [
  { name: "PLA", value: "10–15 мм³/с", color: "#3b82f6" },
  { name: "PETG", value: "8–10 мм³/с", color: "#10b981" },
  { name: "TPU", value: "2–4 мм³/с", color: "#f59e0b" },
];

/** Стрелки тепла в блоке: блок отдаёт тепло, расплав уносит его с собой. */
const HEAT_LINES = [
  { x1: 30, x2: 43, y: 88, tip: "right" },
  { x1: 68, x2: 55, y: 88, tip: "left" },
  { x1: 30, x2: 43, y: 100, tip: "right" },
  { x1: 68, x2: 55, y: 100, tip: "left" },
];

/**
 * Кадр блока 5 урока L6 «Зона расплава: где рождается предел скорости».
 *
 * Слева разрез хотэнда сверху вниз: холодная сторона с ребрами радиатора, где
 * ещё твёрдая нить 1,75 мм, нагревательный блок с расплавом и сопло 0,4 мм.
 * Стрелки в блоке — тепло в секунду; уходящий расплав уносит его с собой.
 * Справа потолки материалов из блока 4, снизу формула потока и вывод: мотор
 * экструдера мог бы подать вдесятеро больше, но узкое место — нагрев.
 */
export function Basic6Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Разрез хотэнда: сверху холодная сторона с ребрами радиатора и твёрдая нить 1,75 мм, ниже нагревательный блок с расплавом, ещё ниже сопло 0,4 мм. Мотор экструдера мог бы подать вдесятеро больше пластика, но узкое место — нагрев. Потолки материалов при сопле 0,4 мм: PLA 10–15 кубических миллиметров в секунду, PETG 8–10, TPU 2–4. Объёмный поток равен скорости, умноженной на ширину линии и на высоту слоя"
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
          Зона расплава: где рождается предел
        </text>

        {/* Разрез хотэнда */}
        <rect
          x={BODY_X}
          y={BODY_TOP}
          width={BODY_W}
          height={BODY_BOTTOM - BODY_TOP}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
        />

        {/* Ребра радиатора — холодная сторона */}
        {FINS.map((y) => (
          <rect key={y} x={FIN_X} y={y} width={FIN_W} height={FIN_H} rx="1" fill="#64748b" />
        ))}

        {/* Нагревательный блок */}
        <rect
          x={BODY_X + 4}
          y={BLOCK_TOP}
          width={BODY_W - 8}
          height={BLOCK_BOTTOM - BLOCK_TOP}
          rx="4"
          fill="#f59e0b"
          fillOpacity="0.18"
          stroke="#f59e0b"
          strokeOpacity="0.7"
        />

        {/* Нить: сверху ещё твёрдая, в блоке уже расплав */}
        <rect
          x={FILAMENT_X}
          y={BODY_TOP + 2}
          width={FILAMENT_W}
          height={BLOCK_TOP - BODY_TOP - 2}
          fill="#94a3b8"
        />
        <rect
          x={FILAMENT_X}
          y={BLOCK_TOP}
          width={FILAMENT_W}
          height={BLOCK_BOTTOM - BLOCK_TOP}
          fill="#f59e0b"
          fillOpacity="0.85"
        />

        {/* Сопло 0,4 мм и выходящий расплав */}
        <polygon points="36,116 62,116 55,142 43,142" fill="#475569" stroke="#64748b" />
        <rect
          x="46"
          y={BLOCK_BOTTOM}
          width="6"
          height={NOZZLE_BOTTOM - BLOCK_BOTTOM}
          fill="#f59e0b"
          fillOpacity="0.9"
        />

        {/* Тепло в блоке: стрелки в расплав */}
        {HEAT_LINES.map((line) => (
          <g key={`${line.x1}-${line.y}-${line.tip}`}>
            <line
              x1={line.x1}
              y1={line.y}
              x2={line.x2}
              y2={line.y}
              stroke="#f59e0b"
              strokeWidth="1.2"
            />
            <polygon
              points={
                line.tip === "right"
                  ? `${line.x2 + 1},${line.y} ${line.x2 - 3},${line.y - 2.5} ${line.x2 - 3},${line.y + 2.5}`
                  : `${line.x2 - 1},${line.y} ${line.x2 + 3},${line.y - 2.5} ${line.x2 + 3},${line.y + 2.5}`
              }
              fill="#f59e0b"
            />
          </g>
        ))}

        {/* Подписи разреза: три зоны по пути нити (блок 4) */}
        <text x={LABEL_X} y="38" fontSize="10" fill="#94a3b8">
          холодная сторона
        </text>
        <text x={LABEL_X} y="48" fontSize="10" fill="#94a3b8">
          нить 1,75 мм
        </text>
        <text x={LABEL_X} y="86" fontSize="10" fontWeight="700" fill="#f59e0b">
          зона плавления
        </text>
        <text x={LABEL_X} y="96" fontSize="10" fill="#94a3b8">
          тут предел скорости
        </text>
        <text x={LABEL_X} y="128" fontSize="10" fill="#94a3b8">
          сопло 0,4 мм
        </text>
        <text x={LABEL_X} y="138" fontSize="10" fill="#94a3b8">
          выход потока
        </text>

        {/* Потолки материалов при сопле 0,4 мм (блок 4) */}
        {MATERIALS.map((material, index) => {
          const top = MATERIAL_ROWS[index];

          return (
            <g key={material.name}>
              <text
                x={MATERIAL_X}
                y={top + MATERIAL_NAME_Y}
                fontSize="12"
                fontWeight="700"
                fill={material.color}
              >
                {material.name}
              </text>
              <text x={MATERIAL_X} y={top + MATERIAL_VALUE_Y} fontSize="10" fill="#94a3b8">
                {material.value}
              </text>
            </g>
          );
        })}
        <text x={MATERIAL_X} y="140" fontSize="10" fill="#94a3b8">
          узкое место — нагрев
        </text>

        {/* Сноска: формула потока и вывод про мотор */}
        <rect
          x="12"
          y={NOTE_TOP}
          width="296"
          height={NOTE_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="161" fontSize="10" fill="#e2e8f0">
          поток = скорость × ширина линии × высота слоя
        </text>
        <text x="22" y="172" fontSize="10" fill="#94a3b8">
          мотор мог бы подать вдесятеро, но узкое место — нагрев
        </text>
      </svg>
    </VisualWrapper>
  );
}
