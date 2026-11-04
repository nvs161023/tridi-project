"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { AgentDownloadButton } from "@/components/workshop/AgentDownloadButton";
import { HelpIcon } from "@/components/workshop/WorkshopIcons";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import { TAB_HELP } from "@/components/workshop/workshop-tab-help";

/**
 * Онбординг Мастерской: два тура и кнопка перезапуска.
 *
 * Короткий тур (`STEPS`, шесть шагов) открывается сам при первом заходе и
 * объясняет порядок запуска: агент → принтеры → товар → заказ. Полный тур
 * (`FULL_TOUR_STEPS`, десять шагов) проходит по всем вкладкам и всплывает только
 * по нажатию: мастеру, который зашёл выдать заказ, окно на десять шагов при
 * каждом заходе мешало бы.
 *
 * «Показать тур снова» запускает полный тур, а не короткий: короткий мастер уже
 * видел на первом заходе, а полный — нет. Так в шапке остаётся одна кнопка вместо
 * двух, которые делали бы одно и то же. Найти расширенный тур можно и из
 * короткого: на последнем шаге есть CTA, который закрывает короткий и сразу
 * открывает полный.
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
 * Вид кнопки тура в шапке Мастерской — общий для одной кнопки, которая запускает
 * полный тур.
 *
 * `whitespace-nowrap` обязателен: на 375px подпись «Показать тур снова» иначе
 * ломается на две строки, кнопка становится вдвое выше соседней «Скачать
 * TriDiAgent.exe», и ряд в шапке выглядит рваным.
 */
const TOUR_TRIGGER_CLASSES =
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]";

/**
 * Кнопка «Показать тур снова» и оба окна.
 *
 * Кнопка открывает полный тур: короткий показывается один раз — сам при первом
 * заходе. Оба окна живут в одном компоненте, потому что CTA последнего шага
 * короткого тура переключает его на полный: два независимых компонента пришлось
 * бы связывать пропсами через страницу, а она серверная.
 *
 * `closeShortTour`, `closeFullTour`, `openFullTour` стабильны (`useCallback`):
 * `useDialogDismiss` подписывается на Escape именно на них, и новая функция на
 * каждый рендер переподписывала бы обработчик.
 *
 * `hasSeenFullTour` начинается с `false`: до гидратации localStorage недоступен,
 * и чтение в `useState` развело бы разметку сервера и клиента. Разница видна
 * только в `title` кнопки, поэтому мигания нет.
 *
 * `data-workshop-full-tour-trigger` — метка для скриптов аудита. Прежний атрибут
 * `data-workshop-onboarding-trigger` остаётся на той же кнопке: старые проверки
 * ищут именно его и не должны «слепнуть» после слияния двух кнопок в одну.
 */
