import Link from "next/link";

import { moduleTestThemes } from "@/components/course/module-test-theme";
import { LESSON_FORMS, pluralize } from "@/lib/course-stats";
import type { CourseTestVariant } from "@/lib/module-test";

/**
 * Карточка «Сначала прочитай уроки модуля» — вместо теста модуля.
 *
 * Тест открывается только после того, как прочитаны все уроки модуля, кроме
 * последнего: правила проверки живут в lib/course-access.ts. Здесь показываем,
 * чего не хватает, и ведём прямо в непрочитанный урок — так человек не ищет
 * нужный урок по программе вручную.
 *
 * Карточка общая для урока (там она заменяет ModuleTestGate) и для отдельной
 * страницы теста: оформление берётся из палитры курса, поэтому цвета кнопки и
 * подписей совпадают с остальными блоками уровня.
 */
type ModuleTestLockedProps = {
  courseType: CourseTestVariant;
  /** Подпись модуля: «Модуль 2: Поддержки и мосты». */
  moduleLabel: string;
  /** Ещё не прочитанные уроки модуля в порядке программы. */
  unread: { href: string; label: string }[];
};

export function ModuleTestLocked({
  courseType,
  moduleLabel,
  unread,
}: ModuleTestLockedProps) {
  const theme = moduleTestThemes[courseType];

  // Пустой список сюда не приходит: страницы спрашивают карточку только когда
  // есть непрочитанные уроки. Страховка — чтобы не рисовать пустую кнопку.
  const firstUnread = unread[0];

  return (
    <section
      id="module-test-locked"
      className="scroll-mt-20 rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9"
    >
      <p
        className={`text-sm font-semibold uppercase tracking-widest ${theme.eyebrow}`}
      >
        Проверь себя
      </p>

      <h2 className="mt-3 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
        {moduleLabel}
      </h2>

      <p className="mt-3 text-base leading-relaxed text-slate-300">
        Тест модуля открывается после всех уроков модуля. Осталось{" "}
        {unread.length} {pluralize(unread.length, LESSON_FORMS)} — без них
        проверять ещё нечего.
      </p>

      <ul className="mt-5 space-y-2.5">
        {unread.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-3.5 text-sm font-medium text-slate-200 transition-colors hover:border-white/25 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span>
                <span aria-hidden>📖</span> {item.label}
              </span>
              <span aria-hidden className="text-slate-300">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {firstUnread ? (
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={firstUnread.href} className={theme.primary}>
            Продолжить урок
            <span aria-hidden>→</span>
          </Link>
        </div>
      ) : null}

      <p className="mt-5 text-sm leading-relaxed text-slate-300">
        Тест обязателен: без него следующий модуль закрыт.
      </p>
    </section>
  );
}
