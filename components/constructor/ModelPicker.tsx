"use client";

import { MODEL_TYPE_LABELS, type ModelType } from "@/lib/constructor/model-types";

/** Карточка модели: значок, подпись и короткое пояснение для выбора. */
type ConstructorModelCard = {
  id: ModelType;
  icon: string;
  title: string;
  note: string;
};

/**
 * Модели в том же порядке, что и разделы панели. Значок помогает узнать
 * инструмент до чтения подписи, а пояснение — понять, что именно собирается.
 */
export const CONSTRUCTOR_MODEL_CARDS: readonly ConstructorModelCard[] = [
  { id: "vase", icon: "🏺", title: MODEL_TYPE_LABELS.vase, note: "Форма и узор" },
  {
    id: "keychain",
    icon: "🔑",
    title: MODEL_TYPE_LABELS.keychain,
    note: "Имя, QR и карман",
  },
  { id: "sign", icon: "🪧", title: MODEL_TYPE_LABELS.sign, note: "Буквы и лента" },
  { id: "box", icon: "📦", title: MODEL_TYPE_LABELS.box, note: "Ячейки и крышка" },
  {
    id: "lithophane",
    icon: "🖼️",
    title: MODEL_TYPE_LABELS.lithophane,
    note: "Фото на просвет",
  },
  { id: "planter", icon: "🪴", title: MODEL_TYPE_LABELS.planter, note: "Дренаж и поддон" },
  { id: "coaster", icon: "☕", title: MODEL_TYPE_LABELS.coaster, note: "Набор и стойка" },
  {
    id: "jewelry_stand",
    icon: "💍",
    title: MODEL_TYPE_LABELS.jewelry_stand,
    note: "Кольца и ожерелья",
  },
  {
    id: "pen_holder",
    icon: "🖊️",
    title: MODEL_TYPE_LABELS.pen_holder,
    note: "Отделения и срез",
  },
  {
    id: "heat_transfer",
    icon: "🖨️",
    title: MODEL_TYPE_LABELS.heat_transfer,
    note: "Логотип и зеркало",
  },
];

type ModelPickerProps = {
  /** Текущая модель: по ней подсвечивается карточка. */
  model: ModelType;
  /** Выбор другой модели: параметры заменяются значениями по умолчанию. */
  onChange: (model: ModelType) => void;
  /** Дополнительные классы сетки: на широком экране это левый рельс. */
  className?: string;
};

/**
 * Выбор модели карточками вместо выпадающего списка.
 *
 * Список из десяти пунктов прятал инструмент за одним нажатием, и человек
 * не видел, что конструктор умеет собирать, пока не откроет select. Карточки
 * показывают все модели сразу, а на мобильном превращаются в горизонтальную
 * ленту — тот же выбор, но без выпадающего меню.
 */
export function ModelPicker({ model, onChange, className }: ModelPickerProps) {
  return (
    <section
      aria-labelledby="model-picker-heading"
      className={
        className
          ? `min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-3 ${className}`
          : "min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-3"
      }
    >
      <div className="flex items-baseline justify-between gap-3 px-1 py-1">
        <h2
          className="text-[0.65rem] font-semibold tracking-wide text-slate-400 uppercase"
          id="model-picker-heading"
        >
          Модель
        </h2>
        <span className="text-[0.65rem] tabular-nums text-slate-500">
          {CONSTRUCTOR_MODEL_CARDS.length}
        </span>
      </div>

      <ul className="mt-2 flex min-w-0 gap-2 overflow-x-auto pb-1 xl:flex-col xl:gap-1.5 xl:overflow-visible xl:pb-0">
        {CONSTRUCTOR_MODEL_CARDS.map((card) => {
          const selected = card.id === model;

          return (
            <li className="min-w-[8.75rem] shrink-0 xl:min-w-0 xl:shrink" key={card.id}>
              <button
                aria-pressed={selected}
                className={`flex h-full min-h-[3.25rem] w-full items-center gap-2.5 rounded-2xl border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  selected
                    ? "border-sky-400/60 bg-sky-400/10 text-white shadow-lg shadow-sky-950/20"
                    : "border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/25 hover:bg-slate-900/60 hover:text-white"
                }`}
                onClick={() => onChange(card.id)}
                title={card.note}
                type="button"
              >
                <span
                  aria-hidden
                  className={`grid size-8 shrink-0 place-items-center rounded-xl text-base ${
                    selected ? "bg-sky-400/15" : "bg-slate-800/80"
                  }`}
                >
                  {card.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs leading-tight font-semibold">
                    {card.title}
                  </span>
                  <span className="mt-0.5 block text-[0.62rem] leading-tight text-slate-400">
                    {card.note}
                  </span>
                </span>
                {selected ? (
                  <span
                    aria-hidden
                    className="grid size-5 shrink-0 place-items-center rounded-full bg-sky-400 text-[0.65rem] font-bold text-slate-950"
                  >
                    ✓
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
