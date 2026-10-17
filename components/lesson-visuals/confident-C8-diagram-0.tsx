import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Передняя грань детали: 26…100 по X, 56…124 по Y, слои через 6 px. */
const FACE = { x: 26, y: 56, w: 74, h: 68 };
/** Верхняя площадка — параллелограмм со сдвигом 22 px вправо и 16 px вверх. */
const TOP = { dx: 22, dy: 16 };
/** Шов — вертикаль по передней грани. */
const SEAM_X = 62;
/** Колонка подписей: значок 176, текст 188, три строки через 27. */
const ROW_TOP = 62;
const ROW_STEP = 27;
const BADGE_X = 176;
const TEXT_X = 188;

type Zone = { name: string; note: string; color: string };

/** Три зоны поверхности и ручка каждой — блок 3. */
const ZONES: Zone[] = [
  { name: "стенка", note: "контур и текстура", color: "#10b981" },
  { name: "верх", note: "ironing и поток", color: "#60a5fa" },
  { name: "шов", note: "режим и точка", color: "#f59e0b" },
];

/** Метки на детали: стенка, верх и шов — в том же порядке, что и подписи. */
const MARKS = [
  { x: 40, y: 92 },
  { x: 88, y: 48 },
  { x: SEAM_X, y: 112 },
];

/** Слои на передней грани: 56 + 6 … 122. */
const LAYERS = Array.from({ length: 11 }, (_, index) => FACE.y + 6 + index * 6);

/**
 * Кадр блока 4 урока C8 «Три зоны поверхности».
 *
 * Три поверхности из описания кадра `C8_surface_zones.png` и блока 3: боковая
 * стенка со ступеньками слоёв, верхняя площадка и вертикальный шов. У каждой
 * зоны своя ручка — у стенки контур и текстура, у верха ironing и поток, у шва
 * режим и точка старта. Нижние строки — правило того же блока: одна зона — одна
 * ручка за раз, а тонкий слой даёт ровную стенку.
 */
export function ConfidentC8Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три зоны поверхности детали: боковая стенка со ступеньками слоёв, верхняя площадка и вертикальный шов. У каждой зоны своя ручка: у стенки контур и текстура, у верха ironing и поток, у шва режим и точка старта. Одна зона — одна ручка за раз. Тонкий слой даёт ровную стенку, крупный — полосы. Глянец показывает каждую ступеньку, мат скрывает часть"
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
          три зоны одной детали
        </text>

        {/* Деталь: передняя грань со слоями и верхняя площадка */}
        <rect
          x={FACE.x}
          y={FACE.y}
          width={FACE.w}
          height={FACE.h}
          fill="#334155"
          fillOpacity="0.65"
          stroke="#64748b"
        />
        {LAYERS.map((y) => (
          <line
            key={y}
            x1={FACE.x}
            y1={y}
            x2={FACE.x + FACE.w}
            y2={y}
            stroke="#94a3b8"
            strokeOpacity="0.18"
          />
        ))}
        <polygon
          points={`${FACE.x},${FACE.y} ${FACE.x + TOP.dx},${FACE.y - TOP.dy} ${
            FACE.x + FACE.w + TOP.dx
          },${FACE.y - TOP.dy} ${FACE.x + FACE.w},${FACE.y}`}
          fill="#60a5fa"
          fillOpacity="0.2"
          stroke="#60a5fa"
        />

        {/* Шов от низа до верха детали */}
        <line
          x1={SEAM_X}
          y1={FACE.y}
          x2={SEAM_X}
          y2={FACE.y + FACE.h}
          stroke="#f59e0b"
          strokeWidth="1.6"
          strokeDasharray="4 3"
        />

        {/* Метки зон */}
        {MARKS.map((mark, index) => {
          const zone = ZONES[index];
          return (
            <g key={zone.name}>
              <circle
                cx={mark.x}
                cy={mark.y}
                r="5.5"
                fill="#1e293b"
                fillOpacity="0.9"
                stroke={zone.color}
              />
              <text
                x={mark.x}
                y={mark.y + 3.5}
                fontSize="10"
                fontWeight="700"
                fill={zone.color}
                textAnchor="middle"
              >
                {index + 1}
              </text>
            </g>
          );
        })}

        {/* Ручка каждой зоны */}
        {ZONES.map((zone, index) => {
          const y = ROW_TOP + index * ROW_STEP;
          return (
            <g key={zone.name}>
              <circle cx={BADGE_X} cy={y - 3.5} r="5.5" fill="none" stroke={zone.color} />
              <text
                x={BADGE_X}
                y={y}
                fontSize="10"
                fontWeight="700"
                fill={zone.color}
                textAnchor="middle"
              >
                {index + 1}
              </text>
              <text x={TEXT_X} y={y} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {zone.name}
              </text>
              <text x={TEXT_X} y={y + 12} fontSize="10" fill="#94a3b8">
                {zone.note}
              </text>
            </g>
          );
        })}

        <text x="12" y="142" fontSize="10" fill="#94a3b8">
          тонкий слой — ровная стенка, крупный — полосы
        </text>
        <text x="12" y="158" fontSize="10" fontWeight="700" fill="#e2e8f0">
          Одна зона — одна ручка за раз
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          Глянец показывает ступеньки, мат скрывает часть
        </text>
      </svg>
    </VisualWrapper>
  );
}
