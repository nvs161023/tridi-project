import Link from "next/link";

/**
 * Переход между уроками внизу страницы — «Предыдущий / Следующий».
 *
 * Зачем отдельная навигация, если под блоками уже есть кнопка «Пройти урок»:
 * кнопка отмечает прогресс и ведёт только вперёд, а вернуться к предыдущему
 * уроку или перечитать соседний можно лишь через шапку или программу. Здесь две
 * аккуратные карточки в стиле Vercel: слева предыдущий урок, справа следующий,
 * у каждого — название, чтобы было видно, куда ведёт ссылка.
 *
 * Ссылки не сохраняют прогресс: это навигация, а не завершение урока. Когда
 * соседнего урока нет (первый или последний в курсе), карточка не рисуется —
 * пустая заглушка осталась бы единственным «содержимым» строки.
 */
export type LessonPagerLink = {
  /** Адрес урока. */
  href: string;
  /** Название урока — вторая строка карточки. */
  label: string;
};

type LessonPagerProps = {
  previous: LessonPagerLink | null;
  next: LessonPagerLink | null;
};

export function LessonPager({ previous, next }: LessonPagerProps) {
  if (!previous && !next) {
    return null;
  }

  return (
    <nav
      aria-label="Навигация по урокам"
      className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2"
    >
      {previous ? (
        <PagerCard direction="previous" link={previous} />
      ) : (
        <span aria-hidden className="hidden sm:block" />
      )}
      {next ? (
        <PagerCard direction="next" link={next} />
      ) : (
        <span aria-hidden className="hidden sm:block" />
      )}
    </nav>
  );
}

function PagerCard({
  direction,
  link,
}: {
  direction: "previous" | "next";
  link: LessonPagerLink;
}) {
  const isNext = direction === "next";

  return (
    <Link
      href={link.href}
      className={`group flex flex-col gap-1.5 rounded-2xl border border-white/5 bg-[#0a0a0a] px-5 py-4 shadow-xl transition-colors hover:border-white/20 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] ${
        isNext ? "sm:items-end sm:text-right" : ""
      }`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {isNext ? "Следующий урок →" : "← Предыдущий урок"}
      </span>
      <span className="text-sm font-semibold leading-snug text-zinc-300 transition-colors group-hover:text-white">
        {link.label}
      </span>
    </Link>
  );
}
