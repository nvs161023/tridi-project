import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import { ProfilesClient } from "@/components/profiles/ProfilesClient";
import { resolveUserId } from "@/lib/current-user";
import {
  profileCategories,
  profileCount,
  profilesUpdatedAt,
} from "@/lib/profiles";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

/**
 * Библиотека профилей печати — часть пакета «Всё включено».
 *
 * Страница открыта всем: она показывает, что лежит в библиотеке, и ведёт к
 * пакету. Сами карточки без доступа размыты, а скачивание защищено отдельно —
 * app/api/profiles/download/route.ts проверяет сессию и доступ. Прятать файлы
 * только за CSS нельзя: адрес API можно открыть и руками.
 *
 * Доступ проверяется через hasActiveSubscription() — это бессрочный пакет
 * `pro` «Всё включено» или легаси-подписка `pro-subscription`. Отдельные уровни
 * инструменты не открывают.
 */
export const metadata: Metadata = {
  title: "Библиотека профилей печати — TriDi",
  description:
    "Готовые профили принтеров Anycubic, Elegoo, Sovol, Artillery, Flashforge, Qidi, Bambu Lab, Prusa и Creality, а также материалов PLA, PETG, ABS, ASA, TPU и PA для OrcaSlicer, Bambu Studio и PrusaSlicer. Скачивание входит в пакет «Всё включено».",
};

/** Страница зависит от cookies пользователя — собираем её на каждый запрос. */
export const dynamic = "force-dynamic";

const PROFILE_FORMS = ["профиль", "профиля", "профилей"] as const;
const BRAND_FORMS = ["бренд", "бренда", "брендов"] as const;

const brandCount = new Set(
  profileCategories.flatMap((category) =>
    category.profiles.map((profile) => profile.manufacturer),
  ),
).size;

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
                Входит в пакет «Всё включено»
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                Обновлено {updatedAt}
              </span>
              {hasPro ? (
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3.5 py-1.5 text-emerald-200">
                  Доступ открыт
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
                {brandCount} {pluralize(brandCount, BRAND_FORMS)}
              </span>
            </div>
          </div>
        </section>

        {/* Призыв: без доступа карточки ниже размыты, а скачивание закрыто */}
        {!hasPro ? (
          <section
            aria-labelledby="profiles-cta"
            className="border-b border-white/10 bg-blue-500/[0.06]"
          >
            <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-14">
              <p className="text-sm font-semibold tracking-widest text-blue-300 uppercase">
                Доступ по пакету
              </p>
              <h2
                id="profiles-cta"
                className="mt-4 max-w-4xl text-2xl font-extrabold tracking-tight text-white sm:text-4xl"
              >
                Библиотека открывается пакетом «Всё включено»
              </h2>
              <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Пакет открывает все {profileCount} файлов библиотеки вместе с
                тремя платными курсами — это разовый платёж, доступ остаётся
                навсегда. Профили можно скачать сразу после оплаты.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/courses/pro"
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Открыть пакет «Всё включено»
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
                <p className="mt-4 text-sm text-slate-300">
                  Доступ привязывается к аккаунту — сначала войдите или
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
                  Доступ к библиотеке открыт
                </p>
                <p className="mt-2 text-base text-slate-200 sm:text-lg">
                  Все {profileCount} {pluralize(profileCount, PROFILE_FORMS)}{" "}
                  доступны для скачивания.
                </p>
              </div>
            </div>
          </section>
        )}

        <ProfilesClient categories={profileCategories} hasPro={hasPro} />

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
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
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
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
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
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  Сверьте диаметр сопла, тип стола, температуру и максимальный
                  объёмный расход. Профили — стартовая точка, а не гарантия:
                  прогоните тестовую модель на своём пластике.
                </p>
              </article>
            </div>

            <p className="mt-8 max-w-4xl text-xs leading-relaxed text-slate-300 sm:text-sm">
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
