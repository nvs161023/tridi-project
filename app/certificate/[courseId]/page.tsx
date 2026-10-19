import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CertificateActions } from "@/app/certificate/[courseId]/CertificateActions";
import { Header } from "@/components/Header";
import { CertificateSheet } from "@/components/certificate/CertificateSheet";
import { PartnerBonus } from "@/components/certificate/PartnerBonus";
import { createCertificate, type Certificate } from "@/lib/certificates";
import {
  getCourseCompletionFromRows,
  readCourseProgressRows,
  type CourseCompletion,
} from "@/lib/course-completion";
import { LEVELS, type CourseLevel } from "@/lib/course-levels";
import { LESSON_FORMS, TEST_FORMS, pluralize } from "@/lib/course-stats";
import { resolveCurrentUser } from "@/lib/current-user";
import { resolveSiteUrl } from "@/lib/site-url";
import { hasCourseAccess } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

type CertificatePageProps = {
  params: Promise<{ courseId: string }>;
};

/**
 * Next.js отдаёт сегмент уже раскодированным, но ключи курсов приходят из
 * адреса и могут быть закодированы — приводим их к одному виду.
 */
function normalizeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Уровень по ключу из адреса: /certificate/basic, /certificate/engineer, … */
function findLevel(courseId: string): CourseLevel | undefined {
  return LEVELS.find((level) => level.key === normalizeSegment(courseId));
}

export async function generateMetadata({
  params,
}: CertificatePageProps): Promise<Metadata> {
  const { courseId } = await params;
  const level = findLevel(courseId);

  return {
    title: level
      ? `Сертификат: ${level.shortTitle} — TriDi`
      : "Сертификат не найден — TriDi",
    // Личный документ не должен попадать в поиск, даже если ссылку кто-то
    // опубликует: в нём имя ученика.
    robots: { index: false, follow: false },
  };
}

/** Общая рамка страниц сертификата: шапка сайта и тёмный фон на экране. */
function CertificatePageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 print:min-h-0 print:bg-white print:text-[#14243f]">
      <Header />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}

/** Заголовок и пояснение на экране; на печать не попадают. */
function ScreenIntro({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8 print:hidden">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
        Сертификат TriDi
      </p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300">
        {description}
      </p>
    </div>
  );
}

/** Ссылки «назад» и «продолжить» — одинаковые во всех состояниях. */
function BackLinks({ level }: { level: CourseLevel }) {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      <Link
        href="/dashboard"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <span aria-hidden>←</span>
        В личный кабинет
      </Link>
      <Link
        href={level.href}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        Продолжить курс
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

/** Одна шкала прогресса: уроки или тесты. */
function ProgressMeter({
  label,
  done,
  total,
  barClassName,
  hint,
}: {
  label: string;
  done: number;
  total: number;
  barClassName: string;
  hint: string;
}) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-slate-200">{label}</p>
        <p className="text-sm tabular-nums text-slate-300">
          {done} из {total}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${barClassName}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-slate-300">{hint}</p>
    </div>
  );
}

/**
 * Курс ещё не пройден. Сертификат не показываем и не подписываем: документ
 * должен подтверждать реальный результат, а не открытие страницы.
 */
function IncompleteCertificate({
  level,
  completion,
}: {
  level: CourseLevel;
  completion: CourseCompletion;
}) {
  const lessonsLeft = completion.totalLessons - completion.completedLessons;
  const testsLeft = completion.totalTests - completion.passedTests;

  return (
    <CertificatePageShell>
      <ScreenIntro
        title="Сертификат пока недоступен"
        description={`Сертификат по курсу «${level.title}» выдаётся, когда пройдены все уроки с материалом и сданы все тесты модулей. Прогресс сохраняется автоматически — можно вернуться к курсу в любой момент.`}
      />

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <ProgressMeter
            label="Уроки"
            done={completion.completedLessons}
            total={completion.totalLessons}
            barClassName="bg-blue-500"
            hint={
              lessonsLeft > 0
                ? `Осталось пройти ${lessonsLeft} ${pluralize(lessonsLeft, LESSON_FORMS)}.`
                : "Все уроки с материалом пройдены."
            }
          />
          <ProgressMeter
            label="Тесты модулей"
            done={completion.passedTests}
            total={completion.totalTests}
            barClassName="bg-violet-500"
            hint={
              testsLeft > 0
                ? `Осталось сдать ${testsLeft} ${pluralize(testsLeft, TEST_FORMS)}.`
                : "Все тесты модулей сданы."
            }
          />
        </div>
      </section>

      <BackLinks level={level} />
    </CertificatePageShell>
  );
}

