import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Header } from "@/components/Header";
import { ButtonLink } from "@/components/ui";
import { MODEL_TYPE_LABELS, MODEL_TYPES } from "@/lib/constructor/model-types";
import { VASE_RECIPES, vaseRecipeImagePath } from "@/data/vase-recipes";
import { absoluteUrl, OG_IMAGE } from "@/lib/seo";
import { PRICES, SITE_STATS, STATS_LABELS, formatRub } from "@/lib/stats";

/**
 * Публичная витрина Конструктора.
 *
 * `/constructor` закрыт входом: гость получает 307 на логин, поэтому в sitemap
 * его быть не должно. Эта страница открыта всем и показывает, что именно
 * собирает Конструктор, сколько стоит и что бесплатно.
 */

const PAGE_TITLE = "Конструктор 3D-моделей: вазы, брелоки, литофаны";
const PAGE_DESCRIPTION = `Соберите модель параметрами: ${STATS_LABELS.models} — ваза, брелок с QR, вывеска, коробки, литофан, кашпо, подставка, стойка, органайзер и термопринт. Результат — STL. ${SITE_STATS.freeConstructorDownloads} бесплатных скачивания в месяц, в Pro — без лимита.`;
const PAGE_IMAGE_ALT = "TriDi: Конструктор параметрических 3D-моделей";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/preview/constructor" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "TriDi",
    url: "/preview/constructor",
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

/** Витрина рецептов: только те, для которых есть отрендеренный кадр. */
const RECIPE_PREVIEWS = VASE_RECIPES.slice(0, 6).map((recipe) => ({
  id: recipe.id,
  name: recipe.name,
  description: recipe.description,
  image: vaseRecipeImagePath(recipe.id),
}));

/** Вопросы, которые задают до регистрации. */
const FAQ = [
  {
    question: "Что можно собрать в Конструкторе?",
    answer: `Сейчас доступно ${STATS_LABELS.models}: ${MODEL_TYPES.map((type) => MODEL_TYPE_LABELS[type]).join(", ")}. У каждой модели свои параметры — размеры, узор, толщина стенки и подписи.`,
  },
  {
    question: "Сколько моделей можно скачать бесплатно?",
    answer: `Без подписки — ${SITE_STATS.freeConstructorDownloads} STL в календарный месяц. В подписке Pro лимита нет: скачивайте столько, сколько нужно для задач.`,
  },
  {
    question: "В каком формате результат?",
    answer:
      "STL в миллиметрах. Файл открывается в Bambu Studio, OrcaSlicer, PrusaSlicer и Cura, масштабировать не нужно.",
  },
  {
    question: "Можно продавать напечатанное?",
    answer:
      "Да. Модели Конструктора можно печатать и продавать. Перед публикацией проверьте, что логотипы и чужие изображения у вас есть право использовать.",
  },
  {
    question: "Нужен ли 3D-редактор?",
    answer:
      "Нет. Все параметры меняются слайдерами в браузере, модель пересобирается сразу. 3D-редактор понадобится только для правок за пределами параметров.",
  },
] as const;

/** Микроразметка: приложение, FAQ и хлебные крошки. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Конструктор 3D-моделей TriDi",
      applicationCategory: "DesignApplication",
      operatingSystem: "Web",
      url: absoluteUrl("/preview/constructor"),
      description: PAGE_DESCRIPTION,
      offers: [
        {
          "@type": "Offer",
          name: "Бесплатные скачивания STL",
          price: 0,
          priceCurrency: "RUB",
        },
        {
          "@type": "Offer",
          name: "Подписка Pro",
          price: PRICES.subscription,
          priceCurrency: "RUB",
        },
      ],
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
          name: "Конструктор 3D",
          item: absoluteUrl("/preview/constructor"),
        },
      ],
    },
  ],
};

/** Условия доступа: бесплатно, подписка и соседний инструмент. */
const PLANS = [
  {
    title: "Без подписки",
    value: `${SITE_STATS.freeConstructorDownloads} STL в месяц`,
    text: "Вход нужен один раз: модель привязывается к аккаунту, лимит считается по календарным месяцам.",
    href: "/auth/sign-up?next=%2Fconstructor",
    cta: "Начать бесплатно",
  },
  {
    title: "Подписка Pro",
    value: "Без лимита",
    text: `${formatRub(PRICES.subscription)} в месяц: Конструктор, профили печати, генератор по фото и Мастерская.`,
    href: "/pricing",
    cta: "Оформить Pro",
  },
] as const;

