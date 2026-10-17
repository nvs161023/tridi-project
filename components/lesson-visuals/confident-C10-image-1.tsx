import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две панели: 140 px шириной, зазор 16. */
const PANELS = [12, 168];
const PANEL_W = 140;
const WALL_Y = 36;
const WALL_H = 82;
/** Опора и линия моста. */
const PILLAR_W = 9;
const BRIDGE_Y = 58;

/** Провис: дуга между опорами и три свисающие нити под ней. */
const SAG = "M37 58 Q82 88 127 58";
const STRINGS = [
  { x: 55, y1: 68, y2: 78 },
  { x: 82, y1: 73, y2: 84 },
  { x: 109, y1: 68, y2: 78 },
];

/**
 * Кадр блока 25 урока C10 «Мост: провис и чистый мост».
 *
 * Макет из описания кадра `C10_bridge_compare.png`: один и тот же пролёт между
 * опорами. Слева нить провисает дугой и цепляется, справа ложится ровной
 * перемычкой. Порядок правок из блока 24: обдув на максимум, скорость 20–30 мм/с,
 * поток 80–90 %, и только потом поддержки, если пролёт слишком длинный.
 */
export function ConfidentC10Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Мост между двумя опорами до и после настройки. Слева нить провисает дугой на 1,8 мм и оставляет висящие нити. Справа мост ложится ровной перемычкой: обдув на максимум, скорость 20–30 мм/с, поток 80–90 процентов. Правки делают по одной, а мост длиннее 50 мм не вытянет никакой слайсер"
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
          мост: провис и чистый мост
        </text>

        <text x="12" y="30" fontSize="10" fontWeight="700" fill="#f87171">
          провис
        </text>
        <text x="168" y="30" fontSize="10" fontWeight="700" fill="#10b981">
          чистый мост
        </text>

        {PANELS.map((px, panelIndex) => (
          <g key={px}>
            <rect
              x={px}
              y={WALL_Y}
              width={PANEL_W}
              height={WALL_H}
              rx="4"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#334155"
            />
            <rect
              x={px + 16}
              y={BRIDGE_Y}
              width={PILLAR_W}
              height="52"
              fill="#475569"
              stroke="#64748b"
            />
            <rect
              x={px + PANEL_W - 16 - PILLAR_W}
              y={BRIDGE_Y}
              width={PILLAR_W}
              height="52"
              fill="#475569"
              stroke="#64748b"
            />

            {panelIndex === 0 ? (
              <g>
                <path d={SAG} fill="none" stroke="#f87171" strokeWidth="2" />
                {STRINGS.map((line) => (
                  <line
                    key={line.x}
                    x1={line.x}
                    y1={line.y1}
                    x2={line.x}
                    y2={line.y2}
                    stroke="#f87171"
                    strokeOpacity="0.35"
                  />
                ))}
              </g>
            ) : (
              <g>
                <line
                  x1={px + 25}
                  y1={BRIDGE_Y}
                  x2={px + 115}
                  y2={BRIDGE_Y}
                  stroke="#10b981"
                  strokeWidth="2"
                />
                {[px + 25, px + 115].map((x) => (
                  <rect
                    key={x}
                    x={x - 2}
                    y={BRIDGE_Y - 2}
                    width="4"
                    height="4"
                    fill="#10b981"
                  />
                ))}
              </g>
            )}
          </g>
        ))}

        <text x="12" y="126" fontSize="10" fill="#fca5a5">
          провис 1,8 мм и висящие нити
        </text>
        <text x="168" y="126" fontSize="10" fill="#6ee7b7">
          0,0 мм, ровная перемычка
        </text>

        <text x="12" y="142" fontSize="10" fontWeight="700" fill="#e2e8f0">
          Скорость 20–30 мм/с, обдув на максимум
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          Поток 80–90 %, правки — по одной за раз
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          Мост длиннее 50 мм не вытянет никакой слайсер
        </text>
      </svg>
    </VisualWrapper>
  );
}
