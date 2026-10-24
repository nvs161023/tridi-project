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
 */
export function useDialogDismiss(onClose: () => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
}
