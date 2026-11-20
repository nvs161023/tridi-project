import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Header } from "@/components/Header";
import { GeneratorPhotoExample } from "@/components/generator/GeneratorPhotoExample";
import { Image3DGenerator } from "@/components/generator/Image3DGenerator";
import { PlanButton } from "@/app/subscription/PlanButton";
import { authHref } from "@/lib/auth-redirect";
import { getUserCredits } from "@/lib/credits";
import { resolveUserId } from "@/lib/current-user";
import {
  MONTHLY_STANDARD_GENERATIONS,
  MONTHLY_ULTRA_GENERATIONS,
  hasFreeStandard,
  monthlyStandardLeft,
  monthlyUltraLeft,
} from "@/lib/generator/generation-credits";
import { TOKEN_PACKS } from "@/lib/generation-plans";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

/**
 * Генератор 3D-модели по фото — отдельная страница платформы.
 *
 * Поток: фото → сеть строит модель → «мясорубка» чистит сетку и приводит её к
 * 120 мм → STL можно осмотреть в 3D и скачать. Интерфейс живёт в
 * `Image3DGenerator`, а страница отвечает за доступ и баланс.
 *
 * Доступ: middleware закрывает адрес сессией, страница повторно проверяет вход
 * (гость уходит на `/auth/login?next=%2F3d-generator`). Пакет здесь больше не
 * проверяется — генерацию оплачивают лимиты и токены `user_credits`, и решает
 * это `/api/generate-3d`: гость получает 401, пустой баланс — 402.
 *
 * Плашка справа показывает то же, что спишет роут: бесплатную генерацию у
 * Free, остаток месячных лимитов у подписки и купленные токены у всех. Числа
 * считает `lib/generator/generation-credits.ts`, поэтому приоритет списания не
 * дублируется в разметке.
 *
 * Пакеты токенов продаются здесь же, в блоке «Покупается отдельно»: это
 * единственная страница, где человек видит свой баланс, качество модели и
 * цену разовой докупки. На `/pricing` остались только подписка и ссылка сюда,
 * чтобы одинаковые кнопки оплаты не стояли в двух местах.
 *
 * С 16 ноября 2026 страница открыта для индексации: noindex снят, запрет из
 * robots.txt убран, адрес есть в карте сайта. Вход по-прежнему обязателен —
 * гостя middleware уводит на `/auth/login`, поэтому витриной для поиска
 * остаётся описание генератора и `/pricing`.
 */

const PAGE_PATH = "/3d-generator";

export const metadata: Metadata = {
  title: "Создать 3D из фото",
  description:
    "Загрузите 1–4 фотографии предмета и получите 3D-модель для печати: сеть соберёт силуэт, мы очистим сетку и приведём её к 120 мм.",
};

/** Страница читает cookies и кредиты — собираем её на каждый запрос. */
export const dynamic = "force-dynamic";