export default function PreviewConstructorPage() {
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
            className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-emerald-600/20 blur-3xl"
          />
          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-sm font-semibold tracking-widest text-emerald-300 uppercase">
              Конструктор 3D
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Модель параметрами, без 3D-редактора
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              {STATS_LABELS.models} с готовыми параметрами: форма, узор, толщина
              стенки и подпись меняются слайдерами. Результат — STL, который
              сразу открывается в слайсере.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5 text-xs font-semibold sm:text-sm">
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3.5 py-1.5 text-emerald-200">
                {SITE_STATS.freeConstructorDownloads} STL бесплатно в месяц
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                {STATS_LABELS.models}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                Профили печати в Pro
              </span>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/constructor" size="lg">
                Открыть Конструктор
              </ButtonLink>
              <ButtonLink
                href="/auth/sign-up?next=%2Fconstructor"
                variant="secondary"
                size="lg"
              >
                Зарегистрироваться бесплатно
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Конструктор работает после входа — бесплатные скачивания
              считаются по вашему аккаунту.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="constructor-models"
          className="border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
            <h2
              id="constructor-models"
              className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
            >
              Что можно собрать
            </h2>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MODEL_TYPES.map((type) => (
                <li
                  key={type}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                  />
                  <span className="text-sm font-semibold text-white">
                    {MODEL_TYPE_LABELS[type]}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-400">
              У каждой модели свои параметры: габариты, узор, толщина стенки,
              подписи и посадки. Меняете слайдер — модель пересобирается сразу,
              скачивать черновики не нужно.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="constructor-recipes"
          className="border-b border-white/10 bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
            <h2
              id="constructor-recipes"
              className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
            >
              Готовые рецепты вазы
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
              {VASE_RECIPES.length} комбинаций силуэта, узора и закрутки: выбираете
              плитку — получаете модель. Дальше можно менять любые параметры
              вручную.
            </p>
            <ul className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {RECIPE_PREVIEWS.map((recipe) => (
                <li
                  key={recipe.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
                >
                  <Image
                    src={recipe.image}
                    alt={`Ваза «${recipe.name}» из Конструктора TriDi`}
                    width={320}
                    height={400}
                    loading="lazy"
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 90vw"
                    className="h-56 w-full bg-slate-950/60 object-cover"
                  />
                  <div className="p-5">
                    <h3 className="text-base font-bold text-white">
                      {recipe.name}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">
                      {recipe.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="constructor-access"
          className="border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
            <h2
              id="constructor-access"
              className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
            >
              Сколько стоит
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {PLANS.map((plan) => (
                <div
                  key={plan.title}
                  className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6"
                >
                  <p className="text-xs font-semibold tracking-widest text-emerald-300 uppercase">
                    {plan.title}
                  </p>
                  <p className="mt-3 text-2xl font-extrabold text-white">
                    {plan.value}
                  </p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-300">
                    {plan.text}
                  </p>
                  <div className="mt-5">
                    <ButtonLink href={plan.href} variant="secondary" size="md">
                      {plan.cta}
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-400">
              Подписка Pro не заменяет курсы и не входит в пакет «Все три
              курса»: это разные покупки. Курсы открывают уроки, Pro — инструменты
              и месячные лимиты.
            </p>
          </div>
        </section>

        <section aria-labelledby="constructor-faq">
          <div className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-16">
            <h2
              id="constructor-faq"
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

            <div className="mt-10 rounded-3xl border border-emerald-400/25 bg-emerald-500/[0.07] p-6 sm:p-8">
              <h2 className="text-xl font-extrabold text-white sm:text-2xl">
                Соберите первую модель
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                Первые {SITE_STATS.freeConstructorDownloads} скачивания STL в
                месяц бесплатны. Для моделей из фотографии есть{" "}
                <Link
                  href="/preview/generator"
                  className="font-semibold text-emerald-200 underline decoration-emerald-400/40 underline-offset-4 hover:text-white"
                >
                  генератор по фото
                </Link>
                .
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink href="/constructor" size="lg">
                  Открыть Конструктор
                </ButtonLink>
                <ButtonLink href="/pricing" variant="secondary" size="lg">
                  Сравнить с Pro
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

