import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две одинаковые детали с куполом: 24…84 и 168…228, 56…118 по Y. */
const LEFT_PART = "M24,118 L24,72 Q24,56 40,56 L68,56 Q84,56 84,72 L84,118 Z";
const RIGHT_PART = "M168,118 L168,72 Q168,56 184,56 L212,56 Q228,56 228,72 L228,118 Z";
/** Слева постоянный слой 0,12 мм — линии через 3. */
const FLAT_Y = [115, 112, 109, 106, 103, 100, 97, 94, 91, 88, 85, 82, 79, 76, 73, 70, 67, 64];
/** Справа: толстые внизу (шаг 7) и тонкие на куполе (шаг 4). */
const COARSE_Y = [112, 105, 98, 91, 84];
const FINE_Y = [80, 76, 72, 68, 64, 60];
/** Колонка выигрыша: подписи 236…308, три строки через 32. */
const STAT_X = 236;
const STAT_TOP = 62;
const STAT_STEP = 32;

type Stat = { value: string; note: string; color: string };

/** Что меняется от переменной высоты — блоки 29 и 28. */
const STATS: Stat[] = [
  { value: "−30–40 %", note: "времени", color: "#f59e0b" },
  { value: "верх", note: "гладкий", color: "#10b981" },
  { value: "ровная", note: "рамка: ноль", color: "#94a3b8" },
];

const NOTES = [
  "Выигрыш 30–40 % на скруглённом верху",
  "Переход не ставь на место нагрузки",
];

/**
 * Кадр блока 30 урока C6 «Одна деталь: постоянная и переменная высота».
 *
 * Две одинаковые детали из описания кадра `C6_compare.png`: слева постоянный
 * слой 0,12 мм по всей высоте, справа переменная высота — 0,28 мм внизу и
 * 0,12 мм на куполе. Цифры взяты из блоков 29 и 28: на корпусе со скруглённым
 * верхом выигрыш 30–40 % времени, на ровной рамке его почти нет, а переходы
 * высоты не ставят на место будущей нагрузки — это точки раздела слоёв.
 */
export function ConfidentC6Diagram2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Одна деталь: постоянная и переменная высота. Слева деталь печатается постоянным слоем 0,12 миллиметра по всей высоте, линии слоёв идут ровно. Справа та же деталь с переменной высотой: внизу 0,28 миллиметра, на куполе 0,12 миллиметра. Выигрыш 30–40 процентов времени на скруглённом верху, на ровной рамке его почти нет. Переход высоты не ставят на место будущей нагрузки"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <clipPath id="c6CmpLeft">
            <path d={LEFT_PART} />
          </clipPath>
          <clipPath id="c6CmpRight">
            <path d={RIGHT_PART} />
          </clipPath>
        </defs>

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
          Одна деталь: постоянная и переменная высота
        </text>

        <text x="54" y="46" fontSize="10" fontWeight="700" fill="#94a3b8" textAnchor="middle">
          постоянная
        </text>
        <text x="198" y="46" fontSize="10" fontWeight="700" fill="#f59e0b" textAnchor="middle">
          переменная
        </text>

        {/* Слева: ровный тонкий слой по всей высоте */}
        <path d={LEFT_PART} fill="#334155" fillOpacity="0.45" stroke="#64748b" />
        <g clipPath="url(#c6CmpLeft)">
          {FLAT_Y.map((y) => (
            <line key={y} x1="22" y1={y} x2="86" y2={y} stroke="#7dd3fc" strokeOpacity="0.5" />
          ))}
        </g>

        {/* Справа: толстые слои внизу, тонкие на куполе */}
        <path d={RIGHT_PART} fill="#334155" fillOpacity="0.45" stroke="#64748b" />
        <g clipPath="url(#c6CmpRight)">
          {COARSE_Y.map((y) => (
            <line key={y} x1="166" y1={y} x2="230" y2={y} stroke="#f59e0b" strokeOpacity="0.6" />
          ))}
          {FINE_Y.map((y) => (
            <line key={y} x1="166" y1={y} x2="230" y2={y} stroke="#10b981" strokeOpacity="0.6" />
          ))}
        </g>

        {/* Подписи под деталями */}
        <text x="54" y="132" fontSize="10" fill="#93c5fd" textAnchor="middle">
          0,12 мм везде
        </text>
        <text x="198" y="132" fontSize="10" fill="#fcd34d" textAnchor="middle">
          0,28 → 0,12
        </text>

        {/* Что даёт переменная высота */}
        {STATS.map((stat, index) => {
          const y = STAT_TOP + index * STAT_STEP;
          return (
            <g key={stat.value}>
              <text x={STAT_X} y={y} fontSize="10" fontWeight="700" fill={stat.color}>
                {stat.value}
              </text>
              <text x={STAT_X} y={y + 12} fontSize="10" fill="#94a3b8">
                {stat.note}
              </text>
            </g>
          );
        })}

        {/* Ориентиры по времени и переходам */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={152 + index * 12}
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
