import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Header } from "@/components/Header";
import { CourseReviews } from "@/components/reviews/CourseReviews";
import { formatCertificateDate } from "@/lib/certificates";
import {
  getCourseCompletionFromRows,
  readCourseProgressRows,
  type CourseCompletion,
} from "@/lib/course-completion";
import { LEVELS, type CourseLevel, type LevelKey } from "@/lib/course-levels";
import { LESSON_FORMS, TEST_FORMS, pluralize } from "@/lib/course-stats";
import { resolveCurrentUser } from "@/lib/current-user";
import {
  getCourseReviewStats,
  getCourseReviews,
  hasUserReviewedCourse,
} from "@/lib/reviews";
import { getPurchasedCourses, hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

type GraduationPageProps = {
  params: Promise<{ id: string }>;
};

/** Цвета уровня: те же акценты, что на страницах уроков. */
type LevelTheme = {
  icon: string;
  accentText: string;
  border: string;
  panel: string;
  button: string;
  bar: string;
};

const LEVEL_THEMES: Record<LevelKey, LevelTheme> = {
  basic: {
    icon: "🌱",
    accentText: "text-blue-300",
    border: "border-blue-500/30",
    panel: "from-blue-500/15 via-slate-900/40 to-slate-950",
    button:
      "bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 focus-visible:ring-blue-400",
    bar: "bg-blue-500",
  },
  confident: {
    icon: "🎯",
    accentText: "text-emerald-300",
    border: "border-emerald-500/30",
    panel: "from-emerald-500/15 via-slate-900/40 to-slate-950",
    button:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 focus-visible:ring-emerald-300",
    bar: "bg-emerald-500",
  },
  engineer: {
    icon: "📐",
    accentText: "text-violet-300",
    border: "border-violet-500/30",
    panel: "from-violet-500/15 via-slate-900/40 to-slate-950",
    button:
      "bg-violet-600 text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 focus-visible:ring-violet-300",
    bar: "bg-violet-500",
  },
  profit: {
    icon: "💰",
    accentText: "text-rose-300",
    border: "border-rose-500/30",
    panel: "from-rose-500/15 via-slate-900/40 to-slate-950",
    button:
      "bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-500 focus-visible:ring-rose-300",
    bar: "bg-rose-500",
  },
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ru-RU").format(price);

/**
 * Ключ курса приходит из адреса: приводим сегмент к одному виду, как на
 * страницах сертификата и уроков.
 */
function normalizeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Уровень по ключу из адреса: /course/confident/complete, /course/basic/complete, … */
function findLevel(rawId: string): CourseLevel | undefined {
  return LEVELS.find((level) => level.key === normalizeSegment(rawId));
}

export async function generateMetadata({
  params,
}: GraduationPageProps): Promise<Metadata> {
  const { id } = await params;
  const level = findLevel(id);

  return {
    title: level
      ? `Центр выпускника: ${level.shortTitle} — TriDi`
      : "Центр выпускника — TriDi",
    // Личная страница: в ней прогресс, отзывы и подарок выпускнику.
    robots: { index: false, follow: false },
  };
}

/** Страница читает cookies и прогресс — собираем её на каждый запрос. */
export const dynamic = "force-dynamic";

/** Общая рамка: шапка сайта и тёмный фон. */
function GraduationShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-slate-100">
      <Header />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>
    </div>
  );
}