export function WorkshopTours() {
  const [activeTour, setActiveTour] = useState<"short" | "full" | null>(null);
  const [hasSeenFullTour, setHasSeenFullTour] = useState(false);

  useEffect(() => {
    setHasSeenFullTour(hasSeenTour(FULL_TOUR_STORAGE_KEY));

    if (!hasSeenTour(STORAGE_KEY)) {
      setActiveTour("short");
    }
  }, []);

  const closeShortTour = useCallback(() => {
    setActiveTour(null);
    rememberTourSeen(STORAGE_KEY);
  }, []);

  /** CTA последнего шага: короткий тур закрывается, полный открывается сразу. */
  const switchToFullTour = useCallback(() => {
    rememberTourSeen(STORAGE_KEY);
    setActiveTour("full");
  }, []);

  const closeFullTour = useCallback(() => {
    setActiveTour(null);
    setHasSeenFullTour(true);
    rememberTourSeen(FULL_TOUR_STORAGE_KEY);
  }, []);

  const openFullTour = useCallback(() => setActiveTour("full"), []);

  return (
    <>
      <button
        type="button"
        onClick={openFullTour}
        data-workshop-full-tour-trigger
        data-workshop-onboarding-trigger
        title={
          hasSeenFullTour
            ? "Пройти полный тур ещё раз"
            : "Полный тур по всем вкладкам Мастерской"
        }
        className={TOUR_TRIGGER_CLASSES}
      >
        <HelpIcon className="h-4 w-4 shrink-0" />
        Показать тур снова
      </button>

      {activeTour === "short" ? (
        <TourDialog
          steps={STEPS}
          label="Мастерская · тур"
          titleId="workshop-onboarding-title"
          dataTour="short"
          onClose={closeShortTour}
          finalSecondaryAction={{
            label: "Пройти полный тур по всем вкладкам",
            onClick: switchToFullTour,
          }}
        />
      ) : null}

      {activeTour === "full" ? (
        <TourDialog
          steps={FULL_TOUR_STEPS}
          label="Мастерская · полный тур"
          titleId="workshop-full-tour-title"
          dataTour="full"
          onClose={closeFullTour}
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
 *
 * Мобильная вёрстка: окно занимает не больше 90vw в ширину и 80vh в высоту, а
 * внутри — три части. Шапка с «✕» и полоса кнопок не прокручиваются, крутится
 * только текст шага: на 375×667 «Дальше» остаётся на месте, даже если шаг
 * длинный. Окно растягивается по контенту, но не на весь экран, а прокрутка
 * внутри `min-h-0 flex-1` не даёт кнопкам уехать за нижний край.
 *
 * `finalSecondaryAction` — кнопка-мостик на последнем шаге. Её передаёт только
 * короткий тур: «Пройти полный тур по всем вкладкам» закрывает короткий и сразу
 * открывает полный, чтобы мастер узнал о расширенном туре, не разыскивая его в
 * шапке.
 */
function TourDialog({
  steps,
  label,
  titleId,
  dataTour,
  onClose,
  finalSecondaryAction,
}: {
  steps: readonly TourStep[];
  /** Надпись над счётчиком шагов: «Мастерская · тур». */
  label: string;
  /** id заголовка для `aria-labelledby`: у туров он свой. */
  titleId: string;
  /** Метка тура в `data-`-атрибутах — для тестов и отладки. */
  dataTour: "short" | "full";
  /** Вторая кнопка на последнем шаге: переход к полному туру. */
  finalSecondaryAction?: { label: string; onClick: () => void };
  onClose: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const textRef = useRef<HTMLDivElement>(null);

  useDialogDismiss(onClose);

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const stepNumber = stepIndex + 1;

  // Новый шаг читается с начала: после длинного абзаца прокрутка осталась бы
  // внизу, и заголовок следующего шага оказался бы за верхней границей.
  useEffect(() => {
    textRef.current?.scrollTo({ top: 0 });
  }, [stepIndex]);

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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-workshop-onboarding
        data-workshop-onboarding-step={stepNumber}
        data-workshop-tour={dataTour}
        className="flex max-h-[80vh] w-[min(90vw,36rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl shadow-black/60"
      >
        {/* Шапка и прогресс закреплены: «✕» и «Шаг N из 10» видны всегда. */}
        <div className="shrink-0 px-4 pt-4 sm:px-8 sm:pt-6">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-blue-400 uppercase sm:text-xs">
                {label}
              </p>
              <p className="mt-1.5 text-xs font-semibold tabular-nums text-zinc-500">
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

          <div aria-hidden className="mt-3 flex gap-1.5 sm:mt-4">
            {steps.map((item, index) => (
              <span
                key={item.title}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  index <= stepIndex ? "bg-blue-500" : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Крутится только текст шага: кнопки ниже остаются на месте. */}
        <div
          ref={textRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-8 sm:py-5"
        >
          <div aria-live="polite">
            <h2
              id={titleId}
              className="text-xl font-extrabold tracking-tight text-white sm:text-2xl"
            >
              {step.title}
            </h2>
            <div className="mt-2.5 text-sm leading-relaxed text-zinc-400 sm:mt-3">
              <p>{step.body}</p>
            </div>

            {step.showDownload ? (
              <div className="mt-4 flex flex-col items-start gap-2 sm:mt-5">
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
        </div>

        {/*
          Полоса кнопок вне прокрутки — «Назад / Пропустить / Дальше» не уезжают
          за край. На узком экране они стоят в один ряд (три кнопки в колонку
          съедали бы пол-экрана), а длинный CTA полного тура занимает отдельную
          строку через `order-first` и `w-full`.
        */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/10 bg-[#0a0a0a] px-4 py-3.5 sm:gap-3 sm:px-8 sm:py-5">
          {!isFirst ? (
            <button
              type="button"
              onClick={() =>
                setStepIndex((current) => Math.max(current - 1, 0))
              }
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] sm:px-5"
            >
              ← Назад
            </button>
          ) : null}

          {!isLast ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-2.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] sm:px-3"
            >
              Пропустить
            </button>
          ) : null}

          {isLast && finalSecondaryAction ? (
            <button
              type="button"
              onClick={finalSecondaryAction.onClick}
              className="order-first inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 text-center text-xs font-semibold text-blue-100 transition-colors hover:border-blue-400/50 hover:bg-blue-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] sm:order-none sm:w-auto"
            >
              {finalSecondaryAction.label}
            </button>
          ) : null}

          <button
            type="button"
            onClick={handlePrimary}
            autoFocus
            className="ml-auto inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] sm:px-6"
          >
            {step.primaryLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
