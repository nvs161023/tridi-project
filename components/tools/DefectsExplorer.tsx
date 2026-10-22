"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { pluralize } from "@/lib/course-stats";
import {
  DEFECT_CATEGORIES,
  DEFECT_CATEGORY_HINTS,
  DEFECT_CATEGORY_LABELS,
  type Defect,
  type DefectCategory,
} from "@/lib/defects";

type DefectsExplorerProps = {
  defects: Defect[];
};

/** Выбранный фильтр: все дефекты или одна группа. */
type CategoryFilter = "all" | DefectCategory;

/** Формы слова для счётчика: 1 дефект, 2 дефекта, 6 дефектов. */
const DEFECT_FORMS: [string, string, string] = ["дефект", "дефекта", "дефектов"];

/** Цвета карточек: чередуются, чтобы сетка не выглядела однообразной. */
const CARD_ACCENTS = [
  "border-blue-400/25 bg-blue-500/10 text-blue-300",
  "border-violet-400/25 bg-violet-500/10 text-violet-300",
  "border-amber-400/25 bg-amber-500/10 text-amber-300",
  "border-rose-400/25 bg-rose-500/10 text-rose-300",
  "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  "border-cyan-400/25 bg-cyan-500/10 text-cyan-300",
];

/** Треугольник с восклицательным знаком — общий маркер дефекта. */
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3.6 21 19.2H3L12 3.6Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M12 9.4v4.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="16.4" fill="currentColor" r="0.9" />
    </svg>
  );
}

/** Лупа в поле поиска: та же толщина линии, что у остальных иконок. */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <circle
        cx="10.5"
        cy="10.5"
        r="5.8"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m15.2 15.2 4.2 4.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/**
 * Приводит строку к виду для поиска: без регистра, «ё» и лишних пробелов.
 *
 * Без замены «ё» на «е» запрос «сопли» не нашёл бы ««Сопли» и паутина», а без
 * схлопывания пробелов — карточку, где между словами стоит перенос строки.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

/**
 * Каталог дефектов: поиск, фильтр по группам, сетка карточек и модальное окно
 * с причинами и решениями.
 *
 * Клиентский компонент нужен ради поиска и открытия карточки: сами данные
 * приходят из серверной страницы (`lib/defects.ts`), поэтому справочник можно
 * читать и без JavaScript — текст карточек остаётся в HTML.
 *
 * Поиск идёт по названию, описанию и причинам, но не по решениям: решения
 * читают, когда дефект уже опознан, а ищут обычно по симптому. Пустые группы
 * не показываются, а совпадения подсвечивает счётчик с `aria-live`, чтобы
 * скринридер слышал результат без перехода по странице.
 *
 * В модальном окне закрытие работает по Escape, клику по фону и кнопке;
 * фокус переводится на кнопку закрытия и возвращается на карточку после
 * закрытия. Прокрутка страницы под окном блокируется.
 */
