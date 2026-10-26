import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GeneratorWorkspace } from "@/app/3d-generator/GeneratorWorkspace";
import { Header } from "@/components/Header";
import { authHref } from "@/lib/auth-redirect";
import { getUserCredits } from "@/lib/credits";
import { resolveUserId } from "@/lib/current-user";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

/**
 * 3D-генератор — Pro-инструмент: фото превращается в модель для печати.
 *
 * Страница показывает рабочую область: выбрать фото, увидеть превью,
 * отправить его в `/api/3d/generate` и скачать готовую модель. Роут проверяет
 * ключ, сессию, кредиты и файл заново, поэтому интерфейс не станет защитой.
 *
 * Доступ проверяется здесь, как у Мастерской и конструктора: middleware
 * отвечает только за сессию, а «есть ли пакет» — это запрос к purchases и
 * subscriptions. Гость уходит на вход с возвратом (`next=/3d-generator`), а
 * ученику без пакета показываем замок с объяснением, а не глухой редирект.
 *
 * `noindex`: инструмент платформы в поиске делать нечего, а сам адрес пока
 * ниоткуда не анонсирован.
 */

const PAGE_PATH = "/3d-generator";

export const metadata: Metadata = {
  title: "3D-генератор — TriDi",
  description:
    "Загрузите фотографию предмета и получите 3D-модель для печати: генератор TriDi собирает модель по снимку. Входит в пакет «Всё включено».",
  robots: { index: false, follow: false },
};

/** Страница читает cookies и подписку — собираем её на каждый запрос. */
export const dynamic = "force-dynamic";

export default async function ThreeDGeneratorPage() {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(authHref("/auth/login", PAGE_PATH));
  }

  const hasPro = await hasActiveSubscription(supabase, userId);
  // Баланс читаем только тем, кому открыт инструмент: без пакета он не нужен,
  // а лишний запрос к `user_credits` в замке ни к чему. `null` — счётчик
  // недоступен, и это не «0 кредитов»: показываем прочерк, а не приглашение
  // покупать пакет из-за сбоя базы.
  const credits = hasPro ? await getUserCredits(userId) : null;

  return (
    <div className="min-h-screen text-zinc-100">
      <Header />

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/dashboard"
          className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
        >
          <span aria-hidden>←</span>
          Личный кабинет
        </Link>

        <section
          aria-labelledby="generator-title"
          className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#0a0a0a]/75 px-5 py-7 shadow-[0_40px_120px_-60px_rgba(0,0,0,1)] backdrop-blur-xl sm:px-8 sm:py-9 lg:px-10 lg:py-10"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 -right-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 left-1/3 h-56 w-56 rounded-full bg-violet-500/[0.07] blur-3xl"
          />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-zinc-300">
                  Gen API · Trellis 2
                </span>
                <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-blue-200">
                  Входит в пакет «Всё включено»
                </span>
                {hasPro ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                    />
                    Доступ открыт
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-zinc-400">
                    Доступ по пакету
                  </span>
                )}
              </div>

              <h1
                id="generator-title"
                className="mt-5 text-4xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl"
              >
                3D-генератор
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                Загрузите фото, и мы превратим его в 3D-модель для печати.
              </p>
            </div>

            {hasPro ? (
              <div className="shrink-0 rounded-2xl border border-white/[0.07] border-t-white/15 bg-[#0a0a0a]/85 px-5 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:min-w-52 sm:text-right">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-500 uppercase sm:text-[11px]">
                  Доступно генераций:
                </p>
                <p
                  data-generator-credits
                  className="mt-1 text-3xl leading-none font-bold text-white tabular-nums"
                >
                  {credits === null ? "—" : credits}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                  Одна генерация — одна модель
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {hasPro ? <GeneratorWorkspace credits={credits} /> : <LockedGenerator />}
      </main>
    </div>
  );
}

/**
 * Замок для тех, у кого нет пакета.
 *
 * Как в Мастерской: показываем, что именно откроется, вместо пустого экрана.
 * Человек понимает, за что платит, и не ищет кнопку, которой нет.
 */
function LockedGenerator() {
  return (
    <section
      aria-labelledby="generator-locked-title"
      className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md sm:p-8 lg:mt-5"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-xl"
        >
          🔒
        </span>
        <div className="min-w-0">
          <h2
            id="generator-locked-title"
            className="text-xl font-extrabold tracking-tight text-white sm:text-2xl"
          >
            3D-генератор открывается пакетом «Всё включено»
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Генератор превращает фотографию предмета в 3D-модель: её можно
            повернуть, осмотреть со всех сторон и скачать для печати. Каждая
            удачная генерация списывает один кредит, а неудачная — ни одного.
          </p>
        </div>
      </div>

      <ul className="mt-6 space-y-2">
        {[
          "Загрузка фото: JPEG, PNG или WebP до 10 МБ",
          "Модель по снимку — сеть Trellis 2",
          "Просмотр в 3D и скачивание файла для слайсера",
          "Кредиты тратятся только на удачные генерации",
        ].map((point) => (
          <li
            key={point}
            className="flex items-start gap-2 text-sm text-slate-300"
          >
            <span aria-hidden className="mt-0.5 text-blue-300">
              ✓
            </span>
            {point}
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href="/courses/pro"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Открыть пакет «Всё включено»
          <span aria-hidden>→</span>
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Вернуться в кабинет
        </Link>
      </div>
    </section>
  );
}

