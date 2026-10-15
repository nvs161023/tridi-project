import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Акцент кадра: карточка PLA, синий базового курса. */
const ACCENT = "#3b82f6";

/**
 * Четыре строки режимов из подписи блока «PLA в цифрах» и три числа физики из
 * текста блока 4. Порядок строк — как в подписи: сопло, стол, обдув, сушка.
 */
const MODES: { label: string; value: string; x: number; y: number }[] = [
  { label: "сопло", value: "190–220 °C", x: 30, y: 75 },
  { label: "стол", value: "55–60 °C", x: 170, y: 75 },
  { label: "обдув", value: "100 %", x: 30, y: 95 },
  { label: "сушка", value: "45 °C, 4 ч", x: 170, y: 95 },
];

/** Ширина колонки подписи: значение начинается сразу за ней. */
const LABEL_WIDTH = 54;


/**
 * Кадр блока 5 урока L3 «PLA в цифрах».
 *
 * Компоновка — карточка материала: имя, четыре строки режимов и полоса физики.
 * Сравнивать тут нечего, поэтому полос и стрелок нет; карточка PETG из блока 8
 * рисуется по этой же схеме, меняются только цвет, имя и числа.
 *
 * Числа — из подписи блока: сопло 190–220 °C, стол 55–60 °C, обдув 100 %,
 * сушка 45 °C за 4 часа. Полоса физики добирает три числа из текста блока 4:
 * температура стеклования 55–60 °C, температура прогиба под нагрузкой 50–55 °C,
 * усадка 0,3–0,5 %. Прочность 45–65 МПа и цену катушки 900–1600 ₽ в кадр не
 * брали: карточка про режимы, а не про прочность и деньги.
 */
export function Basic3Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Карточка материала PLA, он же полилактид: печать при сопле 190–220 °C, стол 55–60 °C, обдув детали 100 %, сушка катушки 45 °C за 4 часа. Физика материала: температура стеклования 55–60 °C, температура прогиба под нагрузкой 50–55 °C, усадка 0,3–0,5 %, поэтому PLA почти не коробит и ему не нужна камера"
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
          PLA в цифрах: режимы печати
        </text>

        {/* Карточка материала: имя и четыре строки режимов */}
        <rect x="12" y="22" width="296" height="90" rx="10" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="30" y="45" fontSize="12" fontWeight="700" fill={ACCENT}>
          PLA
        </text>
        <text x="76" y="45" fontSize="10" fill="#94a3b8">
          полилактид (polylactic acid)
        </text>
        <line x1="30" y1="54" x2="290" y2="54" stroke="#475569" strokeOpacity="0.7" />
        {MODES.map((mode) => (
          <g key={mode.label}>
            <text x={mode.x} y={mode.y} fontSize="10" fill="#94a3b8">
              {mode.label}
            </text>
            <text x={mode.x + LABEL_WIDTH} y={mode.y} fontSize="10" fill="#e2e8f0">
              {mode.value}
            </text>
          </g>
        ))}

        {/* Полоса физики: три числа, которые объясняют поведение материала */}
        <rect x="12" y="120" width="296" height="48" rx="10" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="22" y="136" fontSize="10" fill="#94a3b8">
          физика материала
        </text>
        <text x="22" y="158" fontSize="10" fill="#cbd5e1">
          Tg 55–60 °C
        </text>
        <text x="118" y="158" fontSize="10" fill="#cbd5e1">
          HDT 50–55 °C
        </text>
        <text x="204" y="158" fontSize="10" fill="#cbd5e1">
          усадка 0,3–0,5 %
        </text>
      </svg>
    </VisualWrapper>
  );
}
