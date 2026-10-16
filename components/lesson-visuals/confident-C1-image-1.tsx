import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пять звеньев пути воздуха: 30…308, 20…142, шаг 25, высота звена 22. */
const ROW_X = 30;
const ROW_W = 278;
const ROW_H = 22;
const ROW_Y = [20, 45, 70, 95, 120];
const CHIP_X = 44;
const NAME_X = 58;
const NOTE_X = 150;

type Stage = { name: string; note: string; color: string };

/** Путь воздуха — блок 27; про замену расходников — блок 20. */
const STAGES: Stage[] = [
  { name: "камера", note: "выбросы остаются у сопла", color: "#10b981" },
  { name: "предфильтр", note: "крупная пыль и волокно", color: "#10b981" },
  { name: "HEPA", note: "меняют по запылению", color: "#3b82f6" },
  { name: "уголь", note: "газы и запах — по часам", color: "#f59e0b" },
  { name: "отвод", note: "наружу, а не в комнату", color: "#64748b" },
];

const NOTES = [
  "приток обязателен: без него вытяжка вхолостую",
  "дверцу камеры не открывать сразу после печати",
];

/**
 * Кадр блока 27 урока C1 «Схема защиты мастерской».
 *
 * Путь воздуха по цепочке: камера, предфильтр, HEPA, уголь, отвод. Вдоль цепочки
 * идёт приток — без него вытяжка работает вхолостую (блок 17). Про замену
 * расходников — блок 20: HEPA забивается механически и виден по запылению, уголь
 * «умирает» незаметно и его меняют по расписанию часов. Отдельная привычка из
 * блока 26: дверцу камеры не открывать сразу после печати, пусть воздух внутри
 * сначала пройдёт через фильтр.
 */
export function ConfidentC1Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Схема защиты мастерской: путь воздуха по цепочке — камера, предфильтр, HEPA, уголь, отвод наружу. В камере выбросы остаются у сопла, предфильтр держит крупную пыль и волокно, HEPA меняют по запылению, уголь — по расписанию часов, отвод уходит наружу, а не в комнату. Приток обязателен: без него вытяжка работает вхолостую. Дверцу камеры не открывают сразу после печати"
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
          Схема защиты мастерской: путь воздуха
        </text>

        {/* Приток: воздух идёт снизу вверх, мимо всей цепочки */}
        <line x1="18" y1="142" x2="18" y2="22" stroke="#10b981" strokeOpacity="0.7" />
        <path d="M18 22 L14 32 L22 32 Z" fill="#10b981" fillOpacity="0.8" />

        {STAGES.map((stage, index) => {
          const y = ROW_Y[index];
          return (
            <g key={stage.name}>
              <rect
                x={ROW_X}
                y={y}
                width={ROW_W}
                height={ROW_H}
                rx="4"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <circle
                cx={CHIP_X}
                cy={y + 11}
                r="8"
                fill={stage.color}
                fillOpacity="0.18"
                stroke={stage.color}
                strokeOpacity="0.7"
              />
              <text
                x={CHIP_X}
                y={y + 15}
                fontSize="10"
                fill={stage.color}
                textAnchor="middle"
              >
                {index + 1}
              </text>
              <text x={NAME_X} y={y + 15} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {stage.name}
              </text>
              <text x={NOTE_X} y={y + 15} fontSize="10" fill="#94a3b8">
                {stage.note}
              </text>
            </g>
          );
        })}

        {/* Приток и привычка с дверцей */}
        <rect
          x="12"
          y="146"
          width="296"
          height="24"
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
            y={157 + index * 11}
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
