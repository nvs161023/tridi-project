import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Input Shaper из content урока: «Измеряет резонансы, компенсирует. Убирает
 * ringing, позволяет 500 мм/с. Нужен ADXL345. Тест резонансов, автоматический
 * расчёт» и график «резонансы до и после Input Shaper. Пики сглажены».
 *
 * Это ПЕРВЫЙ график в курсе: ось частоты (Гц) слева направо, ось амплитуды снизу
 * вверх, две кривые — красная «до» с двумя острыми пиками (оси X и Y) и зелёная
 * «после» со сглаженными горбами. Плюс две мини-стенки справа внизу: кромка до
 * (волна) и после (прямая). Крана «до/после» печати или стенок-колонн в кадре нет
 * — фокус на резонансе, а не на самой печати (это язык B4 и I4[3]).
 *
 * Метки пиков живут в легенде, а не над кривыми: иначе подпись легла бы на линию.
 */
const TICKS = [60, 107, 154, 201];
const TICK_LABELS = ["20", "40", "60", "80"];

/**
 * «Input Shaper» — график резонансов до и после компенсации.
 */
export function ProII1Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="График резонансов: по оси частоты два острых пика около 40 и 62 герц до Input Shaper и сглаженные горбы после, справа внизу кромка стенки с волной и с прямой кромкой, скорость печати растёт вдвое"
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

        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          Input Shaper: что происходит с резонансами
        </text>
        <text x="12" y="34" fontSize="9" fill="#94a3b8">
          амплитуда
        </text>

        {/* Оси графика */}
        <line x1="60" y1="44" x2="60" y2="140" stroke="#475569" />
        <line x1="60" y1="140" x2="248" y2="140" stroke="#475569" />
        {TICKS.map((x) => (
          <line key={`tick-${x}`} x1={x} y1="140" x2={x} y2="146" stroke="#475569" />
        ))}

        {/* Кривая «до»: два острых пика на осях X и Y */}
        <path
          d="M60,138 C82,132 106,56 118,48 C130,40 134,102 142,114 C152,124 168,64 178,56 C192,46 226,122 248,134"
          fill="none"
          stroke="#f87171"
          strokeWidth="2"
        />

        {/* Кривая «после»: пики сглажены */}
        <path
          d="M60,136 C92,132 106,112 118,108 C130,104 134,118 142,122 C152,126 170,114 178,110 C196,106 226,128 248,132"
          fill="none"
          stroke="#34d399"
          strokeWidth="2"
        />

        {TICKS.map((x, index) => (
          <text
            key={`label-${x}`}
            x={x}
            y="162"
            fontSize="9"
            fill="#94a3b8"
            textAnchor="middle"
          >
            {TICK_LABELS[index]}
          </text>
        ))}
        <text x="232" y="162" fontSize="9" fill="#94a3b8">
          Гц
        </text>

        {/* Легенда: цвет кривой, положение пиков и выигрыш по скорости */}
        <line x1="254" y1="52" x2="268" y2="52" stroke="#f87171" strokeWidth="2" />
        <text x="272" y="55" fontSize="9" fill="#e2e8f0">
          до
        </text>
        <line x1="254" y1="74" x2="268" y2="74" stroke="#34d399" strokeWidth="2" />
        <text x="272" y="77" fontSize="9" fill="#e2e8f0">
          после
        </text>
        <text x="254" y="96" fontSize="9" fill="#94a3b8">
          пики:
        </text>
        <text x="254" y="114" fontSize="9" fill="#e2e8f0">
          40 и 62 Гц
        </text>
        <text x="254" y="132" fontSize="9" fill="#6ee7b7">
          скорость ×2
        </text>

        {/* Кромка стенки: волна до и прямая после */}
        <rect x="254" y="144" width="24" height="26" fill="#0f172a" stroke="#f87171" />
        <path
          d="M256,150 q4,5 8,0 q4,-5 8,0 q4,5 4,0"
          fill="none"
          stroke="#f87171"
          strokeWidth="1.6"
        />
        <rect x="286" y="144" width="24" height="26" fill="#0f172a" stroke="#34d399" />
        <line x1="288" y1="150" x2="308" y2="150" stroke="#34d399" strokeWidth="1.6" />

        <text x="12" y="176" fontSize="9.5" fill="#e2e8f0">
          резонанс ≈ 40 Гц — гасим программно, печать ×2
        </text>
      </svg>
    </VisualWrapper>
  );
}
