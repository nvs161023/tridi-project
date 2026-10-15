import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Акцент кадра: карточка PETG — янтарный, чтобы её не путали с карточкой PLA. */
const ACCENT = "#f59e0b";

/**
 * Четыре строки режимов из подписи блока «PETG в цифрах». Порядок тот же, что у
 * карточки PLA: сопло, стол, обдув, сушка.
 */
const MODES: { label: string; value: string; x: number; y: number }[] = [
  { label: "сопло", value: "230–250 °C", x: 30, y: 75 },
  { label: "стол", value: "75–85 °C", x: 170, y: 75 },
  { label: "обдув", value: "30–50 %", x: 30, y: 95 },
  { label: "сушка", value: "65 °C, 4 ч", x: 170, y: 95 },
];

/** Ширина колонки подписи: значение начинается сразу за ней. */
const LABEL_WIDTH = 54;


/**
 * Кадр блока 8 урока L3 «PETG в цифрах».
 *
 * Компоновка — та же карточка материала, что у PLA: имя, четыре строки режимов и
 * полоса физики. Меняются цвет акцента, имя и числа, структура остаётся, поэтому
 * две карточки в уроке читаются как один справочник. Отличие в числах урок
 * подчёркивает словами: обдув не 100 %, а 30–50 %, потому что сильное охлаждение
 * ухудшает межслойную связь.
 *
 * Числа — из подписи блока 8: сопло 230–250 °C, стол 75–85 °C, обдув 30–50 %,
 * сушка 65 °C за 4 часа. Полоса физики — из блока 7: Tg 75–80 °C, HDT 70–75 °C,
 * усадка 0,2–1 %. Цену 1200–2000 ₽ и нитеобразование в карточку не брали: это
 * отдельные темы блока 7, а не режим печати.
 */
export function Basic3Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Карточка материала PETG, полиэтилентерефталата с гликолем: печать при сопле 230–250 °C, стол 75–85 °C, обдув детали 30–50 %, сушка катушки 65 °C за 4 часа. Физика материала: температура стеклования 75–80 °C, температура прогиба под нагрузкой 70–75 °C, усадка 0,2–1 %, поэтому PETG держит форму в машине, но остаётся липким в расплаве и требует умеренного обдува"
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
          PETG в цифрах: режимы печати
        </text>

        {/* Карточка материала: имя и четыре строки режимов */}
        <rect x="12" y="22" width="296" height="90" rx="10" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="30" y="45" fontSize="12" fontWeight="700" fill={ACCENT}>
          PETG
        </text>
        <text x="76" y="45" fontSize="10" fill="#94a3b8">
          PET с гликолем
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

        {/* Полоса физики: те же три числа, что у PLA, но свои значения */}
        <rect x="12" y="120" width="296" height="48" rx="10" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="22" y="136" fontSize="10" fill="#94a3b8">
          физика материала
        </text>
        <text x="22" y="158" fontSize="10" fill="#cbd5e1">
          Tg 75–80 °C
        </text>
        <text x="118" y="158" fontSize="10" fill="#cbd5e1">
          HDT 70–75 °C
        </text>
        <text x="204" y="158" fontSize="10" fill="#cbd5e1">
          усадка 0,2–1 %
        </text>
      </svg>
    </VisualWrapper>
  );
}
