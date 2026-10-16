import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** График: ось Y — 0…100 % от 122 к 26, ось X — слои от 52 к 232. */
const AXIS_X = 52;
const AXIS_BOTTOM = 122;
const PERCENT_H = 96;
const AXIS_RIGHT = 232;

/** Ломаная профиля: 0 % на первом слое, 40 % к третьему, 70 % к четвёртому и пик 100 % на мосте. */
const PROFILE =
  "M52,122 H74 V103 H96 V84 H118 V55 H140 V26 H162 V55 H232";

/** Подписи по оси Y справа и метки слоёв под осью X. */
const Y_AXIS_LABEL_X = 48;
const LAYER_LABEL_Y = 136;
const LAYER_TICKS = [
  { x: 63, label: "1" },
  { x: 85, label: "2" },
  { x: 107, label: "3" },
  { x: 129, label: "4" },
  { x: 151, label: "5" },
  { x: 197, label: "6+" },
];

/** Правая колонка: рабочее значение обдува по материалам. */
const MATERIAL_X = 248;
const MATERIAL_ROWS = [32, 56, 80, 104];
const MATERIAL_NAME_Y = 12;
const MATERIAL_VALUE_Y = 23;

/** Панели-вывода: 142…158 и 160…176. */
const NOTE_TOP = 142;
const NOTE_H = 16;
const NOTE_STEP = 18;

type Material = { name: string; value: string; color: string };

/**
 * Рабочие значения из блоков 25 и 27: PLA 60–100 %, PETG 30–50 %, TPU 20–40 %,
 * а ABS, ASA и PA держат на 0–20 % с закрытой камерой.
 */
const MATERIALS: Material[] = [
  { name: "PLA", value: "60–100 %", color: "#3b82f6" },
  { name: "PETG", value: "30–50 %", color: "#10b981" },
  { name: "TPU", value: "20–40 %", color: "#f59e0b" },
  { name: "ABS", value: "0–20 %", color: "#f87171" },
];

/** Панели-вывода: связь обдува со временем слоя и минимум времени слоя. */
const NOTES = [
  "слой за 3 с вместо 8 — вентилятор не успевает",
  "минимум времени слоя 5–10 с · ABS и ASA — 0–20 %",
];

/** Подписи на ломаной: начало первого слоя, переход и рабочее значение. */
const LABELS = [
  { x: 54, y: 116, label: "первый слой", color: "#f59e0b" },
  { x: 98, y: 78, label: "40 %", color: "#f59e0b" },
  { x: 120, y: 49, label: "70 %", color: "#10b981" },
];

/** Пик на мосте: выноска от вершины к подписи справа. */
const BRIDGE = { x1: 152, y1: 28, x2: 172, y2: 36, textX: 174, textY: 40 };

/**
 * Кадр блока 26 урока L6 «Профиль обдува по высоте и минимальное время слоя».
 *
 * Компоновка — график обдува по слоям: 0 % на первом слое, рост до 40 % к
 * третьему, рабочее значение 70 % с четвёртого и пик 100 % на мосте. Справа
 * рабочие значения по материалам, снизу — связь обдува со временем слоя.
 *
 * Числа — из блоков 25–27 и 34: 0 % на первом слое (PLA до 20 %), переход
 * 2–3-й слой 30–50 %, PLA 60–100 %, PETG 30–50 %, TPU 20–40 %, ABS, ASA и PA
 * 0–20 % с камерой, мосты 100 %, минимум времени слоя 5–10 с.
 */
export function Basic6Diagram3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Профиль обдува по высоте: на первом слое 0 процентов, к третьему слою рост до 40, с четвёртого слоя рабочее значение 70, а на мосте пик 100 процентов. Рабочие значения по материалам: PLA 60–100 процентов, PETG 30–50, TPU 20–40, ABS, ASA и PA 0–20 с закрытой камерой. Если слой печатается 3 секунды вместо 8, вентилятор не успевает охладить предыдущий — поэтому есть минимальное время слоя 5–10 секунд"
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
          Профиль обдува по высоте
        </text>

        {/* Оси графика и линии 50 и 100 % */}
        <line x1={AXIS_X} y1={AXIS_BOTTOM - PERCENT_H} x2={AXIS_X} y2={AXIS_BOTTOM} stroke="#475569" />
        <line x1={AXIS_X} y1={AXIS_BOTTOM} x2={AXIS_RIGHT} y2={AXIS_BOTTOM} stroke="#475569" />
        <line
          x1={AXIS_X}
          y1={AXIS_BOTTOM - PERCENT_H / 2}
          x2={AXIS_RIGHT}
          y2={AXIS_BOTTOM - PERCENT_H / 2}
          stroke="#334155"
          strokeDasharray="3 3"
        />
        <line
          x1={AXIS_X}
          y1={AXIS_BOTTOM - PERCENT_H}
          x2={AXIS_RIGHT}
          y2={AXIS_BOTTOM - PERCENT_H}
          stroke="#334155"
          strokeDasharray="3 3"
        />

        {/* Подписи по оси Y */}
        <text x={Y_AXIS_LABEL_X} y="29" fontSize="10" fill="#64748b" textAnchor="end">
          100 %
        </text>
        <text x={Y_AXIS_LABEL_X} y="77" fontSize="10" fill="#64748b" textAnchor="end">
          50 %
        </text>
        <text x={Y_AXIS_LABEL_X} y="125" fontSize="10" fill="#64748b" textAnchor="end">
          0 %
        </text>

        {/* Ломаная профиля и подписи на ней */}
        <path d={PROFILE} fill="none" stroke="#38bdf8" strokeWidth="2" />
        {LABELS.map((item) => (
          <text key={item.label} x={item.x} y={item.y} fontSize="10" fontWeight="700" fill={item.color}>
            {item.label}
          </text>
        ))}
        <line x1={BRIDGE.x1} y1={BRIDGE.y1} x2={BRIDGE.x2} y2={BRIDGE.y2} stroke="#38bdf8" />
        <text x={BRIDGE.textX} y={BRIDGE.textY} fontSize="10" fontWeight="700" fill="#38bdf8">
          мост 100 %
        </text>

        {/* Номера слоёв под осью X */}
        {LAYER_TICKS.map((tick) => (
          <text
            key={tick.label}
            x={tick.x}
            y={LAYER_LABEL_Y}
            fontSize="10"
            fill="#64748b"
            textAnchor="middle"
          >
            {tick.label}
          </text>
        ))}

        {/* Рабочие значения по материалам */}
        {MATERIALS.map((material, index) => {
          const top = MATERIAL_ROWS[index];

          return (
            <g key={material.name}>
              <text
                x={MATERIAL_X}
                y={top + MATERIAL_NAME_Y}
                fontSize="12"
                fontWeight="700"
                fill={material.color}
              >
                {material.name}
              </text>
              <text x={MATERIAL_X} y={top + MATERIAL_VALUE_Y} fontSize="10" fill="#94a3b8">
                {material.value}
              </text>
            </g>
          );
        })}

        {/* Панели-вывода */}
        {NOTES.map((note, index) => {
          const top = NOTE_TOP + index * NOTE_STEP;

          return (
            <g key={note}>
              <rect
                x="12"
                y={top}
                width="296"
                height={NOTE_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text x="22" y={top + 11} fontSize="10" fill="#94a3b8">
                {note}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
