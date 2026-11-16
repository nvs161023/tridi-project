import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Header } from "@/components/Header";
import { Image3DGenerator } from "@/components/generator/Image3DGenerator";
import { authHref } from "@/lib/auth-redirect";
import { getUserCredits } from "@/lib/credits";
import { resolveUserId } from "@/lib/current-user";
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
 * проверяется — генерацию оплачивают кредиты `user_credits`, и решает это
 * `/api/generate-3d`: гость получает 401, нулевой баланс — 402.
 *
 * `noindex`: инструмент под входом, в поиске ему делать нечего.
 */

const PAGE_PATH = "/3d-generator";

export const metadata: Metadata = {
  title: "Создать 3D из фото",
  description:
    "Загрузите 1–4 фотографии предмета и получите 3D-модель для печати: сеть соберёт силуэт, мы очистим сетку и приведём её к 120 мм.",
  robots: { index: false, follow: false },
};

/** Страница читает cookies и кредиты — собираем её на каждый запрос. */
export const dynamic = "force-dynamic";

/** Четыре шага под рабочей областью: коротко объясняют весь путь. */
const GENERATOR_STEPS = [
  {
    title: "Загрузите фото",
    text: "1–4 снимка предмета: спереди, слева, сзади и справа. Браузер сожмёт кадры сам.",
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

export default async function ThreeDGeneratorPage() {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(authHref("/auth/login", PAGE_PATH));
  }

  // `null` — счётчик недоступен, и это не «0 кредитов»: показываем прочерк,
  // а не приглашение пополнить баланс из-за сбоя базы. Генерацию всё равно
  // проверит `/api/generate-3d`.
  const credits = await getUserCredits(userId);

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

            <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                Осталось генераций
              </p>
              <p className="mt-1 text-3xl leading-none font-bold text-white tabular-nums">
                {credits === null ? "—" : credits}
              </p>
              <p className="mt-2 max-w-52 text-[11px] leading-relaxed text-zinc-500">
                Одна генерация — один кредит. Если сеть отказала, кредит
                возвращается.
              </p>
            </div>
          </div>
        </section>

        <Image3DGenerator credits={credits} />

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
      </main>
    </div>
  );
}
