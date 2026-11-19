/**
 * Обновление страницы мастерской после гидратации.
 *
 * Зачем: вкладки «Заказы» и «Принтеры» подписаны на Supabase Realtime и на
 * каждое событие вызывают `router.refresh()`. Страница собирается на сервере,
 * и первое событие может прийти в те первые сотни миллисекунд, когда React ещё
 * гидрирует разметку. Обновление дерева в этот момент ломает гидратацию:
 * в продакшен-сборке React падает с `Minified React error #418`
 * («Hydration failed because the server rendered HTML didn't match the
 * client»), а страница перерисовывается с нуля.
 *
 * Воспроизведено на проде: 6 из 10 загрузок `/dashboard/workshop?demo=1`
 * с открытым WebSocket Supabase; с заблокированным сокетом — 0 из 7. Тот же
 * refresh после полной гидратации ошибок не даёт, поэтому достаточно дождаться
 * первой паузы в главном потоке.
 *
 * `requestIdleCallback` есть не во всех браузерах (Safari), запасной путь —
 * обычный таймер: обновление придёт чуть позже, но не сломает гидратацию.
 * Задача выполняется не раньше `load`: до него документ ещё разбирается.
 *
 * Возвращённая функция отменяет отложенный вызов — её вызывает эффект в
 * `useEffect` при размонтировании вкладки.
 */
export function scheduleWhenHydrated(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  let cancelled = false;
  let cancelIdle: (() => void) | null = null;

  const run = () => {
    if (!cancelled) {
      callback();
    }
  };

  const scheduleIdle = () => {
    if (cancelled) {
      return;
    }

    if (typeof window.requestIdleCallback === "function") {
      // Без timeout: колбэк с таймаутом может выполниться по расписанию,
      // пока главный поток ещё гидратирует разметку, — а нам нужен именно
      // простой. Задержка обновления на десятки миллисекунд безопаснее, чем
      // сорванная гидратация.
      const handle = window.requestIdleCallback(run);

      cancelIdle = () => window.cancelIdleCallback(handle);

      return;
    }

    const handle = window.setTimeout(run, 100);

    cancelIdle = () => window.clearTimeout(handle);
  };

  if (document.readyState === "complete") {
    scheduleIdle();
  } else {
    window.addEventListener("load", scheduleIdle, { once: true });
  }

  return () => {
    cancelled = true;

    if (cancelIdle) {
      cancelIdle();
    }
  };
}
