"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { AgentDownloadButton } from "@/components/workshop/AgentDownloadButton";
import { HelpIcon } from "@/components/workshop/WorkshopIcons";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";

/**
 * Онбординг Мастерской: короткий тур при первом заходе и кнопка «Показать тур
 * снова» для тех, кто хочет пересмотреть.
 *
 * Флаг «видел тур» — `localStorage["workshop_onboarding_seen"]`. Проверка идёт в
 * `useEffect`, а не при отрисовке: localStorage есть только в браузере, и до
 * гидратации ответа нет — иначе разметка сервера и клиента разошлась бы. Поэтому
 * окно монтируется после эффекта, а кнопка перезапуска есть в разметке сразу.
 *
 * Окно рисуется только открытым (как остальные модалки Мастерской): хук
 * `useDialogDismiss` блокирует прокрутку страницы и слушает Escape ровно столько,
 * сколько тур на экране. Портал — в `document.body`, чтобы окно не наследовало
 * `overflow-hidden` шапки.
 *
 * Тур не «продаёт» пакет: он объясняет порядок работы (агент → принтеры → товар
 * → заказ) и честно говорит, что помощь лежит в «Интеграции → Помощь». Поэтому
 * родитель показывает компонент только владельцам пакета: без доступа вкладок
 * «Принтеры» и «Заказы» на странице нет.
 */

const STORAGE_KEY = "workshop_onboarding_seen";

type TourStep = {
  /** Заголовок шага — он же `aria-labelledby` окна. */
  title: string;
  /** Основной текст: ReactNode, чтобы внутрь попадали ссылки и код. */
  body: ReactNode;
  /** Подпись основной кнопки: «Дальше», «Понятно» или «Готово». */
  primaryLabel: string;
  /** На шаге про агент показываем кнопку скачивания EXE. */
  showDownload?: boolean;
};

const STEPS: readonly TourStep[] = [
  {
    title: "Мастерская — центр управления фермой",
    primaryLabel: "Дальше",
    body: (
      <>
        Здесь живут заказы, принтеры, пластик и каталог изделий: всё в одном
        аккаунте, без таблиц и блокнотов. Тур занимает минуту — покажем, с чего
        начать, чтобы первый заказ дошёл до печати.
      </>
    ),
  },
  {
    title: "Сначала скачайте и запустите агент",
    primaryLabel: "Дальше",
    showDownload: true,
    body: (
      <>
        Агент — программа на компьютере рядом с принтерами. Только она видит
        вашу локальную сеть и может отправить файл на печать: браузер до
        принтера в цеху не дотянется. Токен для агента лежит на вкладке
        «Интеграции».
      </>
    ),
  },
  {
    title: "Найдите принтеры в сети",
    primaryLabel: "Понятно",
    body: (
      <>
        Откройте вкладку «Принтеры» и нажмите «Найти принтеры в сети» — агент
        сам обойдёт подсеть и покажет найденные принтеры. Останется дать им
        имена и добавить в парк.
      </>
    ),
  },
  {
    title: "Добавьте первый товар",
    primaryLabel: "Дальше",
    body: (
      <>
        Во вкладке «Товары» нажмите «Добавить товар»: артикул, название, цена и
        файл для печати — 3MF или G-code. Если товар продаётся на площадке,
        сразу добавьте её SKU: по нему заказ с маркетплейса найдёт нужный файл.
      </>
    ),
  },
  {
    title: "Создайте первый заказ",
    primaryLabel: "Дальше",
    body: (
      <>
        Во вкладке «Заказы» нажмите «Создать заказ»: выберите клиента, добавьте
        товар, назначьте принтер и нажмите «В очередь на печать». Перед запуском
        Мастерская попросит подтвердить, что стол свободен.
      </>
    ),
  },
  {
    title: "Готово",
    primaryLabel: "Готово",
    body: (
      <>
        Дальше Мастерская работает сама: агент опрашивает принтеры, двигает
        карточки по Канбану, списывает пластик и часы. Если что-то не сходится,
        откройте «Интеграции → Помощь» — там быстрый старт и FAQ.{" "}
        <Link
          href="/dashboard/workshop/integrations/help"
          className="font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
        >
          Открыть помощь
        </Link>
        .
      </>
    ),
  },
];

