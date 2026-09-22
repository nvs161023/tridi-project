import type { Metadata } from "next";
import Link from "next/link";

import coursesData from "@/data/courses.json";
import proLessonsData from "@/data/lessons-pro.json";
import { LESSON_FORMS, formatHours, pluralize } from "@/lib/course-stats";

import { PlanButton } from "./PlanButton";

export const metadata: Metadata = {
  title: "Тарифы — 3D-печать с нуля",
  description:
    "Free, Maker и Pro: бесплатный старт с базовым курсом, безлимит моделей и AI-диагностика, продвинутый курс с API. Выбери уровень, который подходит тебе.",
};

const { basic: basicCourse, pro: proCourse } = coursesData;

/**
 * Числа считаем, а не пишем текстом: количество уроков — из метаданных курсов,
 * длительность продвинутого курса — из data/lessons-pro.json (как на главной).
 * Так тарифы не разойдутся с содержимым курсов.
 */
const basicLessonsLabel = `${basicCourse.totalLessons} ${pluralize(basicCourse.totalLessons, LESSON_FORMS)}`;
const proLessonsLabel = `${proCourse.totalLessons} ${pluralize(proCourse.totalLessons, LESSON_FORMS)}`;
const proHoursLabel = formatHours(proLessonsData);

const freeFeatures: string[] = [
  `Базовый курс (${basicLessonsLabel})`,
  "Конструктор 3D-моделей — 3 скачивания/мес",
  "AI-диагностика — 1 запрос/мес",
];

const makerFeatures: string[] = [
  "Всё из Free",
  "Безлимит скачиваний моделей",
  "Все паттерны и материалы",
  "Коммерческая лицензия",
  "История моделей",
  "AI-диагностика — 10 запросов/мес",
];

const proFeatures: string[] = [
  "Всё из Maker",
  `Продвинутый курс (${proLessonsLabel}, ${proHoursLabel})`,
  "Пакетная генерация (50 моделей за раз)",
  "API-доступ",
  "Ранний доступ к новым функциям",
  "AI-диагностика — безлимит",
];

const faq: { question: string; answer: string }[] = [
  {
    question: "Можно ли отменить подписку?",
    answer: "Да, в любой момент, в личном кабинете",
  },
  {
    question: "Когда спишутся деньги?",
    answer: "Через 30 дней после оформления",
  },
  {
    question: "Что если я не пользуюсь?",
    answer: "Просто отмени, деньги не списываются",
  },
  {
    question: "Как оплатить?",
    answer: "Картой через ЮKassa (подключаем сейчас)",
  },
];

/** Список возможностей тарифа — одинаково выглядит во всех трёх колонках. */
function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="mt-7 space-y-3">
      {features.map((feature) => (
        <li
          key={feature}
          className="flex items-start gap-3 text-sm leading-relaxed text-slate-200 sm:text-base"
        >
          <span aria-hidden>✅</span>
          {feature}
        </li>
      ))}
    </ul>
  );
}

export default function SubscriptionPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden>←</span>
          Назад на главную
        </Link>

        <header className="mt-8 max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Тарифы
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-400 sm:text-xl">
            Выбери уровень, который подходит тебе
          </p>
        </header>

        <div className="mt-12 grid gap-6 sm:mt-14 lg:grid-cols-3 lg:gap-8">
          {/* Free — обычный тариф с синим акцентом */}
          <article className="flex flex-col rounded-3xl border border-blue-500/30 bg-slate-900/60 p-7 sm:p-9">
            <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Free
            </h2>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white">0 ₽</span>
              <span className="text-sm text-slate-400">навсегда</span>
            </p>

            <FeatureList features={freeFeatures} />

            <div className="mt-auto pt-8">
              <Link
                href="/auth/sign-up"
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Начать бесплатно
                <span aria-hidden>→</span>
              </Link>
            </div>
          </article>

          {/* Maker — выделенный тариф с бейджем сверху */}
          <article className="relative flex flex-col rounded-3xl border-2 border-blue-500 bg-slate-900/80 p-7 shadow-2xl shadow-blue-950/50 sm:p-9">
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold whitespace-nowrap text-white">
              Популярный выбор
            </span>

            <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Maker
            </h2>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white">490 ₽</span>
              <span className="text-sm text-slate-400">/мес</span>
            </p>

            <FeatureList features={makerFeatures} />

            <div className="mt-auto pt-8">
              <PlanButton label="Оформить Maker" />
            </div>
          </article>

          {/* Pro — премиальный тариф с золотой рамкой */}
          <article className="relative flex flex-col overflow-hidden rounded-3xl border-2 border-yellow-500/50 bg-gradient-to-b from-amber-500/10 via-slate-900/70 to-slate-900/80 p-7 shadow-xl shadow-amber-950/30 sm:p-9">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl"
            />

            <h2 className="relative text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Pro
            </h2>
            <p className="relative mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white">1490 ₽</span>
              <span className="text-sm text-slate-400">/мес</span>
            </p>

            <FeatureList features={proFeatures} />

            <div className="relative mt-auto pt-8">
              <PlanButton label="Оформить Pro" variant="gold" />
            </div>
          </article>
        </div>

        <section className="mt-16 sm:mt-20">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Частые вопросы
          </h2>

          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            {faq.map((item) => (
              <div
                key={item.question}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7"
              >
                <dt className="text-base font-bold text-white sm:text-lg">
                  {item.question}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-400 sm:text-base">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
