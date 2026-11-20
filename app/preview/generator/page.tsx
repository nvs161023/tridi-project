import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import { GeneratorPhotoExample } from "@/components/generator/GeneratorPhotoExample";
import { ButtonLink } from "@/components/ui";
import { SUBSCRIPTION_PLAN, TOKEN_PACKS } from "@/lib/generation-plans";
import { absoluteUrl, OG_IMAGE } from "@/lib/seo";
import { PRICES, STATS_LABELS, formatRub } from "@/lib/stats";

/**
 * Публичная витрина генератора 3D по фото.
 *
 * `/3d-generator` закрыт входом: гость получает 307 на логин, поэтому в sitemap
 * его быть не должно. Реклама и поиск ведут сюда: страница открыта всем,
 * показывает шаги, лимиты и цены из данных и только потом предлагает войти.
 */

const PAGE_TITLE = "3D-модель из фотографии — генератор TriDi";
const PAGE_DESCRIPTION =
  "Загрузите 1–4 фото предмета и получите STL для печати: сетка очищается и приводится к 120 мм. Первая генерация Standard бесплатно, дальше — подписка Pro или пакеты токенов.";
const PAGE_IMAGE_ALT = "TriDi: генератор 3D-модели по фотографии";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/preview/generator" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "TriDi",
    url: "/preview/generator",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [{ ...OG_IMAGE, alt: PAGE_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [{ url: OG_IMAGE.url, alt: PAGE_IMAGE_ALT }],
  },
};

/** Шапка читает cookies, поэтому страница собирается на каждый запрос. */
export const dynamic = "force-dynamic";

/** Четыре шага пути: те же, что на рабочей странице генератора. */
const STEPS = [
  {
    title: "Загрузите фото",
    text: "1–4 снимка предмета: спереди, слева, сзади и справа. Браузер сожмёт кадры сам. Симметричному предмету хватит одного.",
  },
  {
    title: "Выберите качество",
    text: "«Стандарт» — быстрая модель, «Ультра» — самая подробная геометрия.",
  },
  {
    title: "Дождитесь модели",
    text: "Сеть считает задачу 1–3 минуты, прогресс виден на странице.",
  },
  {
    title: "Скачайте STL",
    text: "Сетка очищена и приведена к 120 мм — файл готов для слайсера.",
  },
] as const;

/** Вопросы, которые задают до регистрации. */
const FAQ = [
  {
    question: "Что нужно для первой модели?",
    answer:
      "Фотографии предмета и аккаунт. Первая генерация Standard бесплатна: её хватает, чтобы проверить качество на своей задаче.",
  },
  {
    question: "В каком формате приходит модель?",
    answer:
      "STL в миллиметрах, сетка очищена от мусора и приведена к 120 мм по длинной стороне. Файл открывается в Bambu Studio, OrcaSlicer, PrusaSlicer и Cura.",
  },
  {
    question: "Сколько стоит после бесплатной генерации?",
    answer: `Подписка Pro — ${formatRub(PRICES.subscription)} в месяц: ${PRICES.generatorLimits.standardPerMonth} Standard и ${PRICES.generatorLimits.ultraPerMonth} Ultra генерации ежемесячно. Или пакеты токенов: ${PRICES.tokenPacks.standard.quantity} Standard за ${formatRub(PRICES.tokenPacks.standard.price)}, ${PRICES.tokenPacks.ultra.quantity} Ultra за ${formatRub(PRICES.tokenPacks.ultra.price)} — токены не сгорают.`,
  },
  {
    question: "Можно продавать напечатанное?",
    answer:
      "Да. Модели, которые вы получили из своих фотографий, можно печатать и продавать. Чужие фотографии и товарные знаки — только с разрешения правообладателя.",
  },
  {
    question: "Что если предмет сложный?",
    answer:
      "Лучше работают матовые предметы без прозрачных и зеркальных участков. Мелкие тонкие элементы может съесть сетка — тогда поможет режим «Ультра».",
  },
] as const;