/** Четыре шага под рабочей областью: коротко объясняют весь путь. */
const GENERATOR_STEPS = [
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

/**
 * Пакеты токенов на витрине генератора.
 *
 * Цены и объёмы берутся из `data/generation-plans.json` через `TOKEN_PACKS`:
 * здесь только подписи для витрины, поэтому изменение каталога не потребует
 * правки разметки. Кнопки `PlanButton` создают подписанную ссылку Robokassa на
 * сервере — сумму в браузере подменить нельзя.
 */
const PACK_CARDS = [
  {
    courseId: TOKEN_PACKS.standard.courseId,
    title: TOKEN_PACKS.standard.title,
    quantity: TOKEN_PACKS.standard.quantity,
    priceLabel: TOKEN_PACKS.standard.price.toLocaleString("ru-RU"),
    description:
      "Обычное качество: быстро и достаточно для сувениров, прототипов и простых форм.",
    variant: "blue",
  },
  {
    courseId: TOKEN_PACKS.ultra.courseId,
    title: TOKEN_PACKS.ultra.title,
    quantity: TOKEN_PACKS.ultra.quantity,
    priceLabel: TOKEN_PACKS.ultra.price.toLocaleString("ru-RU"),
    description:
      "Максимальная детализация: мелкие элементы, лица, фактура и тонкие стенки.",
    variant: "gold",
  },
] as const;

export default async function ThreeDGeneratorPage() {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(authHref("/auth/login", PAGE_PATH));
  }

  // `null` — баланс недоступен, и это не «0 генераций»: показываем прочерк, а
  // не приглашение покупать пакет из-за сбоя базы. Генерацию всё равно
  // проверит `/api/generate-3d`.
  const [credits, hasSubscription] = await Promise.all([
    getUserCredits(userId),
    hasActiveSubscription(supabase, userId),
  ]);

  return (
    <div className="min-h-screen text-zinc-100">
      <Header />

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
          href="/dashboard"
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

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold tracking-wide text-zinc-300 uppercase">
                <span aria-hidden>🖼️</span>
                Генератор по фото
              </span>

              <h1
                className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl"
                id="generator-title"
              >
                Создать 3D из фото
              </h1>

              <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
                Загрузите один или несколько снимков предмета — нейросеть
                соберёт модель, «мясорубка» очистит сетку и приведёт её к
                120 мм. Готовый STL можно осмотреть в 3D и скачать для
                слайсера.
              </p>

              <ul className="mt-5 flex flex-wrap gap-2">
                {[
                  "JPEG, PNG или WebP",
                  "1–4 кадра",
                  "STL для печати",
                  "Просмотр в 3D",
                ].map((point) => (
                  <li
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-zinc-300"
                    key={point}
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 lg:w-72">
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                Баланс генераций
              </p>

              {credits === null ? (
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Баланс временно недоступен — проверим его при запуске
                  генерации.
                </p>
              ) : hasSubscription ? (
                <>
                  <p className="mt-2 text-xs font-semibold text-zinc-300">
                    Лимит подписки
                  </p>
                  <p className="mt-1 text-2xl leading-none font-bold text-white tabular-nums">
                    Standard {monthlyStandardLeft(credits)}/
                    {MONTHLY_STANDARD_GENERATIONS}
                    <span className="mx-1.5 text-zinc-600">·</span>
                    Ultra {monthlyUltraLeft(credits)}/
                    {MONTHLY_ULTRA_GENERATIONS}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm leading-relaxed font-semibold text-white">
                  {hasFreeStandard(credits)
                    ? "Доступна 1 бесплатная генерация Standard"
                    : "Бесплатная генерация использована"}
                </p>
              )}

              <p className="mt-3 text-xs leading-relaxed text-zinc-300">
                Токены: Standard{" "}
                {credits === null ? "—" : credits.standardTokens}, Ultra{" "}
                {credits === null ? "—" : credits.ultraTokens}
              </p>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                <Link
                  className="inline-flex min-h-8 items-center gap-1.5 text-fuchsia-200 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
                  href="#generator-packs"
                >
                  Докупить генерации
                  <span aria-hidden>↓</span>
                </Link>
                <Link
                  className="inline-flex min-h-8 items-center gap-1.5 text-zinc-300 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
                  href="/pricing"
                >
                  Подписка Pro
                  <span aria-hidden>→</span>
                </Link>
              </div>

              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                Если сеть отказала, списание возвращается.
              </p>
            </div>
          </div>
        </section>

        <Image3DGenerator
          balance={credits}
          hasSubscription={hasSubscription}
        />

        {/*
          Пакеты токенов продаются только здесь: человек видит свой баланс и
          качество модели, поэтому разовая докупка стоит рядом с генератором, а
          не в общем списке тарифов. `scroll-mt` держит заголовок под липкой
          шапкой, когда ссылка «Докупить генерации» прокручивает страницу.
        */}
        <section
          aria-labelledby="generator-packs-title"
          className="mt-4 scroll-mt-24 rounded-[1.75rem] border border-fuchsia-300/25 bg-gradient-to-b from-fuchsia-500/[0.07] to-[#0a0a0a]/60 p-5 backdrop-blur-xl sm:p-7"
          id="generator-packs"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-widest text-fuchsia-300 uppercase">
                Покупается отдельно
              </p>
              <h2
                className="mt-2 text-lg font-extrabold tracking-tight text-white sm:text-xl"
                id="generator-packs-title"
              >
                Пакеты токенов
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                Разовая докупка, когда лимита подписки и бесплатной генерации не
                хватило. Токены не сгорают и списываются последними.
              </p>
            </div>
            <Link
              className="inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
              href="/pricing"
            >
              Подписка Pro и лимиты
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {PACK_CARDS.map((pack) => (
              <article
                className="flex h-full flex-col rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 sm:p-5"
                key={pack.courseId}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-base font-bold tracking-tight text-white">
                    {pack.title}
                  </h3>
                  <span className="shrink-0 text-xs font-semibold text-zinc-400">
                    {pack.quantity} генераций
                  </span>
                </div>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-zinc-400">
                  {pack.description}
                </p>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                  <p className="text-2xl font-extrabold text-white">
                    {pack.priceLabel} ₽
                  </p>
                  <PlanButton
                    courseId={pack.courseId}
                    label="Купить пакет"
                    loginHref={PAGE_PATH}
                    size="compact"
                    variant={pack.variant}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="generator-steps-title"
          className="mt-4 rounded-[1.75rem] border border-white/[0.07] bg-[#0a0a0a]/60 p-5 backdrop-blur-xl sm:p-7"
        >
          <h2
            className="text-lg font-extrabold tracking-tight text-white sm:text-xl"
            id="generator-steps-title"
          >
            Как это работает
          </h2>

          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GENERATOR_STEPS.map((step, index) => (
              <li
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
                key={step.title}
              >
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-zinc-300 tabular-nums"
                >
                  {index + 1}
                </span>
                <p className="mt-3 text-sm font-semibold text-white">
                  {step.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>

          <p className="mt-5 max-w-3xl text-xs leading-relaxed text-zinc-500">
            Модель приходит в миллиметрах: 120 мм по самому большому габариту,
            поэтому её можно сразу открыть в слайсере. Готовый STL хранится на
            сервере временно — скачайте файл сразу после генерации.
          </p>
        </section>

        <GeneratorPhotoExample />
      </main>
    </div>
  );
}
