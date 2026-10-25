import Link from "next/link";

import {
  LESSON_CARD,
  LESSON_PRIMARY,
} from "@/components/course/lesson-ui";
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
      className={`scroll-mt-20 ${LESSON_CARD}`}
    >
      <p
        className={`text-[11px] font-semibold tracking-[0.16em] uppercase ${theme.eyebrow}`}
      >
        Проверь себя
      </p>

      <h2 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
        {moduleLabel}
      </h2>

      <p className="mt-3 text-[16px] leading-8 text-slate-300 sm:text-[17px]">
        Тест модуля открывается после всех уроков модуля. Осталось{" "}
        {unread.length} {pluralize(unread.length, LESSON_FORMS)} — без них
        проверять ещё нечего.
      </p>

      <ul className="mt-5 space-y-2.5">
        {unread.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              <span>
                <span aria-hidden>📖</span> {item.label}
              </span>
              <span aria-hidden className="text-zinc-500">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {firstUnread ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={firstUnread.href}
            className={`${LESSON_PRIMARY} min-h-12 w-full px-6 sm:w-auto`}
          >
            Продолжить урок
            <span aria-hidden>→</span>
          </Link>
        </div>
      ) : null}

      <p className="mt-5 text-sm leading-relaxed text-zinc-500">
        Тест обязателен: без него следующий модуль закрыт.
      </p>
    </section>
  );
}