/** Показывали ли тур раньше. Ошибка хранилища считается ответом «не видел». */
function hasSeenTour(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Запомнить, что тур показан: без флага он открывался бы при каждом заходе. */
function rememberTourSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Приватный режим или запрет хранилища: тур просто покажется ещё раз.
  }
}

/**
 * Кнопка «Показать тур снова» и само окно.
 *
 * `closeTour` стабилен (`useCallback`): `useDialogDismiss` подписывается на
 * Escape именно на него, и новая функция на каждый рендер переподписывала бы
 * обработчик.
 */
export function WorkshopOnboarding() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!hasSeenTour()) {
      setIsOpen(true);
    }
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
    rememberTourSeen();
  }, []);

  const restartTour = useCallback(() => setIsOpen(true), []);

  return (
    <>
      <button
        type="button"
        onClick={restartTour}
        data-workshop-onboarding-trigger
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
      >
        <HelpIcon className="h-4 w-4 shrink-0" />
        Показать тур снова
      </button>

      {isOpen ? <OnboardingTourDialog onClose={closeTour} /> : null}
    </>
  );
}

/**
 * Модальное окно тура: шесть шагов, прогресс, «Назад» и «Пропустить».
 *
 * Состояние шага живёт внутри окна: при закрытии и повторном открытии тур
 * начинается с первого шага, а не с того, где остановились. Так обещает кнопка
 * «Показать тур снова». Последняя кнопка закрывает окно, а флаг «видел» ставит
 * родитель — любым способом закрытия, включая Escape.
 */
function OnboardingTourDialog({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);

  useDialogDismiss(onClose);

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const stepNumber = stepIndex + 1;

  function handlePrimary() {
    if (isLast) {
      onClose();
      return;
    }

    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workshop-onboarding-title"
        data-workshop-onboarding
        data-workshop-onboarding-step={stepNumber}
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Мастерская · тур
            </p>
            <p className="mt-2 text-xs font-semibold tabular-nums text-zinc-500">
              Шаг {stepNumber} из {STEPS.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть тур"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <div aria-hidden className="mt-4 flex gap-1.5">
          {STEPS.map((item, index) => (
            <span
              key={item.title}
              className={`h-1 flex-1 rounded-full transition-colors ${
                index <= stepIndex ? "bg-blue-500" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        <div aria-live="polite" className="mt-5">
          <h2
            id="workshop-onboarding-title"
            className="text-2xl font-extrabold tracking-tight text-white"
          >
            {step.title}
          </h2>
          <div className="mt-3 text-sm leading-relaxed text-zinc-400">
            <p>{step.body}</p>
          </div>

          {step.showDownload ? (
            <div className="mt-5 flex flex-col items-start gap-2">
              <AgentDownloadButton tone="primary" showHint />
              <p className="text-xs leading-relaxed text-zinc-500">
                Запустите exe на компьютере рядом с принтерами: он создаст{" "}
                <code className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[0.85em] text-blue-200">
                  .env
                </code>{" "}
                рядом с собой. Токен для него лежит на вкладке «Интеграции».
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
          {!isFirst ? (
            <button
              type="button"
              onClick={() =>
                setStepIndex((current) => Math.max(current - 1, 0))
              }
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-5 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              ← Назад
            </button>
          ) : null}

          {!isLast ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] sm:mr-auto"
            >
              Пропустить
            </button>
          ) : null}

          <button
            type="button"
            onClick={handlePrimary}
            autoFocus
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] sm:ml-auto"
          >
            {step.primaryLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
