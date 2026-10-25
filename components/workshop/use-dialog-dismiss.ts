"use client";

import { useEffect } from "react";

/**
 * Общее поведение модальных окон Мастерской.
 *
 * Escape закрывает окно, а страница под ним не прокручивается — так же сделаны
 * остальные окна проекта. Хук рассчитан на окно, которое монтируется только
 * открытым: родитель рисует его по условию, поэтому и состояние формы, и
 * подписка на Escape живут ровно столько, сколько окно на экране.
 *
 * `onClose` должен быть стабильным (useCallback): иначе эффект переподписывается
 * на каждое изменение состояния формы.
 *
 * `isTopmost` нужен окну, открытому поверх другого: Escape обрабатывается в
 * фазе перехвата и не доходит до нижнего окна. Без флага Escape закрывал бы обе
 * модалки сразу — например, правку заказа и карточку под ней.
 */
export function useDialogDismiss(
  onClose: () => void,
  { isTopmost = false }: { isTopmost?: boolean } = {},
) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (isTopmost) {
        event.stopPropagation();
      }

      onClose();
    }

    if (isTopmost) {
      document.addEventListener("keydown", handleKeyDown, true);

      return () =>
        document.removeEventListener("keydown", handleKeyDown, true);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTopmost, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
}
