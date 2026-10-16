import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Шесть материалов: две колонки по 144, три ряда по 46 (20…168). */
const CARD_X = [12, 164];
const CARD_Y = [20, 71, 122];
const CARD_W = 144;
const CARD_H = 46;

type Material = { name: string; line1: string; line2: string; color: string };

/** Состав выбросов — блок 5, пометки оттуда же. */
const MATERIALS: Material[] = [
  {
    name: "PLA",
    line1: "лактиды и альдегиды",
    line2: "минимум среди всех",
    color: "#10b981",
  },
  {
    name: "PETG",
    line1: "альдегиды и другая",
    line2: "органика — ближе к PLA",
    color: "#3b82f6",
  },
  {
    name: "ABS и ASA",
    line1: "стирол, этилбензол,",
    line2: "акрилонитрил — в разы",
    color: "#f59e0b",
  },
  {
    name: "PA (нейлон)",
    line1: "капролактам, высокая",
    line2: "температура печати",
    color: "#f59e0b",
  },
  {
    name: "CF/GF",
    line1: "органика плюс волокно",
    line2: "пыль при шлифовке",
    color: "#f87171",
  },
  {
    name: "PC",
    line1: "самые высокие",
    line2: "температуры — много VOC",
    color: "#f87171",
  },
];

/**
 * Кадр блока 5 урока C1 «Что выделяет каждый материал».
 *
 * Шесть карточек по составу выбросов: PLA — лактиды и альдегиды, PETG —
 * альдегиды и другая органика, ABS и ASA — стирол, этилбензол и акрилонитрил,
 * PA — капролактам и высокая температура печати, композиты CF/GF — органика
 * плюс волокно, PC — самые высокие температуры. Все пометки взяты из того же
 * блока 5: у ABS и ASA частиц в разы больше, чем у PLA, PETG по составу ближе к
 * PLA, а композитная пыль попадает в воздух при шлифовке.
 */
export function ConfidentC1List0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Что выделяет каждый материал: шесть карточек. PLA — лактиды и альдегиды, минимум среди всех. PETG — альдегиды и другая органика, ближе к PLA. ABS и ASA — стирол, этилбензол и акрилонитрил, частиц в разы больше. PA, нейлон — капролактам и высокая температура печати. Композиты CF и GF — органика плюс волокно, пыль при шлифовке. PC — самые высокие температуры и больше всего органики"
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
          Что выделяет каждый материал
        </text>

        {MATERIALS.map((material, index) => {
          const x = CARD_X[index % 2];
          const y = CARD_Y[Math.floor(index / 2)];
          return (
            <g key={material.name}>
              <rect
                x={x}
                y={y}
                width={CARD_W}
                height={CARD_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text x={x + 10} y={y + 16} fontSize="12" fontWeight="700" fill={material.color}>
                {material.name}
              </text>
              <text x={x + 10} y={y + 29} fontSize="10" fill="#cbd5e1">
                {material.line1}
              </text>
              <text x={x + 10} y={y + 41} fontSize="10" fill="#94a3b8">
                {material.line2}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
