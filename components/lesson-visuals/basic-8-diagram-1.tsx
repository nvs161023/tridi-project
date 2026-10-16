import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три положения одной детали: 12…104, 110…202, 208…308, 20…102. */
const PANEL_TOP = 20;
const PANEL_H = 82;
const PANEL_X = [12, 110, 208];
const PANEL_W = [92, 92, 100];
const PANEL_CENTER = [58, 156, 258];
const BED_Y = 88;

const LEAD = "чем больше площадь в первом слое, тем выше адгезия";
const LEAD_NOTE = "ориентацию подбирают по нависаниям, а не по красоте";
const NOTES = [
  "больше 45–50° — поддержки; наклон 10–15° их убирает",
  "посадочный размер с зазором 0,2–0,3 мм, а не в номинал",
];

type Pose = { title: string; note: string; layer: number[] };

/** Правила из блока 12: площадь, нависания 45–50°, наклон на 10–15°. */
const POSES: Pose[] = [
  { title: "плашмя", note: "поддержек нет", layer: [78, 83] },
  { title: "на ребре", note: "нужны поддержки", layer: [46, 54, 62, 70, 78] },
  { title: "наклон 10–15°", note: "поддержек нет", layer: [50, 60, 70, 80] },
];

/**
 * Кадр блока 11 урока L8 «Ориентация: где пройдут слои и где нужны поддержки».
 *
 * Три положения одной детали: плашмя — площадь первого слоя максимальна и
 * поддержки не нужны, на ребре — узкая опора и нависание, которое требует
 * поддержек, и наклон на 10–15°, который эти поддержки убирает.
 *
 * Числа — из блока 12: нависания больше 45–50° требуют поддержек, наклон на
 * 10–15° иногда убирает их и экономит 20 минут, посадочный размер берут с
 * зазором 0,2–0,3 мм.
 */
export function Basic8Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Ориентация детали: три положения одной детали. Плашмя — площадь первого слоя максимальна, поддержки не нужны. На ребре — узкая опора и нависание, нужны поддержки. Наклон на 10–15 градусов — поддержки уходят. Правило: чем больше площадь в первом слое, тем выше адгезия, а нависания больше 45–50 градусов требуют поддержек. Ориентацию подбирают по нависаниям, а не по красоте, посадочный размер берут с зазором 0,2–0,3 мм"
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
          Ориентация: где пройдут слои и где нужны поддержки
        </text>

        {/* Три положения детали и слой за слоем */}
        {POSES.map((pose, index) => {
          const x0 = PANEL_X[index];
          const center = PANEL_CENTER[index];
          const width = PANEL_W[index];
          const color = pose.title === "на ребре" ? "#f87171" : "#38bdf8";
          return (
            <g key={pose.title}>
              <rect
                x={x0}
                y={PANEL_TOP}
                width={width}
                height={PANEL_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text x={center} y="32" fontSize="10" fontWeight="700" fill={color} textAnchor="middle">
                {pose.title}
              </text>
              <line x1={x0 + 8} y1={BED_Y} x2={x0 + width - 8} y2={BED_Y} stroke="#475569" />
              {index === 0 && (
                <rect
                  x={x0 + 22}
                  y={BED_Y - 10}
                  width="48"
                  height="10"
                  fill={color}
                  fillOpacity="0.25"
                  stroke={color}
                />
              )}
              {index === 1 && (
                <rect
                  x={x0 + 38}
                  y={BED_Y - 48}
                  width="12"
                  height="48"
                  fill={color}
                  fillOpacity="0.25"
                  stroke={color}
                />
              )}
              {index === 2 && (
                <path
                  d={`M${x0 + 34} ${BED_Y} L${x0 + 45} ${BED_Y} L${x0 + 56} ${BED_Y - 46} L${x0 + 45} ${BED_Y - 46} Z`}
                  fill={color}
                  fillOpacity="0.25"
                  stroke={color}
                />
              )}
              {pose.layer.map((offset) => (
                <line
                  key={offset}
                  x1={x0 + (index === 0 ? 22 : 30)}
                  y1={BED_Y - offset}
                  x2={x0 + (index === 0 ? 70 : 62)}
                  y2={BED_Y - offset}
                  stroke={color}
                  strokeOpacity="0.45"
                />
              ))}
              {index === 1 && (
                <g>
                  <line
                    x1={x0 + 50}
                    y1={BED_Y - 44}
                    x2={x0 + 66}
                    y2={BED_Y - 44}
                    stroke="#f59e0b"
                  />
                  {[0, 5, 10].map((step) => (
                    <line
                      key={step}
                      x1={x0 + 52 + step}
                      y1={BED_Y - 44}
                      x2={x0 + 48 + step}
                      y2={BED_Y - 38}
                      stroke="#f59e0b"
                      strokeOpacity="0.7"
                    />
                  ))}
                </g>
              )}
              <text x={center} y="98" fontSize="10" fill={color} textAnchor="middle">
                {pose.note}
              </text>
            </g>
          );
        })}

        {/* Правила ориентации и посадки */}
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