/** Одна цифра в герое: уроки, тесты или дата завершения. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
      <p className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase sm:text-xs">
        {label}
      </p>
    </div>
  );
}

/** Карточка полезного действия: сертификат, библиотека профилей или форум. */
function HubCard({
  icon,
  title,
  description,
  href,
  linkLabel,
  accentText,
  secondaryHref,
  secondaryLabel,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  accentText: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6">
      <span aria-hidden className="text-3xl">
        {icon}
      </span>
      <h2 className="mt-4 text-xl font-extrabold tracking-tight text-white">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        {description}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5">
        <Link
          href={href}
          className={`inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${accentText}`}
        >
          {linkLabel}
          <span aria-hidden>→</span>
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="text-xs font-semibold text-slate-300 transition-colors hover:text-white"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

/** Чего не хватает до сертификата — словами, без отрицательных чисел. */
function describeRemaining(completion: CourseCompletion): string {
  const lessonsLeft = Math.max(
    completion.totalLessons - completion.completedLessons,
    0,
  );
  const testsLeft = Math.max(completion.totalTests - completion.passedTests, 0);
  const parts: string[] = [];

  if (lessonsLeft > 0) {
    parts.push(`${lessonsLeft} ${pluralize(lessonsLeft, LESSON_FORMS)}`);
  }

  if (testsLeft > 0) {
    parts.push(`${testsLeft} ${pluralize(testsLeft, TEST_FORMS)}`);
  }

  if (parts.length === 0) {
    return "Все шаги курса закрыты — можно оставлять отзыв.";
  }

  return `Не закрыто: ${parts.join(" и ")}.`;
}

/** Куда ведёт кнопка уровня: бесплатный стартует с первого урока, платный — с витрины. */
function levelHref(level: CourseLevel, hasAccess: boolean): string {
  if (level.isFree) {
    return "/course/lesson-1";
  }

  return hasAccess ? `/course/${level.key}` : `/courses/${level.key}`;
}

/**
 * «Центр выпускника» — финальная точка уровня: /course/<уровень>/complete.
 *
 * Здесь сходятся все итоги курса:
 *  - поздравление и прогресс (уроки, тесты, дата завершения);
 *  - сертификат с подписью: полный доступ, если курс закрыт, иначе прогресс;
 *  - библиотека профилей как следующий шаг после курса;
 *  - форум и отзывы, которые может оставить только выпускник;
 *  - следующий уровень школы с ценой и кнопкой.
 *
 * Страница защищена middleware (/course/*), но пользователя всё равно
 * проверяем: прямой рендер без сессии не должен показывать чужие отзывы.
 * Прогресс читается тем же модулем, что и сертификат, поэтому цифры и статус
 * не расходятся между страницами.
 */
export default async function GraduationPage({ params }: GraduationPageProps) {
  const { id } = await params;
  const level = findLevel(id);

  if (!level) {
    notFound();
  }

  const supabase = await createClient();
  const identity = await resolveCurrentUser(supabase);

  if (!identity) {
    const next = encodeURIComponent(`/course/${level.key}/complete`);

    redirect(`/auth/login?next=${next}`);
  }

  const [
    progressRead,
    proActive,
    purchasedCourses,
    reviews,
    hasReviewed,
  ] = await Promise.all([
    readCourseProgressRows(supabase, identity.id, level.key),
    hasActiveSubscription(supabase, identity.id),
    getPurchasedCourses(supabase, identity.id),
    getCourseReviews(supabase, level.key),
    hasUserReviewedCourse(supabase, level.key, identity.id),
  ]);

  const theme = LEVEL_THEMES[level.key];
  const completion = progressRead.failed
    ? null
    : getCourseCompletionFromRows(level.key, progressRead.rows);
  const stats = getCourseReviewStats(reviews);
  const certificateHref = `/certificate/${level.key}`;

  // Если прогресс не прочитался, не показываем выдуманные нули: честно
  // предлагаем вернуться в кабинет и повторить попытку.
  if (!completion) {
    return (
      <GraduationShell>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
        >
          <span aria-hidden>←</span>
          В личный кабинет
        </Link>
        <section className="mt-8 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-7 sm:p-10">
          <p className="text-sm font-semibold tracking-widest text-amber-200 uppercase">
            Центр выпускника
          </p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Не удалось загрузить прогресс
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-200">
            Мы не получили данные курса «{level.title}» и не хотим показывать
            случайные цифры. Обновите страницу через минуту — прогресс и
            сертификат никуда не денутся.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={certificateHref}
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Открыть сертификат
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Вернуться в кабинет
            </Link>
          </div>
        </section>
      </GraduationShell>
    );
  }

  const progressPercent =
    completion.totalLessons > 0
      ? Math.round(
          (completion.completedLessons / completion.totalLessons) * 100,
        )
      : 0;

  // «Центр выпускника» — экран после последнего урока или теста. Прямой заход
  // на незавершённый курс возвращает в кабинет: праздновать пока нечего, а
  // сертификат и отзыв доступны только выпускнику.
  if (!completion.isComplete) {
    redirect("/dashboard");
  }

  const completionDate = completion.issuedAt
    ? formatCertificateDate(completion.issuedAt.slice(0, 10))
    : "—";
  const currentIndex = LEVELS.findIndex((item) => item.key === level.key);
  // Показываем ровно три карточки: сначала следующие уровни, затем остальные,
  // чтобы блок не превращался в две карточки на «Уверенном» или одну на
  // «Инженере».
  const offeredLevels = [
    ...LEVELS.slice(currentIndex + 1),
    ...LEVELS.slice(0, currentIndex),
  ].slice(0, 3);

  return (
    <GraduationShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden>←</span>
          В личный кабинет
        </Link>
        <Link
          href={level.href}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
        >
          Программа уровня
          <span aria-hidden>→</span>
        </Link>
      </div>

      <section
        className={`mt-8 overflow-hidden rounded-[2rem] border bg-gradient-to-br p-7 sm:p-10 ${theme.border} ${theme.panel}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p
              className={`text-xs font-semibold tracking-[0.2em] uppercase sm:text-sm ${theme.accentText}`}
            >
              {completion.isComplete
                ? "Курс пройден"
                : `Центр выпускника · ${level.shortTitle}`}
            </p>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              {completion.isComplete
                ? `Поздравляем! Вы прошли уровень «${level.shortTitle}»!`
                : level.title}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-200 sm:text-lg">
              {completion.isComplete
                ? `Позади ${completion.totalLessons} ${pluralize(completion.totalLessons, LESSON_FORMS)} и ${completion.totalTests} ${pluralize(completion.totalTests, TEST_FORMS)} курса «${level.title}». Сертификат подписан, а внизу можно оставить отзыв — он поможет тем, кто только выбирает курс.`
                : `Вы прошли ${completion.completedLessons} из ${completion.totalLessons} ${pluralize(completion.totalLessons, LESSON_FORMS)}. ${describeRemaining(completion)}`}
            </p>
          </div>
          <span
            aria-hidden
            className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 text-3xl sm:h-20 sm:w-20 sm:text-4xl"
          >
            {theme.icon}
          </span>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat
            value={`${completion.completedLessons}/${completion.totalLessons}`}
            label="Уроки"
          />
          <Stat
            value={`${completion.passedTests}/${completion.totalTests}`}
            label="Тесты"
          />
          <Stat
            value={
              completion.isComplete ? completionDate : `${progressPercent}%`
            }
            label={completion.isComplete ? "Завершение" : "Прогресс"}
          />
        </div>

        <div className="mt-6">
          <div
            className="h-2 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label="Прогресс курса"
          >
            <div
              className={`h-full rounded-full ${theme.bar}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {completion.completedLessons} из {completion.totalLessons}{" "}
            {pluralize(completion.totalLessons, LESSON_FORMS)} пройдено
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {completion.isComplete ? (
            <Link
              href={certificateHref}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${theme.button}`}
            >
              Открыть и скачать сертификат
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${theme.button}`}
            >
              Вернуться к курсу
              <span aria-hidden>→</span>
            </Link>
          )}
          <Link
            href="/tools"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Перейти к инструментам
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <HubCard
          icon="🎓"
          title={completion.isComplete ? "Сертификат готов" : "Сертификат впереди"}
          description={
            completion.isComplete
              ? "Документ с подписью основателя школы и QR-кодом проверки. Сохраните PDF, распечатайте или отправьте ссылку работодателю."
              : `${describeRemaining(completion)} Как только закроете все шаги, здесь появится подписанный сертификат.`
          }
          href={certificateHref}
          linkLabel={
            completion.isComplete ? "Открыть и скачать сертификат" : "Посмотреть прогресс"
          }
          accentText={theme.accentText}
        />
        <HubCard
          icon="📦"
          title="Библиотека профилей печати"
          description={
            proActive
              ? "Пакет «Всё включено» активен — все профили принтеров и материалов доступны для скачивания без ограничений."
              : "Проверенные профили принтеров и материалов для Bambu Studio, OrcaSlicer и PrusaSlicer. Импорт занимает пару минут — доступ открывает пакет «Всё включено»."
          }
          href="/profiles"
          linkLabel="Перейти в библиотеку"
          accentText={theme.accentText}
          secondaryHref={proActive ? undefined : "/courses/pro"}
          secondaryLabel={proActive ? undefined : "Что входит в пакет"}
        />
        <HubCard
          icon="💬"
          title="Добро пожаловать в клуб TriDi!"
          description="Делитесь опытом, показывайте напечатанные модели, разбирайте дефекты и помогайте новичкам — клуб открыт и после курса."
          href="/forum"
          linkLabel="Перейти на форум"
          accentText={theme.accentText}
        />
      </div>

      <div className="mt-10">
        <CourseReviews
          courseId={level.key}
          courseTitle={level.title}
          reviews={reviews}
          stats={stats}
          canReview={completion.isComplete && !hasReviewed}
          hasReviewed={hasReviewed}
        />
      </div>

      <section className="mt-12" aria-labelledby="next-levels-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
              Продолжить обучение
            </p>
            <h2
              id="next-levels-title"
              className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
            >
              Готовы к следующему уровню?
            </h2>
          </div>
          <Link
            href="/#levels"
            className={`text-sm font-semibold underline-offset-4 hover:underline ${theme.accentText}`}
          >
            Все программы
            <span aria-hidden> →</span>
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {offeredLevels.map((offer) => {
            const offerAccess =
              offer.key === "basic"
                ? false
                : proActive || purchasedCourses[offer.key];

            return (
              <article
                key={offer.key}
                className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">
                    {offer.shortTitle}
                  </p>
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-semibold tracking-wide uppercase ${
                      offerAccess
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                        : "border-white/15 bg-white/5 text-slate-300"
                    }`}
                  >
                    {offerAccess ? "Доступ открыт" : "Уровень"}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-extrabold tracking-tight text-white">
                  {offer.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {offer.subtitle}
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  {offer.lessons} {pluralize(offer.lessons, LESSON_FORMS)} ·{" "}
                  {offer.tests} {pluralize(offer.tests, TEST_FORMS)}
                </p>
                <div className="mt-auto pt-5">
                  <p className="text-lg font-extrabold text-white">
                    {offer.isFree
                      ? "Бесплатно"
                      : `${formatPrice(offer.price)} ₽`}
                  </p>
                  <Link
                    href={levelHref(offer, offerAccess)}
                    className={`mt-3 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline ${theme.accentText}`}
                  >
                    Подробнее
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </GraduationShell>
  );
}

