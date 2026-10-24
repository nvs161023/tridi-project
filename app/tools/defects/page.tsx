import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import { DefectsExplorer } from "@/components/tools/DefectsExplorer";
import { defects } from "@/lib/defects";
import { OG_IMAGE } from "@/lib/seo";
import { resolveSiteUrl } from "@/lib/site-url";

const PAGE_TITLE = "Дефекты 3D-печати: причины и как исправить | TriDi";
const PAGE_DESCRIPTION =
  "Дефекты 3D-печати: отрыв от стола, расслоение, стрингинг, смещение слоёв, мосты и недоэкструзия. Причины и пошаговые решения в справочнике TriDi.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/tools/defects" },
  // Карточка для мессенджеров: тот же текст, что в выдаче, плюс PNG 1200×630
  // из OG_IMAGE. Абсолютный адрес og:image собирает metadataBase из layout.
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "TriDi",
    url: "/tools/defects",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        ...OG_IMAGE,
        alt: "Справочник дефектов 3D-печати TriDi: причины и решения",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE.url,
        alt: "Справочник дефектов 3D-печати TriDi: причины и решения",
      },
    ],
  },
};

/**
 * JSON-LD `FAQPage`: каждый дефект — вопрос, а его решения — ответ.
 *
 * Разметка собирается из того же массива `defects`, что и карточки, поэтому
 * не расходится с текстом страницы. Ответ — нумерованный список шагов: так он
 * читается и в выпадающем блоке поиска, и скринридером.
 */
function buildFaqJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: "Дефекты 3D-печати: причины и решения",
    description: PAGE_DESCRIPTION,
    url: `${siteUrl}/tools/defects`,
    inLanguage: "ru",
    mainEntity: defects.map((defect) => ({
      "@type": "Question",
      name: defect.title,
      acceptedAnswer: {
        "@type": "Answer",
        text: defect.solutions
          .map((solution, index) => `${index + 1}. ${solution}`)
          .join(" "),
      },
    })),
  };
}

/** Шапка читает cookies, поэтому страница собирается на каждый запрос. */
export const dynamic = "force-dynamic";

/** Порядок работы со справочником: найти симптом, проверить причину, исправить. */
const HOW_TO_STEPS = [
  {
    title: "Найдите свой симптом",
    description:
      "Выберите карточку, которая ближе всего к тому, что видно на детали. Названия совпадают с тем, как дефекты называют на форуме и в слайсерах.",
  },
  {
    title: "Проверьте причины",
    description:
      "Начните с верхней строки списка: там самые частые причины. Отметьте, что совпадает с вашей ситуацией — стол, пластик, температура или механика.",
  },
  {
    title: "Исправляйте по шагам",
    description:
      "Меняйте одну настройку за раз и печатайте короткий тест. Так вы увидите, что именно помогло, и не потеряете рабочий профиль.",
  },
];

export default async function DefectsPage() {
  const siteUrl = await resolveSiteUrl();
  const faqJsonLd = buildFaqJsonLd(siteUrl);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl sm:h-[38rem] sm:w-[38rem]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-24 -right-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl"
          />

          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <nav
              aria-label="Хлебные крошки"
              className="flex flex-wrap items-center gap-2 text-sm text-slate-300"
            >
              <Link
                href="/tools"
                className="transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Центр инструментов
              </Link>
              <span aria-hidden className="text-slate-500">
                /
              </span>
              <span className="text-slate-200">Диагностика дефектов</span>
            </nav>

            <div className="mt-6 flex flex-wrap items-center gap-2.5 text-xs font-semibold sm:text-sm">
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3.5 py-1.5 text-emerald-200">
                Бесплатный справочник
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                {defects.length} типовых дефектов
              </span>
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Диагностика дефектов 3D-печати
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Отрыв от стола, расслоение, паутина, смещение слоёв, провисающие
              мосты и пропуски экструзии. Выберите дефект — и получите список
              причин и пошаговый план настройки, без перебора всех параметров
              слайсера.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <a
                href="#catalog"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                К списку дефектов
                <span aria-hidden>↓</span>
              </a>
              <Link
                href="/forum"
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/20 px-8 text-lg font-semibold text-slate-200 transition-colors hover:border-blue-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Спросить на форуме
              </Link>
            </div>
          </div>
        </section>

        <section
          id="catalog"
          aria-labelledby="defects-catalog-title"
          className="scroll-mt-24 border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
                  Справочник
                </p>
                <h2
                  id="defects-catalog-title"
                  className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
                >
                  Выберите дефект
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
                Нажмите на карточку, чтобы открыть причины, решения и короткий
                совет по диагностике.
              </p>
            </div>

            <div className="mt-8">
              <DefectsExplorer defects={defects} />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="defects-how-to-title"
          className="bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
            <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
              Как пользоваться
            </p>
            <h2
              id="defects-how-to-title"
              className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
            >
              От симптома к рабочему профилю
            </h2>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {HOW_TO_STEPS.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15 font-mono text-sm font-bold text-blue-200">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-white sm:text-xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-slate-300">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/tools"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-base font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span aria-hidden>←</span>
                Центр инструментов
              </Link>
              <Link
                href="/profiles"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-base font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Библиотека профилей
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
