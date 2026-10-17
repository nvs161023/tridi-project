import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две панели: 140 px шириной, зазор 16. */
const PANELS = [12, 168];
const PANEL_W = 140;
/** Угол детали: нижняя полка на 98, вертикаль на 56, верхняя полка на 56. */
const BASE_Y = 98;
const TOP_Y = 56;
const INSET = 20;
const CORNER_DX = 46;

/**
 * Кадр блока 18 урока C9 «Угол с наплывом и ровный угол».
 *
 * Макет из описания кадра `C9_linear_advance.png`: одинаковый угол детали слева
 * и справа. Слева K не подобран, лишнее давление выдавливает наплыв на повороте.
 * Справа K = 0,04, компенсация прикрывает поток до остановки, и угол выходит
 * чистым. Значения K взяты из блока 21: для PLA с прямой подачей это 0,03–0,05,
 * а хранят их в профиле материала.
 */
export function ConfidentC9Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Два одинаковых угла детали. Слева K не подобран: на повороте лишнее давление выдавливает наплыв плюс 0,15 мм. Справа K равен 0,04: компенсация прикрывает поток до остановки, угол чистый, лишнего пластика нет. K хранят в профиле материала, а тест проводят на рабочей скорости, а не на 30 мм/с"
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
          угол с наплывом и ровный угол
        </text>

        <text x="12" y="30" fontSize="10" fontWeight="700" fill="#f87171">
          K = 0 — наплыв
        </text>
        <text x="168" y="30" fontSize="10" fontWeight="700" fill="#10b981">
          K = 0,04 — ровно
        </text>

        {PANELS.map((px, panelIndex) => {
          const cornerX = px + INSET + CORNER_DX;
          const path = `M${px + INSET} ${BASE_Y} L${cornerX} ${BASE_Y} L${cornerX} ${TOP_Y} L${
            px + PANEL_W - INSET
          } ${TOP_Y}`;
          return (
            <g key={px}>
              <rect
                x={px}
                y="34"
                width={PANEL_W}
                height="78"
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#334155"
              />
              <path
                d={path}
                fill="none"
                stroke={panelIndex === 0 ? "#94a3b8" : "#cbd5e1"}
                strokeWidth="7"
                strokeLinejoin={panelIndex === 0 ? "round" : "miter"}
                strokeLinecap="round"
              />
              {panelIndex === 0 ? (
                <ellipse
                  cx={cornerX}
                  cy={BASE_Y + 1}
                  rx="10"
                  ry="6"
                  fill="#f59e0b"
                  fillOpacity="0.55"
                />
              ) : null}
            </g>
          );
        })}

        <text x="12" y="126" fontSize="10" fill="#fca5a5">
          наплыв +0,15 мм
        </text>
        <text x="168" y="126" fontSize="10" fill="#6ee7b7">
          угол чистый, 0,00 мм
        </text>

        <text x="12" y="142" fontSize="10" fontWeight="700" fill="#e2e8f0">
          Компенсация прикрывает поток до поворота
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          K живёт в профиле материала, а не в общем файле
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          Тест — на рабочей скорости, а не на 30 мм/с
        </text>
      </svg>
    </VisualWrapper>
  );
}
