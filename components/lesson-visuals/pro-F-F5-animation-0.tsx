import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Одиннадцать мест на плите: деталь в центре стоит изначально, сетка — вокруг. */
const slots = [
  { x: 114, y: 64 },
  { x: 22, y: 36 },
  { x: 68, y: 36 },
  { x: 114, y: 36 },
  { x: 160, y: 36 },
  { x: 22, y: 64 },
  { x: 68, y: 64 },
  { x: 160, y: 64 },
  { x: 45, y: 92 },
  { x: 91, y: 92 },
  { x: 137, y: 92 },
];

/**
 * Кадры появления: каждая следующая деталь «доезжает» чуть позже предыдущей,
 * а к концу цикла плита снова пустеет до одной детали. Ключевые кадры для
 * каждой детали свои — с общим animation-delay сдвинулся бы весь цикл.
 */
const FILL_STYLES = slots
  .slice(1)
  .map((_, index) => {
    const start = 12 + index * 6;
    return `          .v-ff5a-p${index} { animation: v-ff5a-p${index} 6s ease-out infinite; transform-box: fill-box; transform-origin: center; }
          @keyframes v-ff5a-p${index} {
            0%, ${start}% { opacity: 0; transform: scale(0.6); }
            ${start + 8}%, 90% { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(0.6); }
          }`;
  })
  .join("\n");

/**
 * Заполнение стола — та же сетка, что и в кадре «Массив деталей», но живая: на
 * плите стоит одна деталь, потом по одной доезжают остальные, а справа видно,
 * что печать по одной — это часы, а вся плита сразу — один прогон.
 *
 * Ровно по content урока: «печать двадцати мелких деталей по одной — часы,
 * печать всех сразу — экономия времени и электричества», «1 деталь → двадцать
 * деталей в сетке» и «экономия времени: 20 часов → 1 час». Деталей в кадре
 * одиннадцать, а не двадцать: больше на 320×180 не читается (числа времени при
 * этом из урока — они и есть смысл кадра).
 *
 * От «Сопло наращивает модель слой за слоем» из базового урока 1 отличается
 * предметом: там процесс печати одной детали в разрезе, здесь заполнение всей
 * плиты копиями и время.
 *
 * Анимация 6 с, по кругу: одна деталь, наполнение плиты, полная плита, сброс.
 * При prefers-reduced-motion показана полная плита.
 *
 * Классы с префиксом v-ff5a: <style> внутри SVG действует на всю страницу.
 */
export function ProFF5Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: на плите сначала одна деталь, потом по одной доезжают остальные и заполняют всю плиту сеткой; справа показано время — печать по одной двадцать часов, вся плита сразу один час"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-ff5a-chip { animation: v-ff5a-chip 6s ease-in-out infinite; }
          @keyframes v-ff5a-chip {
            0%, 30% { opacity: 0.5; }
            45%, 90% { opacity: 1; }
            100% { opacity: 0.5; }
          }
${FILL_STYLES}
          @media (prefers-reduced-motion: reduce) {
            .v-ff5a-part, .v-ff5a-chip { animation: none; }
            .v-ff5a-part { opacity: 1; transform: none; }
            .v-ff5a-chip { opacity: 1; }
          }
        `}</style>

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

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          одна деталь или вся плита сразу
        </text>

        {/* Плита и сетка: первая деталь стоит всегда, остальные доезжают */}
        <rect x="12" y="22" width="200" height="116" rx="6" fill="#0f172a" stroke="#475569" />
        {slots.map((slot, index) => (
          <g
            key={`slot-${slot.y}-${slot.x}`}
            className={index === 0 ? "v-ff5a-part" : `v-ff5a-part v-ff5a-p${index - 1}`}
          >
            <rect x={slot.x} y={slot.y} width="30" height="16" rx="3" fill="#475569" stroke="#94a3b8" />
            <circle cx={slot.x + 15} cy={slot.y + 8} r="3" fill="#1e293b" stroke="#94a3b8" />
          </g>
        ))}

        {/* Время: по одной — часы, вся плита сразу — один прогон */}
        <rect x="222" y="22" width="86" height="116" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="228" y="44" fontSize="9" fill="#94a3b8">
          по одной
        </text>
        <text x="228" y="66" fontSize="16" fontWeight="bold" fill="#fdba74">
          20 ч
        </text>
        <text x="228" y="94" fontSize="9" fill="#94a3b8">
          все сразу
        </text>
        <rect className="v-ff5a-chip" x="226" y="102" width="78" height="26" rx="8" fill="#0f172a" stroke="#34d399" />
        <text x="230" y="121" fontSize="16" fontWeight="bold" fill="#6ee7b7">
          1 ч
        </text>

        <text x="12" y="156" fontSize="10" fill="#e2e8f0">
          печать по одной — часы, вся плита — разом
        </text>
        <text x="12" y="172" fontSize="9" fill="#94a3b8">
          важно правильно расположить детали
        </text>

      </svg>
    </VisualWrapper>
  );
}
