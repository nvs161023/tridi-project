import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import { resolveUserId } from "@/lib/current-user";
import {
  profileCategories,
  profileCount,
  profilesUpdatedAt,
} from "@/lib/profiles";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

/**
 * Библиотека профилей печати — инструмент подписки Pro.
 *
 * Страница открыта всем: она показывает, что лежит в библиотеке, и продаёт
 * подписку. Сами карточки без Pro размыты, а скачивание защищено отдельно —
 * app/api/profiles/download/route.ts проверяет сессию и подписку. Прятать файлы
 * только за CSS нельзя: адрес API можно открыть и руками.
 *
 * Доступ проверяется через hasActiveSubscription() — это действующая подписка
 * pro-subscription с неистёкшим expires_at. Пакет трёх курсов (pro) и отдельные
 * уровни инструменты не открывают.
 */
export const metadata: Metadata = {
  title: "Библиотека профилей печати — TriDi",
  description:
    "Готовые профили Bambu Lab X1 Carbon, Prusa MK3S+, Voron 2.4 и материалов Polymaker для Bambu Studio, OrcaSlicer и PrusaSlicer. Скачивание входит в подписку Pro.",
};

/** Страница зависит от cookies пользователя — собираем её на каждый запрос. */
export const dynamic = "force-dynamic";

/** Иконки категорий: данные остаются текстовыми, оформление — здесь. */
const CATEGORY_ICONS: Record<string, string> = {
  printers: "🖨️",
  materials: "🧵",
  "print-settings": "⚙️",
};

const PROFILE_FORMS = ["профиль", "профиля", "профилей"] as const;

/** Русская форма слова по числу: 1 профиль, 2 профиля, 5 профилей. */
function pluralize(count: number, forms: readonly [string, string, string]) {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) {
    return forms[2];
  }

  if (mod10 === 1) {
    return forms[0];
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return forms[1];
  }

  return forms[2];
}

