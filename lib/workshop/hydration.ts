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
 * refresh после полной гидратации ошибок не даёт, поэтому обновление ждёт
 * паузы в главном потоке.
 *
 * Одной паузы мало: в повторной серии ошибка приходила через 20–30 мс после
 * `load` (4 из 20 загрузок с сокетом и 0 из 16 без него), то есть `idle`
 * наступал раньше, чем React заканчивал гидратацию. Поэтому refresh ждёт ещё и
 * отметку `markWorkshopHydrated()`: её ставит `WorkshopTabs` в своём эффекте,
 * а эффекты детей выполняются раньше родителя — подписки на Realtime к этому
 * моменту уже созданы, но дерево уже гидрировано целиком.
 *
 * `requestIdleCallback` есть не во всех браузерах (Safari), запасной путь —
 * обычный таймер: обновление придёт чуть позже, но не сломает гидратацию.
 * Задача выполняется не раньше `load`: до него документ ещё разбирается.
 *
 * Возвращённая функция отменяет отложенный вызов — её вызывает эффект в
 * `useEffect` при размонтировании вкладки.
 */
let isHydrated = false;
const hydrationWaiters = new Set<() => void>();

/**
 * Отметка «клиентское дерево мастерской гидрировано».
 *
 * Ставится в `WorkshopTabs` из `useEffect`. React выполняет эффекты детей
 * раньше родителя, поэтому к этому моменту вкладки «Заказы» и «Принтеры» уже
 * подписались на Realtime, а всё клиентское дерево собрано: обновление после
 * отметки не может сорвать гидратацию.
 */
export function markWorkshopHydrated(): void {
  if (isHydrated) {
    return;
  }

  isHydrated = true;

  for (const waiter of hydrationWaiters) {
    waiter();
  }

  hydrationWaiters.clear();
}

/** Вызывает `callback`, когда отметка уже стоит или появится позже. */
function whenHydrated(callback: () => void): () => void {
  if (isHydrated) {
    callback();

    return () => {};
  }

  hydrationWaiters.add(callback);

  return () => {
    hydrationWaiters.delete(callback);
  };
}

export function scheduleWhenHydrated(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  let cancelled = false;
  let cancelIdle: (() => void) | null = null;
  let cancelHydrationWait: (() => void) | null = null;

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

  const waitForHydration = () => {
    if (cancelled) {
      return;
    }

    cancelHydrationWait = whenHydrated(scheduleIdle);
  };

  if (document.readyState === "complete") {
    waitForHydration();
  } else {
    window.addEventListener("load", waitForHydration, { once: true });
  }

  return () => {
    cancelled = true;

    if (cancelIdle) {
      cancelIdle();
    }

    if (cancelHydrationWait) {
      cancelHydrationWait();
    }
  };
}
