import type { ReactNode } from "react";

/**
 * Мелкие строительные блоки для юридических документов.
 *
 * Все пять документов раздела /legal устроены одинаково: заголовок, вводный абзац
 * и нумерованные разделы с абзацами и списками. Разметка вынесена сюда, чтобы
 * документы отличались только текстом, а вёрстка (и тёмная тема) была общей.
 */

/** Заголовок документа: название, краткое пояснение и дата обновления. */
export function LegalDocumentHeader({
  title,
  description,
  updatedAt,
}: {
  title: string;
  description: ReactNode;
  updatedAt: string;
}) {
  return (
    <header>
      <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
        {description}
      </p>
      <p className="mt-4 text-sm text-slate-500">
        Редакция от {updatedAt}
      </p>
    </header>
  );
}

/** Нумерованный раздел документа: «3. Категории субъектов и перечень данных». */
export function LegalSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-white/10 pt-8 sm:mt-12">
      <h2 className="text-xl font-bold text-white sm:text-2xl">
        <span aria-hidden className="text-slate-500">
          {number}.{" "}
        </span>
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-300">
        {children}
      </div>
    </section>
  );
}

/** Список внутри раздела (маркеры не мешают, когда пункты — целые фразы). */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6 marker:text-slate-500">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/** Определение понятия: «Персональные данные — любая информация…». */
export function LegalTerm({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <p>
      <span className="font-semibold text-white">{term}</span> — {children}
    </p>
  );
}

/**
 * Блок реквизитов оператора: он заканчивает каждый документ, чтобы у читателя
 * перед глазами были данные того, кому он даёт согласие.
 */
export function LegalRequisites({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="mt-6 grid gap-2 rounded-3xl border border-white/10 bg-white/5 p-6 sm:grid-cols-[auto_1fr] sm:gap-x-6">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-sm font-semibold text-slate-400">{item.label}</dt>
          <dd className="text-sm text-slate-200 sm:text-base">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
