import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Акцент кадра: ремень и шкив — это привод, синий цвет базового курса. */
const ACCENT = "#3b82f6";

/** Шесть зубьев на профиле ремня: шаг зуба 2 мм показан размерной линией. */
const BELT_TEETH = [30, 52, 74, 96, 118, 140];

/** Двадцать зубьев шкива через 18°. */
const PULLEY_TEETH = Array.from({ length: 20 }, (_, index) => index * 18);

/** Центр шкива в кадре: ремень и зубья встают под заголовком блока. */
const PULLEY_X = 56;
const PULLEY_Y = 134;

/**
 * Расчёт точности в три строки: сколько ремня уходит за оборот, сколько шагов
 * делает мотор за оборот и что остаётся на один шаг.
 */
const CALC = [
  { formula: "20 зубьев × 2 мм", result: "= 40 мм за оборот" },
  { formula: "200 × 1/16", result: "= 3200 шагов" },
  { formula: "40 / 3200", result: "= 0,0125 мм" },
];

/** Строки расчёта: первая формула, отступ до результата и отступ между парами. */
const CALC_TOP = 58;
const CALC_STEP = 16;
const CALC_PAIR = 32;

/**
 * Кадр блока 13 урока L2 «Ремень GT2, шкив 20 зубьев и натяжитель».
 *
 * Компоновка — схема в двух этажах плюс расчёт: сверху профиль ремня с шагом
 * зуба, под ним шкив на 20 зубьев, справа три строки арифметики. Это не
 * сравнение вариантов, поэтому полос нет: разбираем один узел и считаем его
 * точность.
 *
 * Числа строго из блока 12: профиль GT2 (Gates Tooth profile 2, строгое имя
 * 2GT), шаг ремня 2 мм; шкив 20 зубьев даёт 20 × 2 = 40 мм ремня за оборот; мотор
 * на 200 шагов с микрошагом 1/16 — это 3200 шагов на оборот; 40 / 3200 =
 * 0,0125 мм, то есть 12,5 мкм. Формальный результат микрошага 1/256 (0,78 мкм)
 * урок называет фантастикой, поэтому в кадре его нет.
 */
export function Basic2Diagram2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Ремень GT2 и точность привода: профиль GT2 — зуб ремня заходит в паз шкива, шаг ремня 2 мм; шкив на 20 зубьев за один оборот пропускает 40 мм ремня; мотор на 200 шагов с микрошагом 1/16 делает 3200 шагов на оборот, значит один шаг сдвигает каретку на 40 / 3200 = 0,0125 мм, то есть на 12,5 мкм"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
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
          Ремень GT2: профиль, шкив, расчёт точности
        </text>

        {/* Этаж первый: профиль ремня — зубья ремня заходят в пазы шкива */}
        <rect x="12" y="22" width="154" height="52" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="20" y="36" fontSize="10" fill="#94a3b8">
          Профиль GT2: зуб в паз
        </text>
        <rect x="20" y="41" width="138" height="7" rx="2" fill="#cbd5e1" fillOpacity="0.85" />
        {BELT_TEETH.map((cx) => (
          <polygon
            key={cx}
            points={`${cx - 5},48 ${cx + 5},48 ${cx + 3},53 ${cx - 3},53`}
            fill="#94a3b8"
          />
        ))}
        {/* Шаг зуба: два миллиметра между соседними зубьями */}
        <line x1="30" y1="60" x2="52" y2="60" stroke={ACCENT} strokeWidth="1.2" />
        <line x1="30" y1="57" x2="30" y2="63" stroke={ACCENT} strokeWidth="1.2" />
        <line x1="52" y1="57" x2="52" y2="63" stroke={ACCENT} strokeWidth="1.2" />
        <text x="34" y="71" fontSize="10" fill={ACCENT}>
          2 мм
        </text>

        {/* Этаж второй: шкив на 20 зубьев и ремень, обёрнутый вокруг него */}
        <rect x="12" y="78" width="154" height="90" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="20" y="92" fontSize="10" fill="#94a3b8">
          Шкив 20 зубьев
        </text>
        <path
          d={`M ${PULLEY_X - 32},${PULLEY_Y} A 32 32 0 0 1 ${PULLEY_X + 32},${PULLEY_Y}`}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="3"
        />
        <circle cx={PULLEY_X} cy={PULLEY_Y} r="24" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.2" />
        {PULLEY_TEETH.map((angle) => (
          <rect
            key={angle}
            x={PULLEY_X - 4}
            y={PULLEY_Y - 30}
            width="8"
            height="6"
            fill={ACCENT}
            fillOpacity="0.8"
            transform={`rotate(${angle} ${PULLEY_X} ${PULLEY_Y})`}
          />
        ))}
        <circle cx={PULLEY_X} cy={PULLEY_Y} r="5" fill="#cbd5e1" />
        <circle cx={PULLEY_X} cy={PULLEY_Y} r="1.8" fill="#64748b" />
        {/* Вращение шкива: ремень уходит вниз с одной стороны и приходит с другой */}
        <line x1="18" y1="126" x2="18" y2="114" stroke={ACCENT} strokeWidth="1.4" />
        <polygon points="15,116 21,116 18,109" fill={ACCENT} />
        <line x1="90" y1="142" x2="90" y2="154" stroke={ACCENT} strokeWidth="1.4" />
        <polygon points="87,153 93,153 90,160" fill={ACCENT} />
        <text x="100" y="132" fontSize="10" fill="#cbd5e1">
          40 мм ремня
        </text>
        <text x="100" y="148" fontSize="10" fill="#cbd5e1">
          за оборот
        </text>

        {/* Расчёт: сколько ремня, сколько шагов и что на один шаг */}
        <rect x="172" y="22" width="136" height="146" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="182" y="40" fontSize="10" fill="#94a3b8">
          Расчёт точности
        </text>
        {CALC.map((row, index) => {
          const top = CALC_TOP + index * CALC_PAIR;

          return (
            <g key={row.formula}>
              {index > 0 && (
                <line
                  x1="180"
                  y1={top - 8}
                  x2="300"
                  y2={top - 8}
                  stroke="#475569"
                  strokeOpacity="0.6"
                />
              )}
              <text x="182" y={top} fontSize="10" fill="#cbd5e1">
                {row.formula}
              </text>
              <text x="182" y={top + CALC_STEP} fontSize="10" fill="#e2e8f0">
                {row.result}
              </text>
            </g>
          );
        })}
        <text x="182" y="158" fontSize="10" fontWeight="700" fill={ACCENT}>
          = 12,5 мкм
        </text>
      </svg>
    </VisualWrapper>
  );
}
