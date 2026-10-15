import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Сухая катушка: изумрудный, как у «здорового» состояния. */
const DRY = "#10b981";

/** Влажная катушка: красный, потому что это дефект. */
const WET = "#f87171";

/** Две полосы слева: сухо и влажно, каждая по 70 px. */
const ROW_TOP = 22;
const ROW_HEIGHT = 70;
const ROW_GAP = 4;

/** Строки внутри полосы: имя и три симптома. */
const NAME_Y = 18;
const LINE_Y = [34, 48, 62];

/** Таблица сушки справа: ряды из блока 30. */
const DRYING = [
  { name: "PLA", value: "45 °C · 4 ч" },
  { name: "PETG", value: "65 °C · 4 ч" },
  { name: "PA и PC", value: "80 °C" },
  { name: "TPU", value: "50 °C" },
];

/** Верх таблицы сушки и шаг ряда. */
const TABLE_TOP = 76;
const TABLE_STEP = 24;

/**
 * Кадр блока 30 урока L3 «Влажный филамент: как выглядит печать».
 *
 * Компоновка — сравнение двух состояний плюс таблица: слева две полосы, сухая
 * катушка против влажной, справа таблица сушки из подписи блока. Полосы
 * сопоставлены построчно: имя, состояние стенки и симптомы. У сухой катушки пар
 * не рвёт поток, у влажной — треск из сопла, пузырьки и «иней», рыхлые стенки.
 *
 * Числа — из подписи блока 30: PLA 45 °C за 4 часа, PETG 65 °C за 4 часа, PA и PC
 * 80 °C, TPU 50 °C. Симптомы взяты из блока 29: «треск и щелчки из сопла»,
 * «пузырьки и «иней» на стенке», «рыхлые и слабые стенки». Расширение воды в
 * 1600 раз и гидролиз в кадре не показаны: это тема текста, а не карточки
 * симптомов.
 */
export function Basic3Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сравнение сухой и влажной катушки: у сухой катушки пар не рвёт поток, стенки целые и прочность не теряется; у влажной слышен треск и щелчки из сопла, на стенке появляются пузырьки и «иней», стенки становятся рыхлыми и слабыми. Сушить: PLA 45 °C за 4 часа, PETG 65 °C за 4 часа, PA и PC 80 °C, TPU 50 °C — треск и пузырьки это вода"
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
          Влажный филамент: как выглядит печать
        </text>



        {/* Полосы состояния: сухая катушка сверху, влажная снизу */}
        {[
          {
            accent: DRY,
            name: "сухая катушка",
            lines: ["пар не рвёт поток", "пузырей нет", "прочность не теряется"],
          },
          {
            accent: WET,
            name: "влажная катушка",
            lines: ["треск и щелчки из сопла", "пузырьки и «иней»", "стенки рыхлые и слабые"],
          },
        ].map((row, index) => {
          const top = ROW_TOP + index * (ROW_HEIGHT + ROW_GAP);

          return (
            <g key={row.name}>
              <rect
                x="12"
                y={top}
                width="168"
                height={ROW_HEIGHT}
                rx="8"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <rect x="14" y={top + 7} width="3" height={ROW_HEIGHT - 14} rx="1.5" fill={row.accent} />

              {/* Стена детали в разрезе: у влажной внутри пузырьки и капля воды */}
              <rect x="26" y={top + 26} width="14" height="26" rx="1" fill="#64748b" />
              {index === 0 ? (
                <line x1="26" y1={top + 34} x2="40" y2={top + 34} stroke="#cbd5e1" />
              ) : (
                <>
                  <path
                    d={`M33 ${top + 6} C29 ${top + 12} 27 ${top + 16} 33 ${top + 16} C39 ${top + 16} 37 ${top + 12} 33 ${top + 6}`}
                    fill={WET}
                    fillOpacity="0.8"
                  />
                  <circle cx="31" cy={top + 32} r="2.4" fill="#0f172a" />
                  <circle cx="36" cy={top + 40} r="2" fill="#0f172a" />
                  <circle cx="32" cy={top + 45} r="1.8" fill="#0f172a" />
                </>
              )}

              <text x="52" y={top + NAME_Y} fontSize="10" fontWeight="700" fill={row.accent}>
                {row.name}
              </text>
              {row.lines.map((line, lineIndex) => (
                <text key={line} x="52" y={top + LINE_Y[lineIndex]} fontSize="10" fill="#cbd5e1">
                  {line}
                </text>
              ))}
            </g>
          );
        })}

        {/* Таблица сушки: температура и время из подписи блока */}
        <rect x="186" y="22" width="122" height="146" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="196" y="44" fontSize="10" fill="#94a3b8">
          сушка катушки
        </text>
        <line x1="196" y1="52" x2="298" y2="52" stroke="#475569" strokeOpacity="0.7" />
        {DRYING.map((row, index) => {
          const y = TABLE_TOP + index * TABLE_STEP;

          return (
            <g key={row.name}>
              <text x="196" y={y} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {row.name}
              </text>
              <text x="246" y={y} fontSize="10" fill="#cbd5e1">
                {row.value}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
