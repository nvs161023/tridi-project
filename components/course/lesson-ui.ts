/**
 * Оформление страницы урока — один набор классов на все четыре уровня.
 *
 * Зачем отдельный модуль: карточки блоков, кнопки перехода и подписи живут в
 * разных компонентах (`LessonBlocks`, `MiniCheck`, `CompleteButton`,
 * `ModuleTestGate`, `LessonPager`), и без общего набора они разъезжаются по
 * цвету и радиусу. Здесь тот же рецепт, что у карточек кабинета и Мастерской:
 * тёмная поверхность `#0a0a0a`, тонкая рамка `white/5`, мягкая тень.
 *
 * Кнопки: главное действие — белая кнопка с чёрным текстом, второстепенное —
 * тёмная с обводкой. Это правило Мастерской от 25.10, и на странице урока оно
 * одно на все уровни: акцент курса остаётся только в подписях и полосе
 * прогресса, а действие всегда читается одинаково.
 */
export const LESSON_CARD =
  "rounded-2xl border border-white/5 bg-[#0a0a0a] p-6 shadow-xl sm:p-8";

/** Главное действие страницы урока: белая кнопка с чёрным текстом. */
export const LESSON_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-white text-base font-bold text-black shadow-[0_16px_40px_-16px_rgba(255,255,255,0.45)] transition-all duration-300 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-70";

/** Второстепенное действие: тёмная кнопка с обводкой. */
export const LESSON_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-base font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";

/** Подпись над заголовком: «МОДУЛЬ 1», «ПРОВЕРЬ СЕБЯ». */
export const LESSON_EYEBROW =
  "text-[11px] font-semibold tracking-[0.16em] text-zinc-500 uppercase";
