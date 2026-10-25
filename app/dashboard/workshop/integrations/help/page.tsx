import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Header } from "@/components/Header";

/**
 * Инструкция по подключению уведомлений маркетплейсов.
 *
 * Страница статическая: она ничего не читает из базы и не знает персональных
 * адресов вебхука. Поэтому вместо готовых URL здесь шаги «скопируйте адрес в
 * блоке „Интеграции“» — так инструкция не устаревает и не показывает чужие
 * данные. На неё ссылается кнопка «Как подключить?» во вкладке «Интеграции».
 *
 * Разделы идут в том же порядке, что карточки площадок: Ozon, Wildberries,
 * Яндекс.Маркет. У каждого свой `id` (`#ozon`, `#wb`, `#yandex`), чтобы на
 * раздел можно было сослаться из переписки с поддержкой.
 *
 * `noindex`: страница внутренняя и открывается только после входа — её не
 * нужно показывать поисковым системам.
 */

export const metadata: Metadata = {
  title: "Как подключить уведомления — TriDi",
  description:
    "Пошаговые инструкции по подключению уведомлений Ozon, Wildberries и Яндекс.Маркета к Мастерской TriDi: где взять Client-Id и Api-Key, куда вставить URL вебхука и какое событие включить.",
  robots: { index: false, follow: false },
};

type Guide = {
  /** Якорь раздела: `#ozon`, `#wb`, `#yandex`. */
  id: string;
  /** Заголовок раздела — как называется площадка в карточке «Интеграций». */
  name: string;
  /** Одно предложение о том, что понадобится. */
  lead: string;
  /** Шаги по порядку; код внутри шага подсвечивается через `Code`. */
  steps: readonly ReactNode[];
};

/** Код внутри шага: та же monospace-плашка, что и в подсказках вкладки. */
function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[0.85em] text-blue-200">
      {children}
    </code>
  );
}

const GUIDES: readonly Guide[] = [
  {
    id: "ozon",
    name: "Ozon",
    lead: "Для Ozon нужны ключи Seller API и персональный адрес вебхука: по нему площадка сообщает о новых отправлениях.",
    steps: [
      <>
        В личном кабинете Ozon Seller перейдите в «Настройки» → «Seller API».
      </>,
      <>Скопируйте Client-Id.</>,
      <>
        Нажмите «Сгенерировать ключ», выберите роль{" "}
        <Code>Posting FBS read-only</Code> (или <Code>Admin</Code>, если хотите
        управлять заказами), скопируйте Api-Key.
      </>,
      <>
        В Мастерской на вкладке «Интеграции» введите полученные Client-Id и
        Api-Key и нажмите «Сохранить».
      </>,
      <>Скопируйте URL для вебхука Ozon из блока «Интеграции».</>,
      <>
        В Ozon Seller в разделе «Seller API» → «Уведомления» укажите этот URL и
        включите уведомления типа <Code>TYPE_NEW_POSTING</Code>.
      </>,
    ],
  },
  {
    id: "wb",
    name: "Wildberries (WB)",
    lead: "WB не требует API-ключей: продавца определяет секретный токен в адресе вебхука.",
    steps: [
      <>Скопируйте URL для вебхука WB из блока «Интеграции».</>,
      <>
        В личном кабинете WB перейдите в «Настройки» → «Интеграции» →
        «Уведомления».
      </>,
      <>Укажите скопированный URL и сохраните настройки.</>,
      <>Заказы начнут поступать автоматически.</>,
    ],
  },
  {
    id: "yandex",
    name: "Яндекс.Маркет",
    lead: "Яндекс.Маркет подключается одним адресом: ключи для уведомлений не нужны.",
    steps: [
      <>Скопируйте URL для вебхука Яндекса из блока «Интеграции».</>,
      <>
        В кабинете продавца Яндекс.Маркета перейдите в «Настройки» → «API и
        модули» → «API-уведомления».
      </>,
      <>
        Нажмите «Подключить уведомления», укажите URL и выберите событие{" "}
        <Code>ORDER_CREATED</Code>.
      </>,
      <>Нажмите «Подключить».</>,
    ],
  },
];

export default function IntegrationsHelpPage() {
  return (
    <div className="min-h-screen text-zinc-100">
      <Header />

      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/dashboard/workshop"
          className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
        >
          <span aria-hidden>←</span>
          Мастерская
        </Link>

        <section
          aria-labelledby="integrations-help-title"
          className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#0a0a0a]/75 px-5 py-7 shadow-[0_40px_120px_-60px_rgba(0,0,0,1)] backdrop-blur-xl sm:px-8 sm:py-9"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 -right-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 left-1/3 h-56 w-56 rounded-full bg-violet-500/[0.07] blur-3xl"
          />

          <div className="relative min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-zinc-300">
                CRM · 3D-печать
              </span>
              <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-blue-200">
                Инструкции
              </span>
            </div>

            <h1
              id="integrations-help-title"
              className="mt-5 text-3xl font-extrabold tracking-[-0.03em] text-white sm:text-4xl"
            >
              Как подключить уведомления
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              Три площадки, три коротких сценария. Ключи и адреса вводятся на
              вкладке «Интеграции» в Мастерской — здесь пошагово, что нажать в
              кабинете площадки.
            </p>

            <nav aria-label="Разделы инструкции" className="mt-6">
              <ul className="flex flex-wrap gap-2">
                {GUIDES.map((guide) => (
                  <li key={guide.id}>
                    <a
                      href={`#${guide.id}`}
                      className="inline-flex min-h-9 items-center rounded-full border border-white/10 bg-white/[0.03] px-3.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                    >
                      {guide.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </section>

        <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-5">
          {GUIDES.map((guide, guideIndex) => (
            <section
              key={guide.id}
              id={guide.id}
              aria-labelledby={`integrations-help-${guide.id}-title`}
              className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
            >
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/10 text-sm font-extrabold tabular-nums text-blue-200"
                >
                  {String(guideIndex + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h2
                    id={`integrations-help-${guide.id}-title`}
                    className="text-xl font-extrabold tracking-tight text-white"
                  >
                    {guide.name}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                    {guide.lead}
                  </p>
                </div>
              </div>

              <ol className="mt-5 space-y-2.5">
                {guide.steps.map((step, stepIndex) => (
                  <li
                    key={stepIndex}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3"
                  >
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[11px] font-bold tabular-nums text-zinc-300"
                    >
                      {stepIndex + 1}
                    </span>
                    <p className="min-w-0 text-sm leading-relaxed text-zinc-200">
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        <aside
          aria-labelledby="integrations-help-warning-title"
          className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 sm:mt-8 sm:p-6"
        >
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-base font-extrabold text-amber-200"
            >
              !
            </span>
            <div className="min-w-0">
              <h2
                id="integrations-help-warning-title"
                className="text-base font-bold text-amber-100"
              >
                Адрес вебхука — секрет
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-amber-100/90">
                URL вебхука содержит секретный токен. Не публикуйте его в открытом
                доступе.
              </p>
            </div>
          </div>
        </aside>

        <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
          Кабинеты площадок иногда меняются: если раздела с таким названием нет,
          ищите Seller API или API-уведомления в настройках. Адрес вебхука остаётся
          тем же.
        </p>
      </main>
    </div>
  );
}

