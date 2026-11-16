import Link from "next/link";

import {
  GALLERY_CATEGORY_PARAM,
  GENERATION_CATEGORIES,
  type GenerationCategory,
} from "@/lib/generator/categories";

/**
 * Фильтр галереи: «Все» и по таблетке на категорию.
 *
 * Выбор живёт в адресе (`/gallery?category=toy`), а не в состоянии React:
 * страница серверная и собирается на каждый запрос, поэтому ссылку можно
 * открыть в новой вкладке, отправить другу и обновить без потери фильтра.
 * Список категорий — общий с генератором и карточкой
 * (`GENERATION_CATEGORIES`), отдельного набора для фильтра нет.
 *
 * Это обычные ссылки: клиентский JS для переключения не нужен, а клавиатура и
 * средняя кнопка мыши работают как везде.
 */

/** Активная таблетка: заметная, но не спорит с карточками по контрасту. */
const ACTIVE_CLASS =
  "inline-flex min-h-9 items-center rounded-full border border-fuchsia-400/60 bg-gradient-to-r from-fuchsia-500/25 to-blue-500/25 px-4 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none";

const INACTIVE_CLASS =
  "inline-flex min-h-9 items-center rounded-full border border-white/12 bg-white/5 px-4 text-sm font-semibold text-zinc-300 transition-colors hover:border-white/30 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none";

export function GalleryCategoryFilter({
  active,
}: {
  /** `null` — вкладка «Все». */
  active: GenerationCategory | null;
}) {
  return (
    <nav aria-label="Фильтр по категории" className="mt-6 flex flex-wrap gap-2">
      <Link
        aria-current={active ? undefined : "page"}
        className={active ? INACTIVE_CLASS : ACTIVE_CLASS}
        href="/gallery"
      >
        Все
      </Link>

      {GENERATION_CATEGORIES.map((category) => {
        const isActive = category.value === active;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={isActive ? ACTIVE_CLASS : INACTIVE_CLASS}
            href={`/gallery?${GALLERY_CATEGORY_PARAM}=${category.value}`}
            key={category.value}
            title={category.hint ? `${category.label}: ${category.hint}` : category.label}
          >
            {category.shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}
