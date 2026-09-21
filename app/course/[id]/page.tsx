import Link from "next/link";

import lessonsData from "@/data/lessons.json";

type LessonBlock = {
  type: string;
  title?: string;
  content?: string;
  items?: string[];
  steps?: { title: string; text: string }[];
};

type Lesson = {
  id: number;
  title: string;
  duration: string;
  module: string;
  blocks: LessonBlock[];
};

const lessons: Lesson[] = lessonsData;
const totalLessons = lessons.length;

const calloutStyles = {
  tip: {
    icon: "💡",
    card: "border-emerald-500/30 bg-emerald-500/10",
    title: "text-emerald-200",
    body: "text-emerald-100/85",
  },
  warning: {
    icon: "⚠️",
    card: "border-amber-500/40 bg-amber-500/10",
    title: "text-amber-200",
    body: "text-amber-100/85",
  },
  analogy: {
    icon: "🧩",
    card: "border-violet-500/30 bg-violet-500/10",
    title: "text-violet-200",
    body: "text-violet-100/85",
  },
} as const;

type CalloutType = keyof typeof calloutStyles;

type LessonPageProps = {
  params: Promise<{ id: string }>;
};

function parseLessonId(rawId: string): number | null {
  const match = rawId.match(/\d+/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);

  return Number.isFinite(parsed) ? parsed : null;
}

function lessonHref(id: number): string {
  return `/course/lesson-${id}`;
}

export function generateStaticParams() {
  return lessons.map((lesson) => ({ id: `lesson-${lesson.id}` }));
}

export async function generateMetadata({ params }: LessonPageProps) {
  const { id } = await params;
  const lessonId = parseLessonId(id);
  const lesson = lessons.find((item) => item.id === lessonId);

  return {
    title: lesson
      ? `${lesson.title} — 3D-печать с нуля`
      : "Урок не найден — 3D-печать с нуля",
  };
}

function BlockTitle({ children }: { children?: string }) {
  if (!children) {
    return null;
  }

  return (
    <h2 className="text-2xl font-bold text-white sm:text-3xl">{children}</h2>
  );
}

function BlockView({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case "text":
      return (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
          <BlockTitle>{block.title}</BlockTitle>
          <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
            {block.content}
          </p>
        </section>
      );

    case "list":
      if (!block.items || block.items.length === 0) {
        return null;
      }

      return (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
          <BlockTitle>{block.title}</BlockTitle>
          <ul className="mt-6 space-y-4">
            {block.items.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                />
                <span className="text-base leading-relaxed text-slate-300">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </section>
      );

    case "steps":
      if (!block.steps || block.steps.length === 0) {
        return null;
      }

      return (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
          <BlockTitle>{block.title}</BlockTitle>
          <ol className="mt-6 space-y-6">
            {block.steps.map((step, index) => (
              <li key={step.title} className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-base font-extrabold text-white"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-white sm:text-xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-slate-400">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      );

    case "tip":
    case "warning":
    case "analogy": {
      const style = calloutStyles[block.type as CalloutType];

      return (
        <aside
          className={`flex items-start gap-4 rounded-3xl border p-7 sm:p-9 ${style.card}`}
        >
          <span aria-hidden className="text-2xl">
            {style.icon}
          </span>
          <div>
            <h2 className={`text-lg font-bold sm:text-xl ${style.title}`}>
              {block.title}
            </h2>
            <p className={`mt-2 text-base leading-relaxed ${style.body}`}>
              {block.content}
            </p>
          </div>
        </aside>
      );
    }

    default:
      return null;
  }
}

function LessonNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex max-w-3xl flex-col items-start px-5 py-20 sm:px-8 sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
          Ошибка 404
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Урок не найден
        </h1>
        <p className="mt-6 text-base leading-relaxed text-slate-400 sm:text-lg">
          Такого урока нет или ссылка устарела. Вернитесь на главную — там
          программа всего курса из {totalLessons} уроков.
        </p>
        <Link
          href="/"
          className="mt-10 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
        >
          Вернуться на главную
          <span aria-hidden>→</span>
        </Link>
      </main>
    </div>
  );
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { id } = await params;
  const lessonId = parseLessonId(id);
  const lesson = lessons.find((item) => item.id === lessonId);

  if (!lesson) {
    return <LessonNotFound />;
  }

  const progressPercent = Math.round((lesson.id / totalLessons) * 100);
  const isLastLesson = lesson.id === totalLessons;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span aria-hidden>←</span>
              Назад к курсу
            </Link>
            {lesson.id > 1 ? (
              <Link
                href={lessonHref(lesson.id - 1)}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span aria-hidden>←</span>
                Предыдущий урок
              </Link>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 sm:text-sm">
              <span>
                Урок {lesson.id} из {totalLessons}
              </span>
              <span className="text-blue-400">{progressPercent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Прогресс курса"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
          {lesson.module}
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          {lesson.title}
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-300 sm:text-sm">
            <span aria-hidden>⏱️</span>
            {lesson.duration}
          </span>
          <span className="text-sm text-slate-400">
            Урок {lesson.id} из {totalLessons}
          </span>
        </div>

        <div className="mt-12 space-y-8 sm:mt-16 sm:space-y-10">
          {lesson.blocks.map((block, index) => (
            <BlockView
              key={`${lesson.id}-${index}-${block.type}`}
              block={block}
            />
          ))}
        </div>

        <div className="mt-12 sm:mt-16">
          {isLastLesson ? (
            <div className="rounded-3xl border border-blue-500/40 bg-blue-500/10 p-7 text-center sm:p-9">
              <p className="text-2xl font-extrabold text-white sm:text-3xl">
                <span aria-hidden>🎉</span> Курс пройден! Доступ к конструктору
                открыт
              </p>
              <p className="mt-4 text-base leading-relaxed text-slate-300">
                Все {totalLessons} уроков позади. Осталось собрать свою первую
                модель: вазу, брелок или светильник.
              </p>
              <Link
                href="/constructor"
                className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Перейти в конструктор
                <span aria-hidden>→</span>
              </Link>
            </div>
          ) : (
            <Link
              href={lessonHref(lesson.id + 1)}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Пройти урок
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
