import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три полосы по 38 px: 20…58, 61…99, 102…140. */
const ROW_TOP = 20;
const ROW_H = 38;
const ROW_GAP = 3;

/** Скорость слева, полоса с 90, пояснение под полосой. */
const SPEED_X = 22;
const BAR_X = 90;
const BAR_W = 170;
const SPEED_Y = 20;
const BAR_Y = 11;
const BAR_H = 11;
const DETAIL_Y = 32;

/** Панель-вывод под полосами: 144…175. */
const NOTE_TOP = 144;
const NOTE_H = 31;
const NOTE_Y = 12;

type Speed = {
  value: number;
  label: string;
  color: string;
  detail: string;
};

/**
 * Три скорости из подписи блока 23: 20 / 40 / 60 мм/с. Что видно на контуре —
 * из текста уроков 22 и 26: на 20 мм/с расплав успевает прижаться к столу,
 * на 40 линия вытягивается и касается поверхности кромкой, на 60 кромка рвётся.
 */
const SPEEDS: Speed[] = [
  {
    value: 20,
    label: "20 мм/с",
    color: "#10b981",
    detail: "расплав успевает прижаться к столу",
  },
  {
    value: 40,
    label: "40 мм/с",
    color: "#3b82f6",
    detail: "линия вытягивается, касается кромкой",
  },
  {
    value: 60,
    label: "60 мм/с",
    color: "#f59e0b",
    detail: "рваная кромка",
  },
];

/** Панель-вывод: цифры первого слоя против обычных слоёв (блоки 22 и 24). */
const NOTES = [
  "обычные слои 60–100 мм/с · первый слой 15–20 мм/с",
  "сопло +5 °C к рабочей · обдув детали 0 %",
];

/**
 * Кадр блока 23 урока L5 «Один контур, три скорости».
 *
 * Компоновка — три полосы: скорость слева, полоса длиной по значению скорости,
 * под полосой одна строка о том, что происходит с контуром. 20 мм/с — расплав
 * успевает прижаться; 40 — линия вытягивается и касается поверхности кромкой;
 * 60 — кромка рвётся. Длина полосы честно пропорциональна скорости.
 *
 * Числа — из подписи блока 23 (20 / 40 / 60 мм/с) и текста блоков 22 и 24:
 * обычные слои 60–100 мм/с, первый слой 15–20 мм/с, сопло на 5 °C горячее,
 * обдув детали на первом слое выключен.
 */
export function Basic5Diagram2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Один контур на трёх скоростях первого слоя: на 20 мм/с расплав успевает прижаться к столу, на 40 мм/с линия вытягивается и касается поверхности кромкой, на 60 мм/с кромка рвётся. Обычные слои печатают на 60–100 мм/с, первый слой на 15–20 мм/с, сопло ставят на 5 °C горячее рабочей температуры, обдув детали на первом слое выключен"
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
          Один контур, три скорости
        </text>

        {/* Полосы: скорость, длина полосы по значению и что видно на контуре */}
        {SPEEDS.map((speed, index) => {
          const top = ROW_TOP + index * (ROW_H + ROW_GAP);

          return (
            <g key={speed.label}>
              <rect
                x="12"
                y={top}
                width="296"
                height={ROW_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text x={SPEED_X} y={top + SPEED_Y} fontSize="12" fontWeight="700" fill={speed.color}>
                {speed.label}
              </text>
              <rect
                x={BAR_X}
                y={top + BAR_Y}
                width={(BAR_W * speed.value) / 60}
                height={BAR_H}
                rx="2"
                fill={speed.color}
                fillOpacity="0.55"
                stroke={speed.color}
              />
              <text x={BAR_X} y={top + DETAIL_Y} fontSize="10" fill="#94a3b8">
                {speed.detail}
              </text>
            </g>
          );
        })}

        {/* Панель-вывод: первый слой против обычных слоёв */}
        <rect
          x="12"
          y={NOTE_TOP}
          width="296"
          height={NOTE_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {NOTES.map((note, index) => (
          <text key={note} x="22" y={NOTE_TOP + NOTE_Y + index * 12} fontSize="10" fill="#94a3b8">
            {note}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