export function DefectsExplorer({ defects }: DefectsExplorerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Порядковый номер карточки не зависит от фильтра и поиска: «01»…«06»
  // остаются теми же, что в полном справочнике.
  const orderById = useMemo(
    () => new Map(defects.map((defect, index) => [defect.id, index])),
    [defects],
  );

  // Показываем только группы, в которых есть дефекты: пустая вкладка
  // выглядела бы как ошибка данных, а не как пустая категория.
  const categories = useMemo(
    () =>
      DEFECT_CATEGORIES.filter((id) =>
        defects.some((defect) => defect.category === id),
      ),
    [defects],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<DefectCategory, number>();

    for (const defect of defects) {
      counts.set(defect.category, (counts.get(defect.category) ?? 0) + 1);
    }

    return counts;
  }, [defects]);

  const normalizedQuery = normalize(query);

  // Поиск по названию, описанию и причинам: «стол» находит и отрыв от стола,
  // и смещение слоёв, если стол там упомянут. Решения в поиск не входят.
  const matched = useMemo(() => {
    if (!normalizedQuery) {
      return defects;
    }

    return defects.filter((defect) =>
      [defect.title, defect.description, ...defect.causes].some((text) =>
        normalize(text).includes(normalizedQuery),
      ),
    );
  }, [defects, normalizedQuery]);

  // Группы собираются из уже отфильтрованных карточек, поэтому заголовок и
  // счётчик рядом с ним всегда совпадают с тем, что видно на экране.
  const groups = useMemo(
    () =>
      categories
        .filter((id) => category === "all" || category === id)
        .map((id) => ({
          id,
          label: DEFECT_CATEGORY_LABELS[id],
          hint: DEFECT_CATEGORY_HINTS[id],
          items: matched.filter((defect) => defect.category === id),
        }))
        .filter((group) => group.items.length > 0),
    [categories, category, matched],
  );

  const visibleCount = groups.reduce(
    (total, group) => total + group.items.length,
    0,
  );

  const activeDefect =
    activeId === null
      ? null
      : (defects.find((defect) => defect.id === activeId) ?? null);
  const activeNumber =
    activeDefect === null ? 0 : (orderById.get(activeDefect.id) ?? 0) + 1;

  const closeDialog = useCallback(() => {
    setActiveId(null);
    // Возвращаем фокус на карточку, с которой открыли окно, — иначе после
    // Escape клавиатурный пользователь оказывается в начале страницы.
    window.requestAnimationFrame(() => lastFocusedRef.current?.focus());
  }, []);

  /** Сбрасывает и запрос, и группу: после этого виден весь справочник. */
  const resetFilters = useCallback(() => {
    setQuery("");
    setCategory("all");
  }, []);

  function openDialog(id: string) {
    lastFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    setActiveId(id);
  }

  useEffect(() => {
    if (!activeDefect) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(
      () => closeButtonRef.current?.focus(),
      0,
    );

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [activeDefect, closeDialog]);

  const filters: { id: CategoryFilter; label: string; count: number }[] = [
    { id: "all", label: "Все дефекты", count: defects.length },
    ...categories.map((id) => ({
      id,
      label: DEFECT_CATEGORY_LABELS[id],
      count: categoryCounts.get(id) ?? 0,
    })),
  ];

  return (
    <>
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label
            htmlFor="defect-search"
            className="text-sm font-semibold tracking-wide text-slate-200"
          >
            Поиск по справочнику
          </label>
          <span className="text-xs text-slate-400">
            Название, описание и причины
          </span>
        </div>

        <div className="relative mt-3">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="defect-search"
            type="text"
            role="searchbox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            // Escape очищает запрос: это ожидаемое поведение поиска и оно не
            // мешает диалогу — у того свой обработчик на документе.
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
              }
            }}
            aria-describedby="defect-search-hint"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Например: стринг, стол, мосты"
            spellCheck={false}
            className="min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/60 py-3 pr-12 pl-12 text-base text-white transition-colors placeholder:text-slate-400 focus:border-blue-400/60 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="absolute top-1/2 right-2.5 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                focusable="false"
                viewBox="0 0 20 20"
              >
                <path
                  d="m5 5 10 10M15 5 5 15"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.7"
                />
              </svg>
            </button>
          ) : null}
        </div>

        <p
          id="defect-search-hint"
          className="mt-2 text-xs leading-relaxed text-slate-400"
        >
          Достаточно части слова: «стринг» найдёт стрингинг, а «стол» — все
          дефекты, где стол упомянут в причинах.
        </p>

        <div
          role="group"
          aria-label="Категории дефектов"
          className="mt-4 flex flex-wrap gap-2"
        >
          {filters.map((filter) => {
            const isActive = category === filter.id;

            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setCategory(filter.id)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  isActive
                    ? "border-blue-400/60 bg-blue-500/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-blue-400/40 hover:text-white"
                }`}
              >
                {filter.label}
                <span
                  className={`font-mono text-xs ${
                    isActive ? "text-blue-200" : "text-slate-400"
                  }`}
                >
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm text-slate-300" aria-live="polite">
          {normalizedQuery
            ? visibleCount === 0
              ? "По запросу ничего не нашлось."
              : `Найдено ${visibleCount} ${pluralize(visibleCount, DEFECT_FORMS)} из ${defects.length}.`
            : `В справочнике ${defects.length} ${pluralize(defects.length, DEFECT_FORMS)} — выберите группу или начните вводить название.`}
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center">
          <p className="text-lg font-bold text-white">Ничего не нашлось</p>
          <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-slate-300">
            {normalizedQuery
              ? "По запросу «" + query.trim() + "» совпадений нет. Попробуйте другое слово: «стол», «нить», «слой»."
              : "В этой группе пока нет дефектов."}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <div id="defect-groups" className="mt-8 space-y-10">
          {groups.map((group) => (
            <section
              key={group.id}
              aria-labelledby={"defect-group-" + group.id}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3
                  id={"defect-group-" + group.id}
                  className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
                >
                  {group.label}
                </h3>
                <p className="text-sm text-slate-400">
                  {group.items.length} {pluralize(group.items.length, DEFECT_FORMS)}
                </p>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
                {group.hint}
              </p>

              <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((defect) => {
                  const index = orderById.get(defect.id) ?? 0;
                  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];

                  return (
                    <button
                      key={defect.id}
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => openDialog(defect.id)}
                      className="group flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-left transition duration-200 hover:-translate-y-1 hover:border-blue-400/50 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:p-7"
                    >
                      <span className="flex items-start justify-between gap-4">
                        <span
                          className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${accent}`}
                        >
                          <WarningIcon className="h-6 w-6" />
                        </span>
                        <span className="font-mono text-xs tracking-widest text-slate-400">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </span>

                      <span className="mt-5 block text-xl font-bold tracking-tight text-white sm:text-2xl">
                        {defect.title}
                      </span>

                      <span className="mt-3 block flex-1 text-base leading-relaxed text-slate-200">
                        {defect.description}
                      </span>

                      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 transition-colors group-hover:text-blue-200">
                        Причины и решения
                        <span
                          aria-hidden="true"
                          className="transition-transform duration-200 group-hover:translate-x-1"
                        >
                          →
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {activeDefect ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDialog();
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="defect-dialog-title"
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-slate-950/60 sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-slate-900/95 px-5 py-5 backdrop-blur sm:px-7">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.18em] text-blue-300 uppercase">
                  Дефект {activeNumber} из {defects.length} ·{" "}
                  {DEFECT_CATEGORY_LABELS[activeDefect.category]}
                </p>
                <h2
                  id="defect-dialog-title"
                  className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
                >
                  {activeDefect.title}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeDialog}
                aria-label="Закрыть окно"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200 transition-colors hover:border-blue-400/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  focusable="false"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="m5 5 10 10M15 5 5 15"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.7"
                  />
                </svg>
              </button>
            </div>

            <div className="px-5 py-6 sm:px-7 sm:py-7">
              <p className="text-base leading-relaxed text-slate-200 sm:text-lg">
                {activeDefect.description}
              </p>

              <section className="mt-7" aria-labelledby="defect-causes-title">
                <h3
                  id="defect-causes-title"
                  className="text-lg font-bold text-white sm:text-xl"
                >
                  Почему так происходит
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {activeDefect.causes.map((cause) => (
                    <li
                      key={cause}
                      className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-base leading-relaxed text-slate-200"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                      />
                      <span>{cause}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-7" aria-labelledby="defect-solutions-title">
                <h3
                  id="defect-solutions-title"
                  className="text-lg font-bold text-white sm:text-xl"
                >
                  Что делать по шагам
                </h3>
                <ol className="mt-4 space-y-2.5">
                  {activeDefect.solutions.map((solution, index) => (
                    <li
                      key={solution}
                      className="flex gap-3 rounded-2xl border border-blue-400/15 bg-blue-500/[0.06] px-4 py-3 text-base leading-relaxed text-slate-200"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/20 font-mono text-xs font-bold text-blue-200"
                      >
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{solution}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <p className="mt-7 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.07] px-4 py-3.5 text-sm leading-relaxed text-slate-200 sm:text-base">
                <span className="font-semibold text-emerald-200">Совет:</span>{" "}
                меняйте одну настройку за раз и печатайте короткий тест. Так вы
                поймёте, что именно убрало дефект, а не будете угадывать по
                готовой детали.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
