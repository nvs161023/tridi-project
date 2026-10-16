import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Башня со ступенькой: низ 84…130, верх сдвинут вправо на 10 px. */
const LOWER = { x: 20, y: 84, w: 36, h: 46 };
const UPPER = { x: 30, y: 38, w: 36, h: 46 };
const TABLE_Y = 130;

/** Порядок разбора справа: четыре строки по 24 px. */
const ROW_X = 170;
const ROW_TOP = 36;
const ROW_H = 24;

const NOTES = [
  "тест: башня ускорений 1000 → 5000 мм/с²",
  "сдвиг с конкретного уровня — потолок механики",
];

type Fix = { name: string; detail: string; color: string };

/** Порядок из блока 7: ремни, ускорения, помеха соплу и только потом электрика. */
const FIXES: Fix[] = [
  { name: "Ремни и шкив", detail: "люфт и проворот шкива", color: "#3b82f6" },
  { name: "Ускорения и jerk", detail: "снизить на 20–30 %", color: "#38bdf8" },
  { name: "Помеха соплу", detail: "z-hop 0,2–0,4 мм, обход", color: "#f59e0b" },
  { name: "Электрика", detail: "ток драйверов и плата", color: "#94a3b8" },
];

/**
 * Кадр блока 8 урока L7 «Сдвиг слоёв: ступенька по высоте».
 *
 * Слева башня со ступенькой: с какого-то уровня геометрия уходит в сторону на
 * 0,3–2 мм, а выше снова идёт ровно. Справа порядок разбора: сначала ремни и
 * шкив, потом ускорения и jerk, затем помеха соплу, и в самом конце электрика.
 *
 * Числа — из блока 7: смещение 0,3–2 мм, ускорения снижают на 20–30 %, подъём
 * по Z 0,2–0,4 мм, тест «башня ускорений» от 1000 до 5000 мм/с².
 */
export function Basic7Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сдвиг слоёв: с определённого уровня вся геометрия уезжает в одну сторону ступенькой на 0,3–2 мм, а выше снова идёт ровно. Порядок разбора: сначала ремни и шкив, потом ускорения и jerk — снизить на 20–30 процентов, затем помеха соплу с подъёмом по Z 0,2–0,4 мм, и только последней электрика. Тест — башня ускорений от 1000 до 5000 миллиметров в секунду в квадрате"
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
          Сдвиг слоёв: ступенька по высоте
        </text>

        {/* Башня: нижняя часть на столе, верхняя уехала в сторону */}
        <rect
          x={LOWER.x}
          y={LOWER.y}
          width={LOWER.w}
          height={LOWER.h}
          fill="#3b82f6"
          fillOpacity="0.25"
          stroke="#3b82f6"
        />
        <rect
          x={UPPER.x}
          y={UPPER.y}
          width={UPPER.w}
          height={UPPER.h}
          fill="#3b82f6"
          fillOpacity="0.25"
          stroke="#3b82f6"
        />
        <line x1="12" y1={TABLE_Y} x2="64" y2={TABLE_Y} stroke="#475569" />
        {[22, 40, 58].map((x) => (
          <line key={x} x1={x} y1={TABLE_Y + 2} x2={x - 5} y2={TABLE_Y + 8} stroke="#475569" />
        ))}

        {/* Ступенька и её размер */}
        <line x1="44" y1="95" x2="58" y2="95" stroke="#f87171" />
        <polygon points="62,95 54,92 54,98" fill="#f87171" />
        <text x="80" y="80" fontSize="11" fontWeight="700" fill="#f87171">
          ступенька
        </text>
        <text x="80" y="92" fontSize="10" fill="#94a3b8">
          0,3–2 мм
        </text>
        <text x="80" y="106" fontSize="10" fill="#94a3b8">
          выше снова ровно
        </text>

        {/* Порядок разбора справа */}
        <text x={ROW_X} y="26" fontSize="10" fill="#94a3b8">
          порядок разбора
        </text>
        {FIXES.map((fix, index) => {
          const top = ROW_TOP + index * ROW_H;

          return (
            <g key={fix.name}>
              <rect x={ROW_X - 6} y={top - 4} width="2" height="22" rx="1" fill={fix.color} />
              <text x={ROW_X} y={top + 8} fontSize="11" fontWeight="700" fill={fix.color}>
                {fix.name}
              </text>
              <text x={ROW_X} y={top + 19} fontSize="10" fill="#94a3b8">
                {fix.detail}
              </text>
            </g>
          );
        })}

        {/* Сноски: тест и что он показывает */}
        {NOTES.map((note, index) => (
          <g key={note}>
            <rect
              x="12"
              y={138 + index * 22}
              width="296"
              height="18"
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text x="22" y={151 + index * 22} fontSize="10" fill="#94a3b8">
              {note}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
