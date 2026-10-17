import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две панели стенки: 140 px шириной, зазор 16. */
const PANELS = [12, 168];
const PANEL_W = 140;
const WALL_Y = 36;
const WALL_H = 74;
/** Внутренний угол стенки — центр затухающих дуг. */
const CORNER = { dx: 12, dy: 10 };

/** Четверть окружности от правой точки к нижней: дуга уходит внутрь панели. */
function arc(cx: number, cy: number, radius: number) {
  return `M${cx + radius} ${cy} A${radius} ${radius} 0 0 1 ${cx} ${cy + radius}`;
}

/** Радиусы гребней: шаг около 8 px, к середине стенки затухают. */
const RINGS = [10, 18, 26, 34].map((radius, index) => ({
  radius,
  opacity: 0.65 - index * 0.14,
}));

/**
 * Кадр блока 23 урока C9 «Звон у угла и чистая стенка».
 *
 * Макет из описания кадра `C9_ringing.png`: одна и та же стенка с углом. Слева
 * от угла расходятся гребни звона с ровным шагом, справа после Input Shaper
 * стенка чистая. Блок 22 объясняет причину: каретка догоняет сама себя, а шаг
 * между гребнями связан с частотой колебаний рамы — у X и Y она своя.
 */
export function ConfidentC9Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Стенка с углом до и после Input Shaper. Слева от угла расходятся гребни звона с шагом около 1,2 мм, к середине стенки они затухают. Справа стенка ровная: шейпер гасит волну опережающими импульсами. Звон живёт у угла, а частоты X и Y у принтера разные — это норма"
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
          звон у угла и чистая стенка
        </text>

        <text x="12" y="30" fontSize="10" fontWeight="700" fill="#f87171">
          звон у угла
        </text>
        <text x="168" y="30" fontSize="10" fontWeight="700" fill="#10b981">
          после шейпера
        </text>

        {PANELS.map((px, panelIndex) => {
          const cx = px + CORNER.dx;
          const cy = WALL_Y + CORNER.dy;
          return (
            <g key={px}>
              <rect
                x={px}
                y={WALL_Y}
                width={PANEL_W}
                height={WALL_H}
                rx="4"
                fill="#334155"
                fillOpacity="0.55"
                stroke="#64748b"
              />
              <line x1={cx} y1={WALL_Y} x2={cx} y2={WALL_Y + WALL_H} stroke="#94a3b8" />
              <line x1={cx} y1={cy} x2={px + PANEL_W} y2={cy} stroke="#94a3b8" />
              {panelIndex === 0 ? (
                RINGS.map((ring) => (
                  <path
                    key={ring.radius}
                    d={arc(cx, cy, ring.radius)}
                    fill="none"
                    stroke="#f59e0b"
                    strokeOpacity={ring.opacity}
                    strokeWidth="1.4"
                  />
                ))
              ) : (
                [52, 62, 72].map((y) => (
                  <line
                    key={y}
                    x1={cx + 8}
                    y1={y}
                    x2={px + PANEL_W - 8}
                    y2={y}
                    stroke="#94a3b8"
                    strokeOpacity="0.15"
                  />
                ))
              )}
            </g>
          );
        })}

        <text x="12" y="126" fontSize="10" fill="#fca5a5">
          рябь с шагом ~1,2 мм
        </text>
        <text x="168" y="126" fontSize="10" fill="#6ee7b7">
          стенка ровная
        </text>

        <text x="12" y="142" fontSize="10" fontWeight="700" fill="#e2e8f0">
          Звон живёт у угла и затухает к середине
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          Шейпер гасит волну опережающими импульсами
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          Частоты X и Y разные — это норма
        </text>
      </svg>
    </VisualWrapper>
  );
}
