import type { ReactNode } from "react";

import { lessonOutline } from "@/lib/lesson-outline";
import type { LessonBlock } from "@/lib/types";

/**
 * Раскладка страницы урока: текст слева, оглавление справа.
 *
 * Зачем: раньше урок был одной узкой колонкой по центру (`max-w-3xl`), и на
 * широком мониторе треть ширины слева и справа оставалась пустой — начало каждой
 * строки приходилось искать заново, а сам текст висел посередине экрана. Теперь
 * страница занимает `max-w-6xl`: текст стоит у левого края в колонке шириной
 * 44rem (строка — около 65 знаков, читать не устаёшь), а справа его держит липкое
 * оглавление «В этом уроке» с якорями на блоки.
 *
 * Оглавление — это и есть ориентация внутри урока: видно, сколько разделов
 * впереди, где стоит «Практика» и где «Итоги». Собирается оно в
 * lib/lesson-outline.ts по заголовкам блоков, поэтому новые блоки в данных
 * появляются в нём сами. Меньше трёх заголовков — колонки нет, текст просто
 * занимает всю ширину.
 *
 * Мобильная версия не меняется: сетка включается только с `lg`, оглавление
 * скрыто (`hidden lg:block`), текст занимает всю ширину и стоит в прежних
 * отступах — `px-5 py-12`, с `sm` — `px-8 py-16`.
 *
 * Отступ липкой колонки зависит от шапки: у базового курса шапка липкая
 * (`sticky top-0`) и перекрывает верх страницы, поэтому колонка начинается ниже
 * неё; у платных уровней шапка уезжает вместе с текстом, и колонка идёт от самого
 * верха.
 */
const outlineAccents = {
  blue: "text-blue-300",
  emerald: "text-emerald-300",
  violet: "text-violet-300",
  rose: "text-rose-300",
} as const;

/** Акцент уровня: те же цвета, что у шапки и кнопок урока. */
export type LessonAccent = keyof typeof outlineAccents;

export function LessonLayout({
  blocks,
  accent,
  stickyHeader = false,
  children,
}: {
  /** Блоки, которые реально попадают в разметку: по ним строится оглавление. */
  blocks: LessonBlock[];
  accent: LessonAccent;
  /** Шапка страницы липкая — тогда колонка держит отступ сверху. */
  stickyHeader?: boolean;
  /** Заголовок урока, блоки и кнопки продолжения. */
  children: ReactNode;
}) {
  const outline = lessonOutline(blocks);

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-12 xl:grid-cols-[minmax(0,44rem)_17rem] xl:justify-between xl:gap-14">
        <div id="lesson-top" className="min-w-0 scroll-mt-24">
          {children}
        </div>

        {outline.length > 0 ? (
          <aside
            className={`hidden lg:sticky lg:block ${
              stickyHeader ? "lg:top-28" : "lg:top-8"
            }`}
          >
            <p
              className={`text-xs font-semibold tracking-[0.2em] uppercase ${outlineAccents[accent]}`}
            >
              В этом уроке
            </p>
            <nav
              aria-label="Содержание урока"
              className="mt-4 border-l border-white/10"
            >
              <ol className="space-y-1">
                {outline.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="block rounded-r-xl py-1.5 pl-4 text-sm leading-snug text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <a
              href="#lesson-top"
              className="mt-6 inline-flex items-center gap-2 pl-4 text-sm font-medium text-slate-300 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
            >
              <span aria-hidden>↑</span>
              В начало урока
            </a>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
