import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import { defects } from "@/lib/defects";
import { profileCount } from "@/lib/profiles";
import { OG_IMAGE } from "@/lib/seo";

const PAGE_TITLE = "3D-инструменты: профили и диагностика | TriDi";
const PAGE_DESCRIPTION =
  "Центр инструментов TriDi: библиотека профилей слайсеров и справочник дефектов печати с причинами и пошаговыми решениями.";
const PAGE_IMAGE_ALT = "TriDi: профили печати и справочник дефектов";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/tools" },
  // OpenGraph и Twitter повторяют заголовок и описание страницы: при отправке
  // ссылки в Telegram или WhatsApp разворачивается карточка с тем же текстом,
  // а картинку 1200×630 Next.js подставляет из OG_IMAGE.
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "TriDi",
    url: "/tools",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        ...OG_IMAGE,
        alt: PAGE_IMAGE_ALT,
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
        alt: PAGE_IMAGE_ALT,
      },
    ],
  },
};

/** Шапка читает cookies, поэтому страница собирается на каждый запрос. */
export const dynamic = "force-dynamic";

type ToolIconName = "profiles" | "defects";

type Tool = {
  href: string;
  title: string;
  description: string;
  icon: ToolIconName;
  badges: string[];
  bullets: string[];
  cta: string;
  accent: {
    icon: string;
    hover: string;
    cta: string;
  };
};

/** Стопка слоёв — библиотека профилей и материалов. */
function LayersIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="m12 3 9 4.6-9 4.6-9-4.6L12 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="m3 11.8 9 4.6 9-4.6M3 16.4l9 4.6 9-4.6"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Лупа с линиями слоя — диагностика дефекта по симптомам. */
function DiagnosticIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <circle
        cx="10.5"
        cy="10.5"
        r="6.8"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m15.6 15.6 4.7 4.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path
        d="M7.2 8.9h6.6M7.2 11.4h4.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function ToolIcon({
  name,
  className,
}: {
  name: ToolIconName;
  className?: string;
}) {
  if (name === "profiles") {
    return <LayersIcon className={className} />;
  }

  if (name === "defects") {
    return <DiagnosticIcon className={className} />;
  }

  return null;
}

const TOOLS: Tool[] = [
  {
    href: "/profiles",
    title: "Библиотека профилей",
    description:
      "Проверенные настройки принтеров, материалов и процессов для Bambu Studio, OrcaSlicer и PrusaSlicer.",
    icon: "profiles",
    badges: [`${profileCount} профилей`, "Слайсеры"],
    bullets: [
      "Принтеры Anycubic, Elegoo, Bambu Lab, Prusa и другие",
      "Материалы PLA, PETG, ABS, ASA, TPU и PA",
      "Импорт в слайсер за пару минут",
    ],
    cta: "Открыть библиотеку",
    accent: {
      icon: "border-violet-400/30 bg-violet-500/10 text-violet-300",
      hover: "hover:border-violet-400/50",
      cta: "text-violet-300 group-hover:text-violet-200",
    },
  },
  {
    href: "/tools/defects",
    title: "Диагностика дефектов",
    description:
      "Справочник по типовым проблемам печати: отрыв от стола, расслоение, паутина, смещение слоёв и пропуски экструзии.",
    icon: "defects",
    badges: [`${defects.length} дефектов`, "Бесплатно"],
    bullets: [
      "Причины от частых к редким",
      "Пошаговые решения для слайсера и принтера",
      "Советы по калибровке без перебора настроек",
    ],
    cta: "Открыть диагностику",
    accent: {
      icon: "border-amber-400/30 bg-amber-500/10 text-amber-300",
      hover: "hover:border-amber-400/50",
      cta: "text-amber-300 group-hover:text-amber-200",
    },
  },
];

export default function ToolsPage() {
  return (
    <div className="min-h-screen text-slate-100">
      <Header />

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl sm:h-[38rem] sm:w-[38rem]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-24 -right-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl"
          />

          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
              Инструменты TriDi
            </p>

            <h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Центр инструментов
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Два помощника для практики: подобрать профиль слайсера и
              разобраться, почему деталь не получилась. Начните с задачи, а не с
              перебора настроек.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5 text-xs font-semibold sm:text-sm">
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                2 инструмента
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                {profileCount} профилей печати
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                {defects.length} дефектов в справочнике
              </span>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="tools-grid-title"
          className="border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
                  Выберите инструмент
                </p>
                <h2
                  id="tools-grid-title"
                  className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
                >
                  Что нужно сделать сегодня
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
                Библиотека профилей открывается пакетом «Всё включено»,
                диагностика дефектов доступна всем и без регистрации.
              </p>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {TOOLS.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className={`group flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition duration-200 hover:-translate-y-1 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:p-7 ${tool.accent.hover}`}
                >
                  <span
                    className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl border ${tool.accent.icon}`}
                  >
                    <ToolIcon name={tool.icon} className="h-7 w-7" />
                  </span>

                  <span className="mt-5 flex flex-wrap gap-2">
                    {tool.badges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300"
                      >
                        {badge}
                      </span>
                    ))}
                  </span>

                  <span className="mt-4 block text-2xl font-bold tracking-tight text-white">
                    {tool.title}
                  </span>

                  <span className="mt-3 block text-base leading-relaxed text-slate-200">
                    {tool.description}
                  </span>

                  <span className="mt-5 flex-1">
                    <span className="block space-y-2.5">
                      {tool.bullets.map((bullet) => (
                        <span
                          key={bullet}
                          className="flex gap-2.5 text-sm leading-relaxed text-slate-300"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500"
                          />
                          <span>{bullet}</span>
                        </span>
                      ))}
                    </span>
                  </span>

                  <span
                    className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold transition-colors ${tool.accent.cta}`}
                  >
                    {tool.cta}
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-14">
            <div className="flex flex-col gap-5 rounded-3xl border border-blue-400/20 bg-blue-500/[0.07] p-6 md:flex-row md:items-center md:justify-between sm:p-8">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  Не нашли свой дефект?
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-200">
                  Опишите симптом и покажите фото на форуме: разберём вместе с
                  другими участниками и дополним справочник.
                </p>
              </div>
              <Link
                href="/forum"
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/15 px-6 text-base font-semibold text-blue-100 transition-colors hover:bg-blue-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Открыть форум
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
