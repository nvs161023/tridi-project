import Link from "next/link";

import { Header } from "@/components/Header";
import coursesData from "@/data/courses.json";
import courseProData from "@/data/course-pro.json";
import { basicLessons } from "@/lib/basic-course";
import {
  LESSON_FORMS,
  MODULE_FORMS,
  formatHours,
  groupByModule,
  pluralize,
  summarizeCourse,
} from "@/lib/course-stats";

type Benefit = {
  icon: string;
  title: string;
  description: string;
};

/** Названия, подзаголовки и цена курсов — из метаданных курсов. */
const { basic: basicCourse, pro: proCourse } = coursesData;

/**
 * Модули, число уроков и часы считаются по файлам курсов — поэтому витрина не
 * может «отстать» от содержимого.
 *
 * Уроки базового курса разворачивает lib/basic-course: в файле они лежат
 * модулями, а карточке нужен список уроков и модули с числом уроков в каждом. Для
 * продвинутого курса чисел из его файла достаточно — summarizeCourse.
 */
const basicModules = groupByModule(basicLessons);
const proSummary = summarizeCourse(courseProData);

/** Сколько уроков в базовом курсе — считаем по файлу уроков. */
const totalLessons = basicLessons.length;

/**
 * Модули продвинутого курса, которые показываем на витрине. Названия берём из
 * файла курса по коду модуля, а не пишем текстом: иначе список тем «отстанет»
 * от содержимого курса.
 */
const PRO_PREVIEW_MODULE_IDS: string[] = ["B", "E2", "J", "K", "O", "T"];
const proTopics: string[] = PRO_PREVIEW_MODULE_IDS.flatMap((moduleId) => {
  const courseModule = courseProData.modules.find(
    (item) => item.module_id === moduleId,
  );

  return courseModule ? [courseModule.module_title] : [];
});

const benefits: Benefit[] = [
  {
    icon: "🎓",
    title: `${basicLessons.length} ${pluralize(basicLessons.length, LESSON_FORMS)} с практикой`,
    description:
      "Короткие видео и задания после каждого урока: печатаете детали своими руками, а не просто смотрите.",
  },
  {
    icon: "⚙️",
    title: "Настройка принтера под любой пластик",
    description:
      "Профили для PLA, PETG, ABS и TPU: температура, ретракт, адгезия и скорость — понятным языком.",
  },
  {
    icon: "🩺",
    title: "AI-диагностика проблем печати",
    description:
      "Загружаете фото брака — диагностика подсказывает причину и точные шаги исправления настроек.",
  },
  {
    icon: "🏗️",
    title: "Доступ к конструктору 3D-моделей",
    description:
      "После прохождения курсов вы получаете доступ к бесплатному конструктору ваз, брелоков и светильников сроком на один месяц всего за 1 рубль.",
  },
];