/** «18 октября 2026» — дата сверки библиотеки с источниками. */
function formatUpdatedAt(isoDate: string): string {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Замок для закрытых карточек и кнопок. */
function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 16 16"
    >
      <rect
        height="7"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.3"
        width="10"
        x="3"
        y="7"
      />
      <path
        d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

/** Стрелка скачивания для доступной кнопки. */
function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      focusable="false"
      viewBox="0 0 16 16"
    >
      <path
        d="M8 2.5v7.2m0 0 2.8-2.8M8 9.7 5.2 6.9M3 11.5v1.3c0 .4.3.7.7.7h8.6c.4 0 .7-.3.7-.7v-1.3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

export default async function ProfilesPage() {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);
  const hasPro = userId ? await hasActiveSubscription(supabase, userId) : false;
  const updatedAt = formatUpdatedAt(profilesUpdatedAt);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main>
        {/* Герой: что внутри библиотеки и кому она доступна */}
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
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold sm:text-sm">
              <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-3.5 py-1.5 text-blue-200">
                Инструмент подписки Pro
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                Обновлено {updatedAt}
              </span>
              {hasPro ? (
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3.5 py-1.5 text-emerald-200">
                  Подписка активна
                </span>
              ) : null}
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Библиотека профилей печати
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Проверенные настройки принтеров, материалов и процессов для Bambu
              Studio, OrcaSlicer и PrusaSlicer. Скачайте файл и импортируйте его
              в слайсер — без ручного перебора температур и скоростей.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5 text-xs font-semibold sm:text-sm">
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                {profileCount} {pluralize(profileCount, PROFILE_FORMS)}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                {profileCategories.length} категории
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                Bambu Lab · Prusa · Voron
              </span>
            </div>
          </div>
        </section>

        {/* Призыв: без Pro карточки ниже размыты, а скачивание закрыто */}
        {!hasPro ? (
          <section
            aria-labelledby="profiles-cta"
            className="border-b border-white/10 bg-blue-500/[0.06]"
          >
            <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-14">
              <p className="text-sm font-semibold tracking-widest text-blue-300 uppercase">
                Доступ по подписке Pro
              </p>
              <h2
                id="profiles-cta"
                className="mt-4 max-w-4xl text-2xl font-extrabold tracking-tight text-white sm:text-4xl"
              >
                Оформите подписку Pro, чтобы получить доступ к библиотеке
                профилей, конструктору 3D и другим инструментам
              </h2>
              <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Одна подписка открывает все {profileCount} файлов библиотеки,
                конструктор моделей и новые инструменты по мере выхода. Уроки в
                Pro не входят: курсы покупаются отдельно и остаются навсегда.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/subscription#tools"
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Оформить подписку Pro
                  <span aria-hidden>→</span>
                </Link>

                {!userId ? (
                  <Link
                    href="/auth/login?next=%2Fprofiles"
                    className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/20 px-8 text-lg font-semibold text-slate-200 transition-colors hover:border-blue-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    Войти в аккаунт
                  </Link>
                ) : null}
              </div>

              {!userId ? (
                <p className="mt-4 text-sm text-slate-400">
                  Подписка привязывается к аккаунту — сначала войдите или
                  зарегистрируйтесь.
                </p>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="border-b border-white/10 bg-emerald-500/[0.06]">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 sm:px-8">
              <div>
                <p className="text-sm font-semibold tracking-widest text-emerald-300 uppercase">
                  Подписка Pro активна
                </p>
                <p className="mt-2 text-base text-slate-200 sm:text-lg">
                  Все {profileCount} {pluralize(profileCount, PROFILE_FORMS)}{" "}
                  доступны для скачивания.
                </p>
              </div>
              <Link
                href="/constructor"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-6 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Перейти в конструктор
                <span aria-hidden>→</span>
              </Link>
            </div>
          </section>
        )}

        {/* Каталог: три категории, внутри — карточки профилей */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="space-y-16 sm:space-y-20">
            {profileCategories.map((category, categoryIndex) => (
              <section
                key={category.id}
                id={category.id}
                aria-labelledby={`${category.id}-title`}
                className="scroll-mt-20"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <span
                      aria-hidden
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl"
                    >
                      {CATEGORY_ICONS[category.id] ?? "📁"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase">
                        Категория {categoryIndex + 1}
                      </p>
                      <h2
                        id={`${category.id}-title`}
                        className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
                      >
                        {category.title}
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-base">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
                    {category.profiles.length}{" "}
                    {pluralize(category.profiles.length, PROFILE_FORMS)}
                  </span>
                </div>

                <ul className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {category.profiles.map((profile) => {
                    const locked = !hasPro;

                    return (
                      <li
                        key={profile.id}
                        className="relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6"
                      >
                        <div
                          className={
                            locked
                              ? "pointer-events-none flex flex-1 select-none flex-col blur-[3px]"
                              : "flex flex-1 flex-col"
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-blue-200">
                              {profile.format}
                            </span>
                            <span className="text-right text-[11px] leading-snug text-slate-500">
                              {profile.device}
                            </span>
                          </div>

                          <h3 className="mt-5 text-lg leading-snug font-bold text-white">
                            {profile.title}
                          </h3>

                          <p className="mt-3 text-sm leading-relaxed text-slate-400">
                            {profile.description}
                          </p>

                          <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 text-xs">
                            <div className="flex items-start justify-between gap-3">
                              <dt className="shrink-0 text-slate-500">Слайсер</dt>
                              <dd className="text-right font-medium text-slate-300">
                                {profile.slicer}
                              </dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <dt className="shrink-0 text-slate-500">База</dt>
                              <dd className="text-right font-medium text-slate-300">
                                {profile.requires}
                              </dd>
                            </div>
                          </dl>

                          <div className="mt-auto pt-6">
                            {hasPro ? (
                              <a
                                href={`/api/profiles/download?id=${encodeURIComponent(profile.id)}`}
                                download
                                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                              >
                                <DownloadIcon />
                                Скачать профиль
                              </a>
                            ) : (
                              <span className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-slate-300">
                                <LockIcon />
                                Скачать профиль
                              </span>
                            )}
                          </div>
                        </div>

                        {locked ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/55 p-6 text-center">
                            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-400/40 bg-blue-500/15 text-blue-200">
                              <LockIcon className="h-5 w-5" />
                            </span>
                            <span className="text-sm font-semibold text-white">
                              Доступно с Pro
                            </span>
                            <span className="max-w-[16rem] text-xs leading-relaxed text-slate-300">
                              Скачивание откроется после оформления подписки
                            </span>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </section>

        {/* Инструкция: как импортировать и что проверить перед печатью */}
        <section
          aria-labelledby="how-to-import"
          className="border-t border-white/10 bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
              После скачивания
            </p>
            <h2
              id="how-to-import"
              className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
            >
              Как импортировать профиль
            </h2>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs font-semibold tracking-widest text-blue-300 uppercase">
                  OrcaSlicer и Bambu Studio
                </p>
                <h3 className="mt-3 text-lg font-bold text-white">
                  JSON-профили
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  Откройте File → Import → Import Configs и выберите файл. Для
                  материалов импортируйте пару @base + @System: второй наследует
                  настройки первого.
                </p>
              </article>

              <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs font-semibold tracking-widest text-amber-300 uppercase">
                  PrusaSlicer
                </p>
                <h3 className="mt-3 text-lg font-bold text-white">INI-профили</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  File → Import → Import Config. Фрагменты MK3S+ наследуют
                  базовые секции, поэтому нужен установленный бандл
                  PrusaResearch 2.5.12 или новее.
                </p>
              </article>

              <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs font-semibold tracking-widest text-emerald-300 uppercase">
                  Перед печатью
                </p>
                <h3 className="mt-3 text-lg font-bold text-white">
                  Проверьте настройки
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  Сверьте диаметр сопла, тип стола, температуру и максимальный
                  объёмный расход. Профили — стартовая точка, а не гарантия:
                  прогоните тестовую модель на своём пластике.
                </p>
              </article>
            </div>

            <p className="mt-8 max-w-4xl text-xs leading-relaxed text-slate-500 sm:text-sm">
              Файлы — снимки заводских и community-пресетов: имена и
              наследование сохранены. Если правите профиль под себя, сделайте
              копию с новым name и укажите исходник в inherits. Источники: Bambu
              presets и OrcaSlicer — AGPL-3.0, PrusaSlicer — официальные профили
              Prusa Research. Полные версии и лицензии — в profiles/SOURCES.md
              репозитория.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
