import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Панели: стенка 12…150, ручки 154…308, 20…102. */
const PANEL_TOP = 20;
const PANEL_H = 82;
const WALL = { x: 26, y: 44, w: 100, h: 44 };
const LAYER_Y = [52, 60, 84];
const GAP_Y = [64, 76];

const LEAD = "пропуск — остановка подачи: сначала heat creep";
const LEAD_NOTE = "температуру вверх не поднимать — heat creep усилится";
const NOTES = [
  "радиатор обдувается · откат короче · на быстрых +5 °C",
  "тесты: щелчки · подача 100 мм · радиатор не горячий",
];

type Step = { name: string; color: string };

/** Порядок из проблемы 10: радиатор первым, температура — в самом конце. */
const STEPS: Step[] = [
  { name: "1. вентилятор радиатора", color: "#10b981" },
  { name: "2. короче откат", color: "#38bdf8" },
  { name: "3. cold pull и сопло", color: "#f59e0b" },
  { name: "4. катушка без узлов", color: "#94a3b8" },
];

/**
 * Кадр блока 23 урока L7 «Пропуски: где обрывается линия».
 *
 * Слева стенка, на одной высоте слой пропал — дыра-«окно», перед этим слышны
 * щелчки подачи. Справа порядок разбора: первым делом вентилятор радиатора,
 * затем длина отката, прочистка сопла и проверка катушки.
 *
 * Числа — из проблемы 10: пропуск — остановка подачи, самая частая причина
 * heat creep, для быстрых участков температуру поднимают на 5 °C, проверки —
 * щелчки на слух, cold pull, тест подачи 100 мм и рукой по верхнему радиатору:
 * он должен быть тёплым, но не горячим.
 */
export function Basic7Diagram9({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пропуски слоёв и дыры в стенке: на определённой высоте целые участки слоя отсутствуют, в стенке появляется дыра-окно, а перед пропуском слышны щелчки и трещотка подачи. Самая частая причина — heat creep: пластик размягчается выше зоны плавления и заклинивает. Порядок: не поднимать температуру сразу, проверить вентилятор радиатора, сократить длину отката, прочистка сопла методом cold pull, проверка катушки на узлы. Пропуски на быстрых участках лечат скоростью или плюс 5 градусов. Проверки: щелчки на слух, тест подачи 100 мм, радиатор тёплый, но не горячий"
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
          Пропуски: где обрывается линия
        </text>

        {/* Стенка: слой пропал на одной высоте */}
        <rect
          x="12"
          y={PANEL_TOP}
          width="138"
          height={PANEL_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="34" fontSize="10" fill="#94a3b8">
          стенка: слой пропал
        </text>
        <rect
          x={WALL.x}
          y={WALL.y}
          width={WALL.w}
          height={WALL.h}
          fill="#3b82f6"
          fillOpacity="0.18"
          stroke="#3b82f6"
        />
        {LAYER_Y.map((y) => (
          <line
            key={y}
            x1={WALL.x}
            y1={y}
            x2={WALL.x + WALL.w}
            y2={y}
            stroke="#3b82f6"
            strokeOpacity="0.5"
          />
        ))}
        {GAP_Y.map((y) => (
          <line
            key={y}
            x1={WALL.x}
            y1={y}
            x2={WALL.x + WALL.w}
            y2={y}
            stroke="#f87171"
            strokeDasharray="3 2"
          />
        ))}
        <text x="62" y="72" fontSize="10" fill="#f87171">
          дыра-окно
        </text>
        <text x="26" y="96" fontSize="10" fill="#94a3b8">
          щелчки перед пропуском
        </text>

        {/* Порядок разбора */}
        <rect
          x="154"
          y={PANEL_TOP}
          width="154"
          height={PANEL_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="164" y="34" fontSize="10" fill="#94a3b8">
          порядок разбора
        </text>
        {STEPS.map((step, index) => (
          <text
            key={step.name}
            x="164"
            y={50 + index * 14}
            fontSize="10"
            fontWeight={index === 0 ? "700" : "400"}
            fill={step.color}
          >
            {step.name}
          </text>
        ))}

        {/* Сноски: правило, ручки и тесты */}
        <rect
          x="12"
          y="106"
          width="296"
          height="24"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="118" fontSize="10" fontWeight="700" fill="#e2e8f0">
          {LEAD}
        </text>
        <text x="22" y="128" fontSize="10" fill="#94a3b8">
          {LEAD_NOTE}
        </text>
        {NOTES.map((note, index) => (
          <g key={note}>
            <rect
              x="12"
              y={134 + index * 24}
              width="296"
              height={index === 1 ? 18 : 20}
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text x="22" y={147 + index * 24} fontSize="10" fill="#94a3b8">
              {note}
            </text>
          </g>
        ))}

      </svg>
    </VisualWrapper>
  );
}
