import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import { defects } from "@/lib/defects";
import { profileCount } from "@/lib/profiles";
import { OG_IMAGE } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";

const PAGE_TITLE = "3D-инструменты: профили, дефекты и мастерская";
const PAGE_DESCRIPTION =
  "Центр инструментов TriDi: библиотека профилей слайсеров, справочник дефектов печати и мастерская для 3D-фермы — заказы, принтеры и склад в одном окне.";
const PAGE_IMAGE_ALT = "TriDi: профили печати, справочник дефектов и мастерская";

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

type ToolIconName = "profiles" | "defects" | "workshop";

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

/** Принтер — мастерская: заказы, склад и печать в одном окне. */
function PrinterIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M7.4 9V4.5h9.2V9"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M7.4 17.6H5.4A1.4 1.4 0 0 1 4 16.2v-5.4A1.4 1.4 0 0 1 5.4 9.4h13.2A1.4 1.4 0 0 1 20 10.8v5.4a1.4 1.4 0 0 1-1.4 1.4h-2"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M7.4 14.4h9.2V20H7.4z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M16.6 12.4h.9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
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

  if (name === "workshop") {
    return <PrinterIcon className={className} />;
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

/**
 * Мастерская — Pro-инструмент, поэтому карточка отдельная: у неё своя кнопка
 * «Оформить подписку» для тех, у кого пакета нет, и ссылка, которая ведёт гостя
 * на вход, а ученика без пакета — на тарифы.
 */
const WORKSHOP_TOOL = {
  title: "Мастерская (CRM для 3D-фермы)",
  description:
    "Управляйте заказами, принтерами и складом в одном окне. Канбан, интеграции с Ozon/WB/Яндекс, автоматизация печати.",
  bullets: [
    "Заказы и клиенты на канбане со статусами",
    "Склад катушек, принтеры и обслуживание",
    "Выгрузка на Ozon, Wildberries и Яндекс Маркет",
  ],
} as const;

/** Три инструмента: две карточки из TOOLS и мастерская. */
const TOOL_COUNT = TOOLS.length + 1;

export default async function ToolsPage() {
  // Доступ нужен карточке мастерской: гость уходит на вход с возвратом в
  // мастерскую, ученик без пакета — на тарифы. Шапка проверяет то же самое для
  // своего меню, поэтому пункты ведут в те же места.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hasPro = user ? await hasActiveSubscription(supabase, user.id) : false;

  const workshopHref = hasPro
    ? "/dashboard/workshop"
    : user
      ? "/subscription"
      : "/auth/login?next=/dashboard/workshop";

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
              Три помощника для практики: подобрать профиль слайсера, разобраться,
              почему деталь не получилась, и вести заказы мастерской. Начните с
              задачи, а не с перебора настроек.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5 text-xs font-semibold sm:text-sm">
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                {TOOL_COUNT} инструмента
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
                Мастерская и библиотека профилей открываются пакетом «Всё
                включено», диагностика дефектов доступна всем и без регистрации.
              </p>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <article className="flex h-full flex-col rounded-3xl border border-blue-400/20 bg-white/[0.04] p-6 transition duration-200 hover:border-blue-400/40 hover:bg-white/[0.07] sm:p-7 md:col-span-2">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 max-w-2xl">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/10 text-blue-300">
                      <ToolIcon name="workshop" className="h-7 w-7" />
                    </span>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                        CRM · 3D-печать
                      </span>
                      {hasPro ? (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                          Pro · доступ открыт
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                          Требуется Pro
                        </span>
                      )}
                    </div>

                    <p className="mt-4 text-2xl font-bold tracking-tight text-white">
                      {WORKSHOP_TOOL.title}
                    </p>
                    <p className="mt-3 text-base leading-relaxed text-slate-200">
                      {WORKSHOP_TOOL.description}
                    </p>

                    <ul className="mt-5 space-y-2.5">
                      {WORKSHOP_TOOL.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex gap-2.5 text-sm leading-relaxed text-slate-300"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400"
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row lg:flex-col lg:items-stretch">
                    <Link
                      href={workshopHref}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                      Открыть мастерскую
                      <span aria-hidden>→</span>
                    </Link>
                    {hasPro ? null : (
                      <Link
                        href="/subscription"
                        className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                      >
                        Оформить подписку
                      </Link>
                    )}
                  </div>
                </div>
              </article>

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
