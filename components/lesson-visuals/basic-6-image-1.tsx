import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Башня: пять сегментов по 24 px, 30…150, корпус 64…96. */
const TOWER_X = 64;
const TOWER_W = 32;
const TOWER_TOP = 30;
const SEGMENT_H = 24;
const TEMP_X = 16;

/** Признаки справа: выноска от сегмента, точка и две строки текста. */
const LEAD_X = TOWER_X + TOWER_W;
const DOT_X = 108;
const ROW_X = 116;

/** Сноска под кадром: 156…176. */
const NOTE_TOP = 156;
const NOTE_H = 20;

type Segment = { temp: string; color: string };

type Feature = {
  name: string;
  detail: string;
  color: string;
  centerY: number;
  fromY: number;
};

/** Пять сегментов снизу вверх: 200, 205, 210, 215, 220 °C с шагом 5 °C. */
const SEGMENTS: Segment[] = [
  { temp: "220 °C", color: "#f87171" },
  { temp: "215 °C", color: "#f59e0b" },
  { temp: "210 °C", color: "#10b981" },
  { temp: "205 °C", color: "#38bdf8" },
  { temp: "200 °C", color: "#3b82f6" },
];

/**
 * Четыре признака из подписи блока 9 (паутина, расслоение, провис, оплыв) и
 * шагов блока 8: паутина на нижних сегментах, связь слоёв проверяют изломом
 * башни в стыке, провис смотрят на балконе-мосте, оплыв — на мелком выступе.
 */
const FEATURES: Feature[] = [
  {
    name: "Оплыв мелочи",
    detail: "мелкий выступ плывёт",
    color: "#f87171",
    centerY: 49,
    fromY: 42,
  },
  {
    name: "Провис на мосте",
    detail: "балкон проседает вниз",
    color: "#f59e0b",
    centerY: 79,
    fromY: 66,
  },
  {
    name: "Связь слоёв",
    detail: "изломай башню в стыке",
    color: "#10b981",
    centerY: 109,
    fromY: 90,
  },
  {
    name: "Паутина",
    detail: "нити между сегментами",
    color: "#3b82f6",
    centerY: 139,
    fromY: 138,
  },
];

/**
 * Кадр блока 9 урока L6 «Температурная башня: четыре признака на глаз».
 *
 * Компоновка — башня из пяти сегментов по 10 мм слева и четыре признака справа,
 * каждый со своей выноской к сегменту: чем выше сегмент, тем он горячее. Снизу
 * вверх — 200, 205, 210, 215 и 220 °C, то есть температурная башня с шагом 5 °C.
 *
 * Числа — из блоков 8 и 9: сопло 0,4 мм, слой 0,2 мм, линия 0,45 мм, 60 мм/с,
 * печать башни около 35 минут и 20–25 г пластика.
 */
export function Basic6Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Температурная башня из пяти сегментов по 10 мм: снизу вверх 200, 205, 210, 215 и 220 градусов. Четыре признака оценивают на глаз: паутина между сегментами, связь слоёв при изломе башни в стыке, провис на балконе-мосте и оплыв мелкого выступа. Печать башни занимает около 35 минут и 20–25 граммов пластика"
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
          Температурная башня: 200–220 °C
        </text>

        {/* Пять сегментов башни сверху вниз: от 220 к 200 °C */}
        {SEGMENTS.map((segment, index) => {
          const top = TOWER_TOP + index * SEGMENT_H;

          return (
            <g key={segment.temp}>
              <rect
                x={TOWER_X}
                y={top}
                width={TOWER_W}
                height={SEGMENT_H}
                fill="#0f172a"
                fillOpacity="0.5"
                stroke="#475569"
              />
              <text
                x={TEMP_X}
                y={top + SEGMENT_H / 2 + 3.5}
                fontSize="10"
                fontWeight="700"
                fill={segment.color}
              >
                {segment.temp}
              </text>
            </g>
          );
        })}

        {/* Четыре признака с выносками к сегментам */}
        {FEATURES.map((feature) => (
          <g key={feature.name}>
            <line x1={LEAD_X} y1={feature.fromY} x2={DOT_X} y2={feature.centerY} stroke="#475569" />
            <circle cx={DOT_X} cy={feature.centerY} r="2.5" fill={feature.color} />
            <text
              x={ROW_X}
              y={feature.centerY - 3}
              fontSize="11"
              fontWeight="700"
              fill={feature.color}
            >
              {feature.name}
            </text>
            <text x={ROW_X} y={feature.centerY + 8} fontSize="10" fill="#94a3b8">
              {feature.detail}
            </text>
          </g>
        ))}

        {/* Сноска: параметры теста */}
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
        <text x="22" y={NOTE_TOP + 13} fontSize="10" fill="#94a3b8">
          пять сегментов по 10 мм · 60 мм/с · ~35 мин, 20–25 г
        </text>
      </svg>
    </VisualWrapper>
  );
}
