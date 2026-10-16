import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре карточки 2 × 2: 12…158 и 162…308, ряды 20 и 62. */
const CARD_X = [12, 162];
const CARD_Y = [20, 62];
const CARD_W = 146;
const CARD_H = 40;
const TEXT_X = 12;

const LEAD = "на первом слое — стоп; выше решает расчёт";
const LEAD_NOTE = "нерабочая сторона и 20–30 мин — допечатывай";
const NOTES = [
  "взгляды: 20–30 %, 60–80 % и последние 5–10 %",
  "решение записать в журнал · стоп — если зона нагрузки",
];

type Case = { name: string; action: string; color: string };

/** Четыре сценария сбоя и короткое действие на каждый. */
const CASES: Case[] = [
  { name: "отклеился угол", action: "стоп: чистая плита и кайма", color: "#f87171" },
  { name: "ступенька слоёв", action: "механика: ремни и люфт", color: "#f59e0b" },
  { name: "провис моста", action: "обдув и скорость моста", color: "#f59e0b" },
  { name: "пропуски подачи", action: "радиатор и откат", color: "#38bdf8" },
];

/**
 * Кадр блока 21 урока L8 «Если процесс пошёл не так: четыре сценария».
 *
 * Четыре карточки: отклеился угол, ступенька слоёв, провис моста и пропуски
 * подачи — и короткое действие на каждый. Снизу правило из блока 22: на первом
 * слое останавливаются почти всегда, выше середины решение считают по двум
 * вопросам, контрольные взгляды делают на 20–30 %, 60–80 % и 5–10 % высоты.
 *
 * Числа — из блоков 20 и 22: три контрольных взгляда, снимок на 30 % и 80 %,
 * «осталось 20–30 минут и дефект на нерабочей стороне — допечатывай».
 */
export function Basic8Diagram3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Если процесс пошёл не так: четыре сценария. Отклеился угол — стоп, чистая плита и кайма. Ступенька слоёв — механика: ремни и люфт. Провис моста — обдув и скорость моста. Пропуски подачи — радиатор хотэнда и откат. Правило: на первом слое останавливайся почти всегда, а выше середины решение считается, а не чувствуется. Контрольные взгляды: на 20–30 процентах высоты, на 60–80 и на последних 5–10 процентах. Решение записывают в журнал"
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
          Если процесс пошёл не так: четыре сценария
        </text>

        {/* Сценарии сбоя и действие на каждый */}
        {CASES.map((item, index) => {
          const x0 = CARD_X[index % 2];
          const y0 = CARD_Y[Math.floor(index / 2)];
          return (
            <g key={item.name}>
              <rect
                x={x0}
                y={y0}
                width={CARD_W}
                height={CARD_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text
                x={x0 + TEXT_X}
                y={y0 + 17}
                fontSize="10"
                fontWeight="700"
                fill={item.color}
              >
                {item.name}
              </text>
              <text x={x0 + TEXT_X} y={y0 + 30} fontSize="10" fill="#94a3b8">
                {item.action}
              </text>
            </g>
          );
        })}

        {/* Правило остановки и журнал */}
        <rect
          x="12"
          y="106"
          width="296"
          height="24"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="118" fontSize="10" fontWeight="700" fill="#e2e8f0">
          {LEAD}
        </text>
        <text x="22" y="128" fontSize="10" fill="#94a3b8">
          {LEAD_NOTE}
        </text>
        {NOTES.map((note, index) => (
          <g key={note}>
            <rect
              x="12"
              y={134 + index * 24}
              width="296"
              height={index === 1 ? 18 : 20}
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text x="22" y={147 + index * 24} fontSize="10" fill="#94a3b8">
              {note}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