/** Прогресс прочитать не удалось: не показываем нули, которые выглядят как правда. */
function ProgressProblem({ level }: { level: CourseLevel }) {
  return (
    <CertificatePageShell>
      <ScreenIntro
        title="Не удалось проверить прогресс"
        description="База временно не ответила, поэтому сертификат сейчас не выдаётся. Попробуйте обновить страницу через минуту — прогресс не потеряется."
      />
      <BackLinks level={level} />
    </CertificatePageShell>
  );
}

/** Сервер без секрета подписи: лучше ошибка, чем документ, который можно подделать. */
function CertificateUnavailable({ level }: { level: CourseLevel }) {
  return (
    <CertificatePageShell>
      <ScreenIntro
        title="Сертификат временно недоступен"
        description="Курс пройден, но выдача сертификатов на сервере ещё не настроена. Напишите в поддержку — мы поможем и включим печать."
      />
      <BackLinks level={level} />
    </CertificatePageShell>
  );
}

/**
 * Личный сертификат — /certificate/basic, /certificate/confident, …
 *
 * Страница закрыта входом: middleware не пускает гостя, а resolveCurrentUser
 * повторяет проверку на случай запроса мимо прослойки. Сертификат создаётся
 * только после проверки завершения курса по строкам lesson_progress — открыть
 * подписанный документ «просто так» нельзя.
 */
export default async function CertificatePage({
  params,
}: CertificatePageProps) {
  const { courseId } = await params;
  const level = findLevel(courseId);

  if (!level) {
    notFound();
  }

  const supabase = await createClient();
  const identity = await resolveCurrentUser(supabase);

  if (!identity) {
    redirect(
      `/auth/login?next=${encodeURIComponent(`/certificate/${level.key}`)}`,
    );
  }

  const [progress, fullCourse] = await Promise.all([
    readCourseProgressRows(supabase, identity.id, level.key),
    // Пакет pro — это три платных уровня. На бланке он подписывается как
    // «Полный курс», поэтому флаг входит в HMAC-токен и не меняется задним числом.
    hasCourseAccess(supabase, identity.id, "pro"),
  ]);

  if (progress.failed) {
    return <ProgressProblem level={level} />;
  }

  const completion = getCourseCompletionFromRows(level.key, progress.rows);

  if (!completion.isComplete) {
    return <IncompleteCertificate level={level} completion={completion} />;
  }

  let certificate: Certificate;

  try {
    certificate = createCertificate({
      userId: identity.id,
      name: identity.name ?? "",
      course: level.key,
      fullCourse,
      issuedAt: completion.issuedAt,
    });
  } catch (error) {
    // Секрета подписи нет (production без CERTIFICATE_SECRET). Не показываем
    // неподписанный бланк: его нельзя было бы проверить.
    console.error("Не удалось создать сертификат:", error);
    return <CertificateUnavailable level={level} />;
  }

  const siteUrl = await resolveSiteUrl();
  const verifyUrl = `${siteUrl}/verify/${certificate.token}`;

  return (
    <CertificatePageShell>
      <div className="print:hidden">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span aria-hidden>←</span>
            В личный кабинет
          </Link>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-xs text-slate-300">
            № {certificate.number}
          </span>
        </div>

        <ScreenIntro
          title={`Курс «${level.shortTitle}» пройден`}
          description={`Сертификат выдан на имя ${certificate.name}. Его можно сохранить в PDF, распечатать или отправить ссылку на публичную проверку — QR-код и подпись подтвердят документ без доступа к вашему аккаунту.`}
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CertificateActions verifyUrl={verifyUrl} />
          <a
            href={verifyUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-blue-300 underline-offset-4 transition-colors hover:text-blue-200 hover:underline"
          >
            Открыть публичную проверку ↗
          </a>
        </div>

        <PartnerBonus />
      </div>

      <CertificateSheet
        level={level}
        certificate={certificate}
        verifyUrl={verifyUrl}
      />

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-slate-300 print:hidden">
        При печати выберите «Сохранить как PDF» и альбомную ориентацию A4. QR-код
        на сертификате ведёт на страницу публичной проверки: подпись подтверждает
        имя, курс и дату выдачи.
      </p>
    </CertificatePageShell>
  );
}
