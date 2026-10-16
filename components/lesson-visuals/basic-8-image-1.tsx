import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три состояния поверхности: 12…104, 110…202, 208…308, 20…102. */
const PANEL_TOP = 20;
const PANEL_H = 82;
const PANEL_X = [12, 110, 208];
const PANEL_W = [92, 92, 100];
const PANEL_CENTER = [58, 156, 258];
const BAND_Y = 68;
const BAND_H = 14;
const BED_Y = 86;

const LEAD = "поддержку тянут по слоям, а не поперёк";
const LEAD_NOTE = "зазор 0,2–0,3 мм при плотности 10–15 % — снимается легко";
const NOTES = [
  "240–400 — следы и наплывы · 600–1000 — стенки и шов",
  "посадочные не трогать (−0,1–0,3 мм) · шкурка 400 и 800",
];

type Stage = { title: string; color: string; note: string; kind: "supports" | "marks" | "smooth" };

/** Три кадра из блока 26: поддержки, следы после снятия, поверхность после шкурки. */
const STAGES: Stage[] = [
  { title: "поддержки", color: "#f59e0b", note: "снять по слоям", kind: "supports" },
  { title: "следы", color: "#f87171", note: "240–400", kind: "marks" },
  { title: "после шкурки", color: "#10b981", note: "600–1000", kind: "smooth" },
];

/**
 * Кадр блока 26 урока L8 «Одна деталь: поддержки, следы, шкурка».
 *
 * Три состояния одной поверхности: поддержки ещё стоят, следы после снятия и
 * поверхность после шкурки. Снизу порядок из блока 24 и зернистость из блока 25.
 *
 * Числа — из блоков 24, 25 и 30: поддержку тянут по направлению слоёв, зазор
 * 0,2–0,3 мм при плотности 10–15 % снимается легко, зернистость 240–400 для
 * следов и наплывов, 600–1000 для стенок и шва, посадочные размеры после
 * шкурки уходят на 0,1–0,3 мм, инструмент первой детали — 400 и 800.
 */
export function Basic8Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Одна деталь: поддержки, следы и шкурка. Три состояния одной поверхности — поддержки ещё стоят и снимаются по направлению слоёв, следы после снятия и поверхность после шкурки. Зазор между поддержкой и деталью 0,2–0,3 мм при плотности 10–15 процентов снимается легко. Зернистость 240–400 убирает следы и наплывы, 600–1000 выравнивает стенки и шов. Посадочные размеры не трогают: отверстие, шип и паз после шкурки уменьшаются на 0,1–0,3 мм. Инструмент первой детали — 400 и 800"
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
          Одна деталь: поддержки, следы, шкурка
        </text>

        {/* Поверхность в трёх состояниях */}
        {STAGES.map((stage, index) => {
          const x0 = PANEL_X[index];
          const center = PANEL_CENTER[index];
          const width = PANEL_W[index];
          const bandX = x0 + 16;
          const bandW = width - 32;
          return (
            <g key={stage.title}>
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
              <text x={center} y="32" fontSize="10" fontWeight="700" fill={stage.color} textAnchor="middle">
                {stage.title}
              </text>
              <rect
                x={bandX}
                y={BAND_Y}
                width={bandW}
                height={BAND_H}
                rx="2"
                fill="#3b82f6"
                fillOpacity="0.2"
                stroke="#3b82f6"
              />
              {stage.kind === "supports" &&
                [bandX + 8, bandX + bandW / 2 - 1, bandX + bandW - 10].map((x) => (
                  <g key={x}>
                    <line x1={x} y1={BAND_Y + BAND_H} x2={x} y2={BED_Y} stroke="#f59e0b" />
                    <line x1={x - 4} y1={BED_Y} x2={x + 4} y2={BED_Y} stroke="#f59e0b" />
                  </g>
                ))}
              {stage.kind === "marks" &&
                [0, 1, 2, 3, 4, 5].map((step) => (
                  <path
                    key={step}
                    d={`M${bandX + 6 + step * 11} ${BAND_Y + BAND_H} l3 5 l3 -5 Z`}
                    fill="#f87171"
                    fillOpacity="0.7"
                  />
                ))}
              {stage.kind === "smooth" && (
                <line
                  x1={bandX}
                  y1={BAND_Y + BAND_H}
                  x2={bandX + bandW}
                  y2={BAND_Y + BAND_H}
                  stroke="#10b981"
                  strokeWidth="2"
                />
              )}
              {stage.kind === "supports" && (
                <line x1={bandX} y1={BED_Y + 4} x2={bandX + bandW} y2={BED_Y + 4} stroke="#475569" />
              )}
              <text x={center} y="98" fontSize="10" fill={stage.color} textAnchor="middle">
                {stage.note}
              </text>
            </g>
          );
        })}

        {/* Порядок снятия и зернистость */}
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
