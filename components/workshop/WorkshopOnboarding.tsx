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
import { TAB_HELP } from "@/components/workshop/workshop-tab-help";

/**
 * Онбординг Мастерской: два тура и кнопка «Показать тур снова».
 *
 * Короткий тур (`WorkshopOnboarding`, шесть шагов) открывается сам при первом
 * заходе и объясняет порядок запуска: агент → принтеры → товар → заказ. Полный
 * тур (`WorkshopFullTour`, десять шагов) проходит по всем вкладкам и запускается
 * кнопкой «Полный тур» — сам он не всплывает: мастеру, который зашёл выдать
 * заказ, окно на десять шагов только мешает.
 *
 * Флаги «видел тур» — `localStorage["workshop_onboarding_seen"]` и
 * `localStorage["workshop_full_tour_seen"]`. Проверка идёт в `useEffect`, а не при
 * отрисовке: localStorage есть только в браузере, и до гидратации ответа нет —
 * иначе разметка сервера и клиента разошлась бы. Поэтому окно монтируется после
 * эффекта, а кнопка перезапуска есть в разметке сразу.
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
 *
 * Тексты шагов полного тура — из `TAB_HELP`, того же файла, что кормит подсказки
 * «?» на вкладках: тур и поповер не могут разойтись.
 */

const STORAGE_KEY = "workshop_onboarding_seen";

/** Флаг полного тура: по нему подсказка у кнопки знает, что тур уже проходили. */
const FULL_TOUR_STORAGE_KEY = "workshop_full_tour_seen";

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

/**
 * Полный тур по всем вкладкам: восемь разделов, шаг про агента и финал.
 *
 * Шаги про вкладки собираются из `TAB_HELP` — те же абзацы, что открывает «?» в
 * шапке вкладки. Порядок повторяет сайдбар: заказы (с них начинается работа),
 * справочники, настройки, интеграции. Восьмой шаг показывает кнопку скачивания:
 * на вкладке «Интеграции» лежит и токен агента, и exe.
 */
const FULL_TOUR_STEPS: readonly TourStep[] = [
  ...(
    [
      "orders",
      "products",
      "inventory",
      "printers",
      "clients",
      "calculator",
      "requisites",
    ] as const
  ).map((id) => ({
    title: TAB_HELP[id].title,
    body: TAB_HELP[id].text,
    primaryLabel: "Дальше",
  })),
  {
    title: TAB_HELP.integrations.title,
    body: (
      <>
        {TAB_HELP.integrations.text}{" "}
        <Link
          href="/dashboard/workshop/integrations/help"
          className="font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
        >
          Открыть инструкцию и FAQ
        </Link>
        .
      </>
    ),
    primaryLabel: "Дальше",
    showDownload: true,
  },
  {
    title: TAB_HELP.agent.title,
    body: (
      <>
        {TAB_HELP.agent.text}{" "}
        <Link
          href="/dashboard/workshop/integrations/help"
          className="font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
        >
          Открыть помощь
        </Link>
        .
      </>
    ),
    primaryLabel: "Дальше",
  },
  {
    title: "Готово",
    body: (
      <>
        Теперь вы знаете, как работает Мастерская. Если что-то непонятно —
        загляните в «Интеграции → Помощь» (FAQ с 22 вопросами). Возле названия
        вкладки есть кнопка «?»: она открывает эту же подсказку, не запуская
        тур.
      </>
    ),
    primaryLabel: "Готово",
  },
];

/** Показывали ли тур раньше. Ошибка хранилища считается ответом «не видел». */
function hasSeenTour(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

/** Запомнить, что тур показан: без флага он открывался бы при каждом заходе. */
function rememberTourSeen(key: string) {
  try {
    window.localStorage.setItem(key, "true");
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
    if (!hasSeenTour(STORAGE_KEY)) {
      setIsOpen(true);
    }
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
    rememberTourSeen(STORAGE_KEY);
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

      {isOpen ? (
        <TourDialog
          steps={STEPS}
          label="Мастерская · тур"
          titleId="workshop-onboarding-title"
          dataTour="short"
          onClose={closeTour}
        />
      ) : null}
    </>
  );
}

/**
 * Кнопка «Полный тур»: десять шагов по всем вкладкам Мастерской.
 *
 * Сам тур не всплывает — только по нажатию: короткий тур уже объяснил запуск, а
 * окно на десять шагов при каждом заходе раздражало бы. Флаг
 * `workshop_full_tour_seen` пишется при любом закрытии (Escape, «Пропустить»,
 * последний шаг) и меняет только подсказку кнопки: мастер видит, что тур уже
 * проходил, но может вернуться.
 *
 * `hasSeen` начинается с `false`: до гидратации localStorage недоступен, и
 * чтение в `useState` развело бы разметку сервера и клиента. Разница видна
 * только в `title` кнопки, поэтому мигания нет.
 */
export function WorkshopFullTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeen, setHasSeen] = useState(false);

  useEffect(() => {
    setHasSeen(hasSeenTour(FULL_TOUR_STORAGE_KEY));
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
    setHasSeen(true);
    rememberTourSeen(FULL_TOUR_STORAGE_KEY);
  }, []);

  const restartTour = useCallback(() => setIsOpen(true), []);

  return (
    <>
      <button
        type="button"
        onClick={restartTour}
        data-workshop-full-tour-trigger
        title={
          hasSeen
            ? "Пройти полный тур ещё раз"
            : "Полный тур по всем вкладкам Мастерской"
        }
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
      >
        <HelpIcon className="h-4 w-4 shrink-0" />
        Полный тур
      </button>

      {isOpen ? (
        <TourDialog
          steps={FULL_TOUR_STEPS}
          label="Мастерская · полный тур"
          titleId="workshop-full-tour-title"
          dataTour="full"
          onClose={closeTour}
        />
      ) : null}
    </>
  );
}

/**
 * Модальное окно тура: шаги, прогресс, «Назад» и «Пропустить».
 *
 * Одно окно на оба тура: `steps` приходит от родителя, поэтому счётчик честно
 * показывает «Шаг N из 6» в коротком туре и «Шаг N из 10» в полном — без второй
 * копии разметки, которая разъехалась бы при первой же правке.
 *
 * Состояние шага живёт внутри окна: при закрытии и повторном открытии тур
 * начинается с первого шага, а не с того, где остановились. Так обещает кнопка
 * перезапуска. Последняя кнопка закрывает окно, а флаг «видел» ставит родитель —
 * любым способом закрытия, включая Escape.
 */
function TourDialog({
  steps,
  label,
  titleId,
  dataTour,
  onClose,
}: {
  steps: readonly TourStep[];
  /** Надпись над счётчиком шагов: «Мастерская · тур». */
  label: string;
  /** id заголовка для `aria-labelledby`: у туров он свой. */
  titleId: string;
  /** Метка тура в `data-`-атрибутах — для тестов и отладки. */
  dataTour: "short" | "full";
  onClose: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);

  useDialogDismiss(onClose);

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const stepNumber = stepIndex + 1;

  function handlePrimary() {
    if (isLast) {
      onClose();
      return;
    }

    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
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
        aria-labelledby={titleId}
        data-workshop-onboarding
        data-workshop-onboarding-step={stepNumber}
        data-workshop-tour={dataTour}
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              {label}
            </p>
            <p className="mt-2 text-xs font-semibold tabular-nums text-zinc-500">
              Шаг {stepNumber} из {steps.length}
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
          {steps.map((item, index) => (
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
            id={titleId}
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
