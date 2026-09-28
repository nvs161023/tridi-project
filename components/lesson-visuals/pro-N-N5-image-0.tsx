import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Таблица параметров: имя строки слева, значение справа, шаг 21 px. */
const PARAMS = [
  { y: 50, name: "диаметр", value: "10 мм", valueX: 69.4 },
  { y: 71, name: "длина", value: "40 мм", valueX: 69.4 },
  { y: 92, name: "толщина", value: "3 мм", valueX: 73.5 },
];

/** Разделители строк таблицы — посередине между подписями. */
const ROWS = [60.5, 81.5];

/** Выноски: от каждой строки таблицы к своему элементу модели. */
const LEADERS = ["96,50 110,50 134,56", "96,71 126,71", "96,92 110,92 130,83"];

/** Два состояния одной детали: то же место кадра, разный диаметр. */
const STATES = [
  { label: "10 мм", rx: 20, top: 62, bottom: 86, labelY: 48 },
  { label: "12 мм", rx: 24, top: 118, bottom: 142, labelY: 104 },
];

/** Деталь-втулка: корпус, торец и расточка — три элемента для трёх параметров. */
const PART = { left: 126, right: 174, top: 56, bottom: 100, boreLeft: 134, boreRight: 166 };

/**
 * Центрирование подписи: ширина символа ≈ 0.55em — та же оценка, что и в проверке
 * читаемости, поэтому вылет строки виден сразу и на глаз, и в отчёте проверки.
 */
function centerX(cx: number, text: string, size: number): number {
  return Math.round((cx - (text.length * size * 0.55) / 2) * 10) / 10;
}

/**
 * Параметризация — связь «параметр ↔ модель», а не шкала времени: слева таблица
 * из трёх параметров, от каждой строки выноска идёт к своему элементу втулки —
 * диаметр к расточке, длина к корпусу, толщина к стенке; справа два состояния
 * одной детали, 10 мм и 12 мм, и подпись «модель обновляется».
 *
 * Ровно по content урока: «В CAD добавляют параметры: диаметр, длина, толщина.
 * Меняешь параметр — модель обновляется» и по image: «параметр «диаметр = 10 мм».
 * Меняешь на 12 — модель обновляется».
 *
 * От K-K1-image-0 (пять способов вокруг детали) и L-L3-animation-0 (четыре стадии
 * по времени) отличается тем, что ни времени, ни стадий в кадре нет: есть таблица
 * чисел и две геометрии, между которыми меняется ровно одно число.
 */
export function ProNN5Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Параметризация: слева таблица параметров — диаметр 10 мм, длина 40 мм, толщина 3 мм; от каждой строки выноска к своему элементу втулки: диаметр к расточке, длина к корпусу, толщина к стенке; справа две детали, 10 мм и 12 мм, с подписью — модель обновляется"
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
          Параметр → модель
        </text>
        <text x="12" y="29" fontSize="7.5" fill="#94a3b8">
          меняешь параметр — модель обновляется
        </text>

        {/* Таблица параметров */}
        <rect x="12" y="40" width="84" height="64" rx="6" fill="#1e293b" stroke="#475569" />
        {ROWS.map((y) => (
          <line key={`row-${y}`} x1="12" y1={y} x2="96" y2={y} stroke="#334155" />
        ))}
        {PARAMS.map((row) => (
          <g key={`param-${row.name}`}>
            <text x="18" y={row.y} fontSize="7.5" fill="#94a3b8">
              {row.name}
            </text>
            <text x={row.valueX} y={row.y} fontSize="7.5" fill="#e2e8f0">
              {row.value}
            </text>
          </g>
        ))}

        {/* Выноски от параметров к элементам модели */}
        {LEADERS.map((points) => (
          <polyline
            key={`lead-${points}`}
            points={points}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="0.8"
          />
        ))}

        {/* Втулка: корпус, торцы и расточка — к ним ведут выноски */}
        <path
          d={`M ${PART.left},${PART.top} L ${PART.right},${PART.top} L ${PART.right},${PART.bottom} L ${PART.left},${PART.bottom} Z`}
          fill="#475569"
          fillOpacity="0.85"
          stroke="#94a3b8"
        />
        <ellipse cx="150" cy={PART.top} rx="24" ry="7" fill="#64748b" stroke="#94a3b8" />
        <ellipse cx="150" cy={PART.bottom} rx="24" ry="7" fill="#475569" stroke="#94a3b8" />
        <ellipse cx="150" cy={PART.top} rx="16" ry="4.5" fill="#0f172a" stroke="#38bdf8" />
        {[PART.boreLeft, PART.boreRight].map((x) => (
          <line
            key={`bore-${x}`}
            x1={x}
            y1={PART.top}
            x2={x}
            y2={PART.bottom}
            stroke="#38bdf8"
            strokeDasharray="3 3"
          />
        ))}

        {/* Два состояния: то же место кадра, другое число */}
        {STATES.map((state) => (
          <g key={`state-${state.label}`}>
            <text x={centerX(248, state.label, 7.5)} y={state.labelY} fontSize="7.5" fill="#e2e8f0">
              {state.label}
            </text>
            <path
              d={`M ${248 - state.rx},${state.top} L ${248 + state.rx},${state.top} L ${248 + state.rx},${state.bottom} L ${248 - state.rx},${state.bottom} Z`}
              fill="#475569"
              fillOpacity="0.85"
              stroke="#94a3b8"
            />
            <ellipse cx="248" cy={state.top} rx={state.rx} ry="5.5" fill="#64748b" stroke="#94a3b8" />
            <ellipse
              cx="248"
              cy={state.bottom}
              rx={state.rx}
              ry="5.5"
              fill="#475569"
              stroke="#94a3b8"
            />
          </g>
        ))}

        {/* Обновление модели: изменился только диаметр */}
        <line x1="290" y1="94" x2="290" y2="104" stroke="#34d399" strokeWidth="1.2" />
        <polygon points="286,103 290,109 294,103" fill="#34d399" />
        <text x={centerX(256, "модель обновляется", 7.5)} y="162" fontSize="7.5" fill="#94a3b8">
          модель обновляется
        </text>
      </svg>
    </VisualWrapper>
  );
}