/** Микроразметка: приложение, инструкция, FAQ и хлебные крошки. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Генератор 3D по фото TriDi",
      applicationCategory: "DesignApplication",
      operatingSystem: "Web",
      url: absoluteUrl("/preview/generator"),
      description: PAGE_DESCRIPTION,
      offers: [
        {
          "@type": "Offer",
          name: SUBSCRIPTION_PLAN.title,
          price: PRICES.subscription,
          priceCurrency: "RUB",
        },
        {
          "@type": "Offer",
          name: TOKEN_PACKS.standard.receiptTitle,
          price: PRICES.tokenPacks.standard.price,
          priceCurrency: "RUB",
        },
        {
          "@type": "Offer",
          name: TOKEN_PACKS.ultra.receiptTitle,
          price: PRICES.tokenPacks.ultra.price,
          priceCurrency: "RUB",
        },
      ],
    },
    {
      "@type": "HowTo",
      name: "Как получить 3D-модель из фотографии",
      step: STEPS.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.title,
        text: step.text,
      })),
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Главная",
          item: absoluteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Генератор по фото",
          item: absoluteUrl("/preview/generator"),
        },
      ],
    },
  ],
};

/** Ограничения и цены: числа из каталога, не из текста страницы. */
const LIMITS = [
  {
    title: "Бесплатно",
    value: `${PRICES.generatorLimits.freeStandard} Standard`,
    text: "Первая генерация после регистрации: проверьте качество на своей задаче.",
  },
  {
    title: "Подписка Pro",
    value: `${PRICES.generatorLimits.standardPerMonth} Standard + ${PRICES.generatorLimits.ultraPerMonth} Ultra в месяц`,
    text: `${formatRub(PRICES.subscription)} в месяц: инструменты платформы и месячные лимиты генераций.`,
  },
  {
    title: "Пакеты токенов",
    value: `${PRICES.tokenPacks.standard.quantity} Standard / ${PRICES.tokenPacks.ultra.quantity} Ultra`,
    text: `${formatRub(PRICES.tokenPacks.standard.price)} и ${formatRub(PRICES.tokenPacks.ultra.price)} разово, токены не сгорают.`,
  },
] as const;

export default function PreviewGeneratorPage() {
  return (
    <div className="min-h-screen text-slate-100">
      <Header />

      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />

        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-3xl"
          />
          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-sm font-semibold tracking-widest text-fuchsia-300 uppercase">
              Генератор по фото
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              3D-модель из фотографии
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Загрузите 1–4 снимка предмета и получите STL для печати. Сетка
              очищается и приводится к 120 мм, файл открывается в любом слайсере.
              Первая генерация Standard — бесплатно.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5 text-xs font-semibold sm:text-sm">
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                {formatRub(PRICES.subscription)} — подписка Pro
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                STL в миллиметрах
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                {STATS_LABELS.models} в Конструкторе
              </span>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/3d-generator" size="lg">
                Создать модель по фото
              </ButtonLink>
              <ButtonLink
                href="/auth/sign-up?next=%2F3d-generator"
                variant="secondary"
                size="lg"
              >
                Зарегистрироваться бесплатно
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Генератор работает после входа — так модель привязывается к вашему
              аккаунту и лимиту.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="generator-steps"
          className="border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
            <h2
              id="generator-steps"
              className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
            >
              Как это работает
            </h2>
            <ol className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 text-xs font-bold text-fuchsia-200">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-bold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <GeneratorPhotoExample variant="page" />

        <section
          aria-labelledby="generator-limits"
          className="border-b border-white/10 bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
            <h2
              id="generator-limits"
              className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
            >
              Лимиты и цены
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              {LIMITS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                >
                  <p className="text-xs font-semibold tracking-widest text-fuchsia-300 uppercase">
                    {item.title}
                  </p>
                  <p className="mt-3 text-lg font-extrabold text-white">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-400">
              Лимит списывается только за успешную генерацию. Если задача
              упала, токен возвращается. Пакеты токенов покупаются разово и не
              зависят от подписки.
            </p>
          </div>
        </section>

        <section aria-labelledby="generator-faq">
          <div className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-16">
            <h2
              id="generator-faq"
              className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
            >
              Частые вопросы
            </h2>
            <div className="mt-6 space-y-3">
              {FAQ.map((item) => (
                <details
                  key={item.question}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4"
                >
                  <summary className="cursor-pointer text-sm font-semibold text-white">
                    {item.question}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>

            <div className="mt-10 rounded-3xl border border-fuchsia-400/25 bg-fuchsia-500/[0.07] p-6 sm:p-8">
              <h2 className="text-xl font-extrabold text-white sm:text-2xl">
                Попробуйте на своём предмете
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                Первая генерация Standard бесплатна. Если понадобится больше —
                подписка Pro или пакет токенов. Модели Конструктора доступны в
                том же аккаунте: {STATS_LABELS.models} с параметрами.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink href="/3d-generator" size="lg">
                  Создать модель по фото
                </ButtonLink>
                <Link
                  href="/preview/constructor"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-fuchsia-400/60 hover:text-white"
                >
                  Посмотреть Конструктор
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