export default function Home() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/25 blur-3xl sm:h-[32rem] sm:w-[32rem]"
          />
          <div className="relative mx-auto max-w-6xl px-5 py-20 text-center sm:px-8 sm:py-28 lg:py-36">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-blue-300 sm:text-sm">
              <span aria-hidden>🚀</span>
              {totalLessons} {pluralize(totalLessons, LESSON_FORMS)} · старт
              бесплатно
            </span>
            <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              3D-печать с нуля
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:mt-8 sm:text-2xl">
              От распаковки принтера до своей первой модели за{" "}
              {basicLessons.length}{" "}
              {pluralize(basicLessons.length, LESSON_FORMS)}
            </p>
            <div className="mt-10 flex flex-col items-stretch justify-center gap-4 sm:mt-12 sm:flex-row sm:items-center sm:gap-5">
              <Link
                href="/course/lesson-1"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Начать курс бесплатно
                <span aria-hidden>→</span>
              </Link>
              <a
                href="#about"
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/15 bg-white/5 px-9 text-lg font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Узнать больше
              </a>
            </div>
            <p className="mt-8 text-sm text-slate-400">
              Без опыта и без дорогого оборудования — нужен только принтер и
              желание печатать.
            </p>
          </div>
        </section>

        <section id="benefits" className="scroll-mt-20 border-t border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
              Что вы получите
            </p>
            <h2 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Всё, чтобы печатать уверенно с первого дня
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Курс собран из практики: каждый урок заканчивается действием,
              которое приближает вас к собственной напечатанной модели.
            </p>

            <div className="mt-14 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:gap-8">
              {benefits.map((benefit) => (
                <article
                  key={benefit.title}
                  className="rounded-3xl border border-white/10 bg-white/5 p-7 transition-colors hover:border-blue-500/50 sm:p-9"
                >
                  <span
                    aria-hidden
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/15 text-3xl"
                  >
                    {benefit.icon}
                  </span>
                  <h3 className="mt-6 text-xl font-bold text-white sm:text-2xl">
                    {benefit.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-slate-400">
                    {benefit.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="program"
          className="scroll-mt-20 border-t border-white/10 bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
              Программа обучения
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Два курса: от первой печати до собственного производства
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Начните с бесплатного базового курса. Когда захочется большего —
              переходите на продвинутый: физика процессов, работа с любыми
              материалами, тонкая калибровка и печатная ферма.
            </p>

            <div className="mt-14 grid gap-6 sm:mt-16 lg:grid-cols-2 lg:gap-8">
              {/* Базовый курс — бесплатный, обычная карточка с синим акцентом */}
              <article className="flex flex-col rounded-3xl border border-blue-500/30 bg-slate-900/60 p-7 shadow-xl shadow-blue-950/40 sm:p-9">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    {basicCourse.title}
                  </h3>
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    Бесплатно
                  </span>
                </div>

                <p className="mt-3 text-base text-slate-400">
                  {basicCourse.subtitle}
                </p>

                <p className="mt-6 text-sm font-semibold tracking-wide text-blue-300">
                  {basicLessons.length}{" "}
                  {pluralize(basicLessons.length, LESSON_FORMS)} ·{" "}
                  {basicModules.length}{" "}
                  {pluralize(basicModules.length, MODULE_FORMS)} ·{" "}
                  {formatHours(basicLessons)}
                </p>

                <p className="mt-5 text-base leading-relaxed text-slate-300">
                  От распаковки до первой модели. Без сложных терминов, с
                  бытовыми аналогиями.
                </p>

                <ul className="mt-7 space-y-3">
                  {basicModules.map((basicModule) => (
                    <li
                      key={basicModule.title}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <span className="text-sm font-medium text-slate-200">
                        {basicModule.title}
                      </span>
                      <span className="shrink-0 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                        {basicModule.lessons}{" "}
                        {pluralize(basicModule.lessons, LESSON_FORMS)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-8">
                  <Link
                    href="/course/lesson-1"
                    className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    Начать бесплатно
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </article>

              {/* Продвинутый курс — премиальная карточка с золотой рамкой */}
              <article className="relative flex flex-col overflow-hidden rounded-3xl border border-amber-400/40 bg-gradient-to-b from-violet-950/50 via-slate-900/70 to-slate-900/80 p-7 shadow-xl shadow-violet-950/40 sm:p-9">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl"
                />

                <div className="relative flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    {proCourse.title}
                  </h3>
                  <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                    {proCourse.price} ₽ · включён в Pro
                  </span>
                </div>

                <p className="relative mt-3 text-base text-slate-300">
                  {proCourse.subtitle}
                </p>

                <p className="relative mt-6 text-sm font-semibold tracking-wide text-amber-200">
                  {proSummary.lessons}{" "}
                  {pluralize(proSummary.lessons, LESSON_FORMS)} ·{" "}
                  {proSummary.modules}{" "}
                  {pluralize(proSummary.modules, MODULE_FORMS)} ·{" "}
                  {proSummary.hours}
                </p>

                <p className="relative mt-5 text-base leading-relaxed text-slate-300">
                  Безопасность и химия, устройство принтера, слайсеры, ремонт и
                  ТО, инженерные расчёты, контроль качества и заработок на
                  печати.
                </p>

                <ul className="relative mt-7 space-y-3">
                  {proTopics.map((topic) => (
                    <li
                      key={topic}
                      className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200"
                    >
                      <span aria-hidden className="text-amber-300">
                        ◆
                      </span>
                      {topic}
                    </li>
                  ))}
                </ul>

                <div className="relative mt-auto pt-8">
                  <Link
                    href="/subscription"
                    className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-9 text-lg font-semibold text-slate-950 shadow-lg shadow-amber-500/25 transition-colors hover:from-amber-300 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    Узнать больше
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="about" className="scroll-mt-20 border-t border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
              О проекте
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Курс, который делает из новичка уверенного печатника
            </h2>
            <div className="mt-8 grid gap-6 text-base leading-relaxed text-slate-400 sm:mt-10 sm:text-lg lg:grid-cols-2 lg:gap-12">
              <p>
                «3D-печать с нуля» — это онлайн-курс для тех, у кого уже стоит
                принтер, но пока непонятно, с чего начать. Мы разбираем путь от
                распаковки и калибровки до стабильного результата: настройки под
                PLA, PETG, ABS и TPU, подготовка модели в слайсере, борьба с
                типовыми дефектами печати.
              </p>
              <p>
                Отдельный блок курса — AI-диагностика: загружаете фото брака и
                получаете причину вместе с решением. А когда все{" "}
                {totalLessons} {pluralize(totalLessons, LESSON_FORMS)} пройдены,
                открывается доступ к конструктору 3D-моделей: собираете вазы,
                брелоки и светильники прямо в браузере и печатаете собственный
                дизайн.
              </p>
            </div>

            <div className="mt-12 flex flex-col gap-4 sm:mt-14 sm:flex-row sm:items-center">
              <Link
                href="/course/lesson-1"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Начать курс бесплатно
                <span aria-hidden>→</span>
              </Link>
              <p className="text-sm text-slate-400 sm:text-base">
                <span aria-hidden>✅</span> Все уроки доступны абсолютно
                бесплатно.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-10 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            <span aria-hidden>🖨️</span> © {currentYear} 3D-печать с нуля. Все
            права защищены.
          </p>
          <a
            className="transition-colors hover:text-blue-400"
            href="mailto:hello@3d-printing-course.ru"
          >
            hello@3d-printing-course.ru
          </a>
        </div>
      </footer>
    </div>
  );
}
