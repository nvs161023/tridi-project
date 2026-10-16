import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Воздуховод: 36…88, ступени внутри, подписи ресурса на 104. */
const DUCT_Y = 36;
const DUCT_H = 52;
const CENTER_Y = DUCT_Y + 26;

type Stage = {
  name: string;
  resource: string;
  cx: number;
  width: number;
  color: string;
};

/** Ресурсы — блок 12; маркировка H13 и порядок ступеней — блоки 6, 10 и 13. */
const STAGES: Stage[] = [
  { name: "предфильтр", resource: "раз в месяц", cx: 54, width: 12, color: "#10b981" },
  { name: "HEPA H13", resource: "6–12 мес.", cx: 118, width: 16, color: "#3b82f6" },
  { name: "уголь", resource: "30–100 ч", cx: 186, width: 18, color: "#f59e0b" },
  { name: "вентилятор", resource: "последним", cx: 258, width: 24, color: "#cbd5e1" },
];

/** Зазоры между ступенями: там рисуем направление потока. */
const CHEVRON_X = [88, 152, 220, 283];

const SEAL_NOTES = [
  "Уплотнитель по всему периметру рамы и крышки",
  "Щель 2–3 мм по краю обесценивает фильтр",
];

const ORDER_NOTES = [
  "Порядок по потоку: предфильтр → HEPA → уголь",
  "Уголь первым забьётся пылью за считаные печати",
  "Уголь ходит 30–100 ч, HEPA — 6–12 месяцев",
];

/**
 * Кадр блока 11 урока C2 «Фильтры и маркировки».
 *
 * Разрез по потоку из описания кадра `C2_filters.png`: предфильтр, HEPA, уголь и
 * уплотнитель по периметру. Ресурсы — из блока 12: предфильтр моют раз в месяц,
 * HEPA меняют каждые 6–12 месяцев, уголь ходит 30–100 часов печати, вентилятор
 * стоит последним по потоку. Порядок ступеней — из блока 5 (внутри принтер, на
 * выходе предфильтр, HEPA и уголь) и шагов блока 13, а щель в 2–3 мм по краю рамы
 * и «уголь забьётся пылью» — из шагов блока 13 и предупреждения блока 27: класс
 * фильтра имеет смысл только при герметичности.
 */
export function ConfidentC2Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Фильтры и маркировки: разрез по потоку. В одном корпусе по порядку стоят предфильтр, HEPA H13, уголь и вентилятор последним по потоку. Ресурсы: предфильтр моют раз в месяц, HEPA меняют каждые 6–12 месяцев, уголь ходит 30–100 часов печати. Уплотнитель идёт по всему периметру рамы и крышки: щель в 2–3 мм по краю обесценивает фильтр. Уголь первым забьётся пылью, если он стоит до HEPA"
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
          Фильтры и маркировки: порядок по потоку
        </text>

        {/* Названия ступеней по потоку */}
        {STAGES.map((stage) => (
          <text
            key={`${stage.name}-name`}
            x={stage.cx}
            y="30"
            fontSize="10"
            fontWeight="700"
            fill={stage.color}
            textAnchor="middle"
          >
            {stage.name}
          </text>
        ))}

        <rect
          x="24"
          y={DUCT_Y}
          width="272"
          height={DUCT_H}
          rx="4"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <line
          x1="28"
          y1={CENTER_Y}
          x2="292"
          y2={CENTER_Y}
          stroke="#64748b"
          strokeDasharray="4 4"
        />

        {/* Ступени фильтрации стоят внутри корпуса по порядку */}
        {STAGES.map((stage) => (
          <g key={stage.name}>
            <rect
              x={stage.cx - stage.width / 2}
              y={DUCT_Y + 4}
              width={stage.width}
              height={DUCT_H - 8}
              rx="2"
              fill={stage.color}
              fillOpacity="0.28"
              stroke={stage.color}
              strokeOpacity="0.8"
            />
            <line
              x1={stage.cx}
              y1={DUCT_Y + DUCT_H}
              x2={stage.cx}
              y2={DUCT_Y + DUCT_H + 6}
              stroke="#64748b"
            />
            <text x={stage.cx} y="104" fontSize="10" fill="#94a3b8" textAnchor="middle">
              {stage.resource}
            </text>
          </g>
        ))}

        {/* Вентилятор последним по потоку */}
        <circle cx="258" cy={CENTER_Y} r="7" fill="none" stroke="#cbd5e1" strokeOpacity="0.8" />
        <line x1="258" y1={CENTER_Y} x2="258" y2={CENTER_Y - 7} stroke="#cbd5e1" strokeOpacity="0.8" />
        <line x1="258" y1={CENTER_Y} x2="264" y2={CENTER_Y + 4} stroke="#cbd5e1" strokeOpacity="0.8" />
        <line x1="258" y1={CENTER_Y} x2="252" y2={CENTER_Y + 4} stroke="#cbd5e1" strokeOpacity="0.8" />

        {/* Направление потока в зазорах между ступенями */}
        {CHEVRON_X.map((x) => (
          <path
            key={x}
            d={`M${x - 6} ${CENTER_Y - 5} L${x} ${CENTER_Y} L${x - 6} ${CENTER_Y + 5}`}
            fill="none"
            stroke="#64748b"
            strokeWidth="1.5"
          />
        ))}

        {/* Уплотнитель: без него воздух идёт мимо фильтра */}
        <rect
          x="12"
          y="112"
          width="296"
          height="26"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {SEAL_NOTES.map((note, index) => (
          <text
            key={note}
            x="22"
            y={123 + index * 11}
            fontSize="10"
            fontWeight={index === 0 ? "700" : "400"}
            fill={index === 0 ? "#e2e8f0" : "#94a3b8"}
          >
            {note}
          </text>
        ))}

        {/* Порядок ступеней и ресурсы */}
        <rect
          x="12"
          y="142"
          width="296"
          height="34"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {ORDER_NOTES.map((note, index) => (
          <text
            key={note}
            x="22"
            y={153 + index * 11}
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

