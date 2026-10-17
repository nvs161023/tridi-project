import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Шесть шагов: строки 24…130 через 18, высота 16; уточнение — справа у 308. */
const ROW_TOP = 24;
const ROW_STEP = 18;
const ROW_H = 16;
const NUMBER_X = 26;
const TITLE_X = 42;
const NOTE_X = 308;

type Step = { title: string; note: string; color: string };

/** Шесть действий при снятии опоры — блок 30 и описание кадра `C5_detach.png`. */
const STEPS: Step[] = [
  { title: "Дай столу остыть", note: "на горячем деталь ведёт", color: "#3b82f6" },
  { title: "Срежь ножку у основания", note: "кусачки не касаются детали", color: "#3b82f6" },
  { title: "Отведи интерфейс", note: "вдоль поверхности, не вверх", color: "#10b981" },
  { title: "Убери остатки", note: "ножом по касательной", color: "#10b981" },
  { title: "Осмотри нависание", note: "под лампой или на просвет", color: "#f59e0b" },
  { title: "Собери отходы", note: "в отдельную тару у стола", color: "#f59e0b" },
];

const NOTES = [
  "Подошву ведут вдоль поверхности, а не на отрыв",
  "Кусачки: оставь миллиметр у стенки, его снимают ножом",
  "Бокорезы работают лучше плоскогубцев",
  "Отходы — в отдельную тару, стол остаётся чистым",
];

/**
 * Кадр блока 30 урока C5 «Снятие поддержек: порядок действий».
 *
 * Порядок из блока 30 и подсказка описания кадра `C5_detach.png` (кусачки поддевают
 * подошву поддержки сбоку): сначала стол остывает, потому что на горячем столе
 * снимать нельзя — деталь поведёт (блок 30). Потом бокорезами откусывают ножку
 * опоры у самого основания, не касаясь самой детали. Дальше подошву отводят вдоль
 * поверхности: тянуть вверх, на отрыв от детали — значит рвать нависание по слоям.
 * Остатки снимают ножом по касательной, не залезая вглубь, при этом у стенки
 * оставляют миллиметр — кусачками у самой поверхности работать нельзя, а бокорезы
 * вообще удобнее плоскогубцев (блок 29). Затем нависание осматривают под лампой
 * или на просвет, чтобы найти сколы и висящие нити, и собирают отходы в отдельную
 * тару у стола, а не в общий контейнер.
 */
export function ConfidentC5Steps1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Снятие поддержек: порядок действий. Дай столу остыть, на горячем деталь ведёт. Срежь ножку у основания бокорезами, не касаясь детали. Отведи интерфейс, веди вдоль поверхности, а не вверх. Убери остатки ножом по касательной. Осмотри нависание под лампой или на просвет. Собери отходы в отдельную тару у стола. Подошву ведут вдоль поверхности, а не на отрыв. Кусачки: оставь миллиметр у стенки, его снимают ножом. Бокорезы работают лучше плоскогубцев. Отходы — в отдельную тару, стол остаётся чистым"
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
          Снятие поддержек: шесть шагов
        </text>

        {/* Кусачки: ножки расходятся, ручки внизу */}
        <g stroke="#94a3b8" strokeOpacity="0.8">
          <line x1="284" y1="5" x2="296" y2="13" />
          <line x1="296" y1="5" x2="284" y2="13" />
          <line x1="284" y1="13" x2="280" y2="21" />
          <line x1="296" y1="13" x2="300" y2="21" />
        </g>
        <circle cx="280" cy="21.5" r="2" fill="#94a3b8" fillOpacity="0.5" />
        <circle cx="300" cy="21.5" r="2" fill="#94a3b8" fillOpacity="0.5" />

        {/* Шесть шагов: номер, действие и уточнение справа */}
        {STEPS.map((step, index) => {
          const y = ROW_TOP + index * ROW_STEP;
          return (
            <g key={step.title}>
              <rect
                x="12"
                y={y}
                width="296"
                height={ROW_H}
                rx="4"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.45"
              />
              <rect
                x="18"
                y={y + 1}
                width="15"
                height="13"
                rx="3"
                fill={step.color}
                fillOpacity="0.16"
                stroke={step.color}
                strokeOpacity="0.5"
              />
              <text
                x={NUMBER_X}
                y={y + 11}
                fontSize="10"
                fontWeight="700"
                fill={step.color}
                textAnchor="middle"
              >
                {index + 1}
              </text>
              <text x={TITLE_X} y={y + 11} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {step.title}
              </text>
              <text x={NOTE_X} y={y + 11} fontSize="10" fill="#94a3b8" textAnchor="end">
                {step.note}
              </text>
            </g>
          );
        })}

        {/* Что помнить при снятии */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={142 + index * 11}
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
