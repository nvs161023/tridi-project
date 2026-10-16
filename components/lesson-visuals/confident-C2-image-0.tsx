import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три варианта: панели по 92 в ряд, план 42…86, подписи 98…120. */
const PANEL_X = [12, 110, 208];
const PANEL_W = 92;
const ROOM_Y = 42;
const ROOM_H = 44;
const NOTE_Y = [98, 109, 120];

/** Цвета пути воздуха: вытяжка уходит, приток приходит. */
const OUT = "#f87171";
const IN = "#10b981";

type Variant = {
  head: string;
  notes: string[];
  door: boolean;
  window: boolean;
  doubleWall: boolean;
  color: string;
};

/** Варианты и подписи — блоки 7 и 8: места, запреты, высота и дистанция. */
const VARIANTS: Variant[] = [
  {
    head: "У окна",
    notes: ["вытяжка в окно", "приток: створка", "PLA и PETG"],
    door: false,
    window: true,
    doubleWall: false,
    color: "#10b981",
  },
  {
    head: "В нише",
    notes: ["дверь закрыта", "воздух — наружу", "ABS и ASA"],
    door: true,
    window: false,
    doubleWall: false,
    color: "#3b82f6",
  },
  {
    head: "В мастерской",
    notes: ["своя комната", "свой путь наружу", "PC и PA"],
    door: false,
    window: false,
    doubleWall: true,
    color: "#f59e0b",
  },
];

const NOTES = [
  "Место печати: у окна, ниша с дверью, мастерская",
  "Высота 60–80 см, дистанция 1,5–2 м от дыхания",
  "Не ставить: спальня, детская, кухня, шкаф",
];

/** Стрелка вправо: вытяжка уходит из комнаты, приток приходит в неё. */
function arrowRight(x: number, y: number, color: string) {
  return (
    <g key={`${x}-${y}`}>
      <line x1={x - 14} y1={y} x2={x - 8} y2={y} stroke={color} strokeOpacity="0.8" />
      <path
        d={`M${x} ${y} L${x - 8} ${y - 4} L${x - 8} ${y + 4} Z`}
        fill={color}
        fillOpacity="0.85"
      />
    </g>
  );
}

/**
 * Кадр блока 8 урока C2 «Планировка комнаты».
 *
 * Три рабочих варианта из описания кадра `C2_place_room.png`: у окна, в нише и в
 * мастерской — с пометками притока и вытяжки. Места и подписи взяты из блока 7:
 * место у окна (легко вывести воздух и открыть створку), ниша или кладовая с
 * дверью, отдельная мастерская или лоджия для ABS, ASA и PC, а открытая полка в
 * жилой комнате — только для PLA и PETG. Там же запреты (спальня, детская, кухня,
 * шкаф с одеждой), высота 60–80 см, дистанция 1,5–2 м от дыхания и приток:
 * створка, клапан или зазор под дверью.
 */
export function ConfidentC2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Планировка комнаты: три рабочих варианта. У окна — вытяжка в окно, приток через створку, годится для PLA и PETG. В нише — дверь закрывается, воздух уходит наружу целиком, вариант для ABS и ASA. В мастерской — своя комната и свой путь наружу, для PC и PA. Место печати выбирают у окна, в нише с дверью или в мастерской; принтер ставят на высоту 60–80 см и держат дистанцию 1,5–2 м от дыхания. Не ставить: спальня, детская, кухня, шкаф с одеждой"
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
          Планировка комнаты: три варианта
        </text>
        <text x="308" y="15" fontSize="10" fill="#64748b" textAnchor="end">
          красный — вытяжка, зелёный — приток
        </text>

        {VARIANTS.map((variant, index) => {
          const x = PANEL_X[index];
          const roomBottom = ROOM_Y + ROOM_H;
          return (
            <g key={variant.head}>
              <rect
                x={x}
                y="24"
                width={PANEL_W}
                height="106"
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text x={x + 8} y="36" fontSize="10" fontWeight="700" fill={variant.color}>
                {variant.head}
              </text>

              {/* План комнаты: принтер у стены и путь воздуха */}
              <rect
                x={x + 6}
                y={ROOM_Y}
                width="80"
                height={ROOM_H}
                rx="3"
                fill="#1e293b"
                fillOpacity="0.4"
                stroke="#64748b"
                strokeOpacity="0.6"
              />
              <rect
                x={x + 10}
                y="58"
                width="20"
                height="14"
                rx="3"
                fill={variant.color}
                fillOpacity="0.2"
                stroke={variant.color}
                strokeOpacity="0.75"
              />
              {variant.window ? (
                <line x1={x + 86} y1="48" x2={x + 86} y2="62" stroke="#3b82f6" strokeWidth="3" />
              ) : null}
              {variant.door ? (
                <g>
                  <line x1={x + 6} y1={ROOM_Y} x2={x + 6} y2="58" stroke="#64748b" />
                  <line x1={x + 6} y1="70" x2={x + 6} y2={roomBottom} stroke="#64748b" />
                  <line x1={x + 6} y1="58" x2={x + 18} y2="64" stroke="#94a3b8" />
                </g>
              ) : null}
              {variant.doubleWall ? (
                <line x1={x + 90} y1={ROOM_Y} x2={x + 90} y2={roomBottom} stroke="#64748b" />
              ) : null}

              {/* Вытяжка уходит наружу, приток приходит в комнату */}
              {arrowRight(x + (variant.doubleWall ? 91 : 90), 72, OUT)}
              {arrowRight(x + 22, variant.door ? 64 : 52, IN)}

              {variant.notes.map((note, line) => (
                <text key={note} x={x + 8} y={NOTE_Y[line]} fontSize="10" fill="#94a3b8">
                  {note}
                </text>
              ))}
            </g>
          );
        })}

        {/* Высота, дистанция и места, куда принтер не ставят */}
        <rect
          x="12"
          y="134"
          width="296"
          height="42"
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
            y={146 + index * 11}
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
