import Link from "next/link";

import courseData from "@/data/course.json";

type Benefit = {
  icon: string;
  title: string;
  description: string;
};

const { modules: courseModules, totalLessons } = courseData;

const benefits: Benefit[] = [
  {
    icon: "🎓",
    title: "12 уроков с практикой",
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

function pluralizeLessons(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) {
    return "уроков";
  }

  if (mod10 === 1) {
    return "урок";
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return "урока";
  }

  return "уроков";
}

export default function Home() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-base font-bold">
            <span aria-hidden>🖨️</span>
            <span>3D-печать с нуля</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 sm:flex">
            <a className="transition-colors hover:text-blue-400" href="#benefits">
              Что вы получите
            </a>
            <a className="transition-colors hover:text-blue-400" href="#program">
              Программа
            </a>
            <a className="transition-colors hover:text-blue-400" href="#about">
              О проекте
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/25 blur-3xl sm:h-[32rem] sm:w-[32rem]"
          />
          <div className="relative mx-auto max-w-6xl px-5 py-20 text-center sm:px-8 sm:py-28 lg:py-36">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-blue-300 sm:text-sm">
              <span aria-hidden>🚀</span>
              {totalLessons} {pluralizeLessons(totalLessons)} · старт бесплатно
            </span>
            <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              3D-печать с нуля
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:mt-8 sm:text-2xl">
              От распаковки принтера до своей первой модели за 12 уроков
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
              Программа курса
            </p>
            <h2 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Четыре модуля — от нуля до первой модели
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              {totalLessons} {pluralizeLessons(totalLessons)} — от 10 до 30 минут
              каждый. Проходите в своём темпе и возвращайтесь к нужному уроку в
              любой момент.
            </p>

            <ol className="mt-14 space-y-6 sm:mt-16 sm:space-y-8">
              {courseModules.map((courseModule) => (
                <li
                  key={courseModule.id}
                  className="rounded-3xl border border-white/10 bg-slate-900/60 p-7 sm:p-9"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
                    <span
                      aria-hidden
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-extrabold text-white"
                    >
                      {courseModule.id}
                    </span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-bold text-white sm:text-2xl">
                          Модуль {courseModule.id}: {courseModule.title}
                        </h3>
                        <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                          {courseModule.lessons.length}{" "}
                          {pluralizeLessons(courseModule.lessons.length)}
                        </span>
                      </div>

                      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                        {courseModule.lessons.map((lesson) => (
                          <li
                            key={lesson.id}
                            className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                          >
                            <span className="flex items-center gap-3 text-sm font-medium text-slate-200">
                              <span className="font-mono text-xs font-semibold text-blue-400">
                                {String(lesson.id).padStart(2, "0")}
                              </span>
                              {lesson.title}
                            </span>
                            <span className="shrink-0 text-xs text-slate-400">
                              {lesson.duration}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
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
                {totalLessons} {pluralizeLessons(totalLessons)} пройдены,
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
