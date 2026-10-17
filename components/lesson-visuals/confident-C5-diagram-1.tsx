import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Разрез опоры: деталь 28…40, зазор 40…46, интерфейс 46…68, тело 68…106, стол 106. */
const PART_Y = 28;
const PART_H = 12;
const FACE_TOP = 46;
const FACE_BOTTOM = 68;
const BODY_TOP = 68;
const BODY_BOTTOM = 106;
const DRAW_X = 18;
const DRAW_W = 168;
/** Подписи зон: колонка 196…308, три строки вровень с зонами разреза. */
const LABEL_X = 196;

/** Частая сетка интерфейса и редкая сетка тела — картинка плотности. */
const FACE_COLUMNS = [30, 48, 66, 84, 102, 120, 138, 156, 174];
const BODY_COLUMNS = [30, 66, 102, 138, 174];
const BODY_ROWS = [78, 88, 98];

type Zone = { label: string; note: string; color: string; labelY: number };

/** Три зоны опоры — блоки 11 и 12; значения плотности — 13 и 16. */
const ZONES: Zone[] = [
  { label: "1. Контакт", note: "зазор 0,15–0,2 мм", color: "#f87171", labelY: 40 },
  { label: "2. Интерфейс", note: "40–60 %, 2–4 слоя", color: "#10b981", labelY: 57 },
  { label: "3. Тело опоры", note: "10–15 % плотности", color: "#f59e0b", labelY: 88 },
];

const NOTES = [
  "След оставляет только верхушка — интерфейс",
  "Плотнее интерфейс — глаже низ и труднее снять",
  "Редкое тело держит нависание и экономит пластик",
  "Гладкость не нужна — интерфейс отключают",
];

/**
 * Кадр блока 12 урока C5 «Три зоны поддержки».
 *
 * Разрез из описания кадра `C5_interface.png` и блоков 11, 12, 13, 16: опора
 * снизу вверх делится на три зоны, и у каждой своя задача. Контакт — щель по Z
 * в 0,15–0,2 мм: она решает, снимется ли опора руками (блок 11). Интерфейс — это
 * плотные слои, которые касаются детали: 40–60 % плотности и 2–4 слоя дают
 * гладкий низ, а больше слоёв делают снятие тяжелее (блок 13). Тело опоры —
 * редкая решётка 10–15 %: она держит нависание и экономит пластик (блок 16).
 * Нижние строки — блоки 11 и 13: след от опоры оставляет только верхушка, то
 * есть интерфейс, а если гладкость не нужна, слой интерфейса отключают целиком.
 */
export function ConfidentC5Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три зоны опоры снизу вверх. Контакт: зазор 0,15–0,2 мм решает, снимется ли опора руками. Интерфейс: 40–60 % плотности и 2–4 слоя дают гладкий низ, но больше слоёв делают снятие тяжелее. Тело опоры: редкая решётка 10–15 % держит нависание и экономит пластик. След оставляет только верхушка — интерфейс. Плотнее интерфейс — глаже низ и труднее снять. Редкое тело держит нависание и экономит пластик. Если гладкость не нужна, слой интерфейса отключают"
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
          Опора снизу вверх: три зоны
        </text>

        {/* Деталь над опорой */}
        <rect
          x={DRAW_X}
          y={PART_Y}
          width={DRAW_W}
          height={PART_H}
          rx="2"
          fill="#334155"
          fillOpacity="0.55"
          stroke="#64748b"
        />
        <text x={DRAW_X + 6} y={PART_Y + 9} fontSize="10" fill="#e2e8f0">
          Деталь: нависание
        </text>

        {/* Контакт: щель по Z между деталью и интерфейсом */}
        <line
          x1={DRAW_X}
          y1={PART_Y + PART_H}
          x2={DRAW_X + DRAW_W}
          y2={PART_Y + PART_H}
          stroke="#f87171"
          strokeOpacity="0.7"
          strokeDasharray="3 2"
        />
        <line
          x1={DRAW_X}
          y1={FACE_TOP}
          x2={DRAW_X + DRAW_W}
          y2={FACE_TOP}
          stroke="#f87171"
          strokeOpacity="0.7"
          strokeDasharray="3 2"
        />
        <line
          x1={DRAW_X + DRAW_W + 4}
          y1={PART_Y + PART_H - 1}
          x2={DRAW_X + DRAW_W + 4}
          y2={FACE_TOP + 1}
          stroke="#f87171"
          strokeOpacity="0.8"
        />

        {/* Интерфейс: плотные слои, которые касаются детали */}
        <rect
          x={DRAW_X}
          y={FACE_TOP}
          width={DRAW_W}
          height={FACE_BOTTOM - FACE_TOP}
          fill="#0f172a"
          fillOpacity="0.4"
          stroke="#10b981"
          strokeOpacity="0.55"
        />
        {FACE_COLUMNS.map((x) => (
          <line
            key={x}
            x1={x}
            y1={FACE_TOP + 2}
            x2={x}
            y2={FACE_BOTTOM - 2}
            stroke="#10b981"
            strokeOpacity="0.3"
          />
        ))}
        <text x={DRAW_X + 6} y={FACE_TOP + 11} fontSize="10" fontWeight="700" fill="#10b981">
          Интерфейс
        </text>
        <text x={DRAW_X + 6} y={FACE_TOP + 21} fontSize="10" fill="#cbd5e1">
          40–60 %
        </text>

        {/* Тело опоры: редкая решётка держит нависание */}
        <rect
          x={DRAW_X}
          y={BODY_TOP}
          width={DRAW_W}
          height={BODY_BOTTOM - BODY_TOP}
          fill="#0f172a"
          fillOpacity="0.3"
          stroke="#f59e0b"
          strokeOpacity="0.45"
        />
        {BODY_COLUMNS.map((x) => (
          <line
            key={x}
            x1={x}
            y1={BODY_TOP + 2}
            x2={x}
            y2={BODY_BOTTOM - 2}
            stroke="#f59e0b"
            strokeOpacity="0.24"
          />
        ))}
        {BODY_ROWS.map((y) => (
          <line
            key={y}
            x1={DRAW_X}
            y1={y}
            x2={DRAW_X + DRAW_W}
            y2={y}
            stroke="#f59e0b"
            strokeOpacity="0.16"
          />
        ))}
        <text x={DRAW_X + 6} y={BODY_TOP + 16} fontSize="10" fontWeight="700" fill="#f59e0b">
          Тело опоры
        </text>
        <text x={DRAW_X + 6} y={BODY_TOP + 27} fontSize="10" fill="#cbd5e1">
          10–15 %
        </text>
        <line x1="12" y1={BODY_BOTTOM} x2="186" y2={BODY_BOTTOM} stroke="#475569" />
        <text x="18" y={BODY_BOTTOM + 10} fontSize="10" fill="#64748b">
          стол
        </text>

        {/* Подписи трёх зон вровень с разрезом */}
        {ZONES.map((zone) => (
          <g key={zone.label}>
            <text x={LABEL_X} y={zone.labelY} fontSize="10" fontWeight="700" fill={zone.color}>
              {zone.label}
            </text>
            <text x={LABEL_X} y={zone.labelY + 11} fontSize="10" fill="#94a3b8">
              {zone.note}
            </text>
          </g>
        ))}

        {/* Что даёт каждая зона и когда интерфейс не нужен */}
        {NOTES.map((note, index) => (
          <text key={note} x="12" y={126 + index * 12} fontSize="10" fill="#94a3b8">
            {note}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
