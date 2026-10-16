import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Схема принтера: корпус 12…158 и 22…136, панели справа — 166…308, шаг 38. */
const SPOT_X = 166;
const SPOT_W = 142;
const SPOT_H = 30;
const SPOT_Y = [30, 68, 106];

type Spot = { name: string; note: string; color: string };

/** Три горячих места и температуры — блок 4; топливо рядом — блок 2. */
const SPOTS: Spot[] = [
  { name: "Сопло", note: "≈250 °C, рядом нагар", color: "#f59e0b" },
  { name: "Стол", note: "60–100 °C под деталью", color: "#3b82f6" },
  { name: "Блок питания", note: "≈100 °C, пыль внутри", color: "#f87171" },
];

const NOTES = [
  "Топливо рядом: нагар, пыль и катушка",
  "Слабое место — датчик сопла: врёт — нагрев не встанет",
];

/**
 * Кадр блока 3 урока C3 «Три места, где принтер греется».
 *
 * Три горячих места из описания кадра `C3_fire_sources.png`: сопло и
 * нагревательный блок, стол и блок питания с платой. Температуры — блок 4:
 * сопло и нагревательный блок под 250 °C, стол 60–100 °C, блок питания и плата
 * около 100 °C, а слабое место — датчик сопла: если он врёт, нагрев идёт без
 * остановки. Топливо рядом — блок 2: катушка и намотанный на сопло пластик,
 * пыль и обрезки у вентиляторов, поддон и картон, шторы над столом.
 */
export function ConfidentC3Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три места, где принтер греется: сопло и нагревательный блок под 250 °C с нагаром, стол 60–100 °C под деталью, блок питания и плата около 100 °C с пылью внутри. Рядом лежит топливо: катушка, пыль, обрезки, поддон, картон и шторы над столом. Слабое место — датчик сопла: если он врёт, нагрев идёт без остановки, поэтому сначала убирают топливо, а потом смотрят на принтер"
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
          Три места, где принтер греется
        </text>

        {/* Принтер: сопло, стол и блок питания — три зоны нагрева */}
        <rect
          x="12"
          y="22"
          width="146"
          height="114"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.4"
          stroke="#475569"
          strokeOpacity="0.6"
        />
        <rect x="22" y="30" width="126" height="6" rx="3" fill="#475569" fillOpacity="0.5" />
        <rect x="26" y="30" width="5" height="62" rx="2" fill="#475569" fillOpacity="0.35" />
        <rect x="139" y="30" width="5" height="62" rx="2" fill="#475569" fillOpacity="0.35" />
        <rect
          x="76"
          y="38"
          width="16"
          height="10"
          rx="2"
          fill="#f59e0b"
          fillOpacity="0.22"
          stroke="#f59e0b"
          strokeOpacity="0.7"
        />
        <polygon points="79,48 89,48 84,60" fill="#f59e0b" fillOpacity="0.75" />
        <circle
          cx="84"
          cy="52"
          r="10"
          fill="none"
          stroke="#f59e0b"
          strokeOpacity="0.45"
          strokeDasharray="3 3"
        />
        <rect
          x="26"
          y="92"
          width="118"
          height="7"
          rx="3"
          fill="#3b82f6"
          fillOpacity="0.3"
          stroke="#3b82f6"
          strokeOpacity="0.6"
        />
        <circle
          cx="84"
          cy="95"
          r="10"
          fill="none"
          stroke="#3b82f6"
          strokeOpacity="0.45"
          strokeDasharray="3 3"
        />
        <rect
          x="26"
          y="106"
          width="118"
          height="24"
          rx="3"
          fill="#f87171"
          fillOpacity="0.14"
          stroke="#f87171"
          strokeOpacity="0.5"
        />
        <text x="32" y="117" fontSize="10" fill="#f87171">
          блок питания
        </text>
        <text x="32" y="127" fontSize="10" fill="#94a3b8">
          и плата
        </text>
        <circle
          cx="118"
          cy="118"
          r="10"
          fill="none"
          stroke="#f87171"
          strokeOpacity="0.45"
          strokeDasharray="3 3"
        />

        {/* Панели справа: место и температура */}
        {SPOTS.map((spot, index) => {
          const y = SPOT_Y[index];
          return (
            <g key={spot.name}>
              <rect
                x={SPOT_X}
                y={y}
                width={SPOT_W}
                height={SPOT_H}
                rx="5"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke={spot.color}
                strokeOpacity="0.45"
              />
              <rect
                x={SPOT_X + 4}
                y={y + 8}
                width="3"
                height={SPOT_H - 16}
                rx="1.5"
                fill={spot.color}
                fillOpacity="0.7"
              />
              <text x={SPOT_X + 12} y={y + 14} fontSize="11" fontWeight="700" fill={spot.color}>
                {spot.name}
              </text>
              <text x={SPOT_X + 12} y={y + 25} fontSize="10" fill="#cbd5e1">
                {spot.note}
              </text>
            </g>
          );
        })}

        {/* Топливо рядом и слабое место — датчик сопла */}
        <rect
          x="12"
          y="140"
          width="296"
          height="30"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="22"
            y={151 + index * 11}
            fontSize="10"
            fontWeight={index === 0 ? "700" : "400"}
            fill={index === 0 ? "#e2e8f0" : "#94a3b8"}
          >
            {note}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
