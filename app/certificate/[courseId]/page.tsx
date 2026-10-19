import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CertificateActions } from "@/app/certificate/[courseId]/CertificateActions";
import { Header } from "@/components/Header";
import {
  createCertificate,
  formatCertificateDate,
  type Certificate,
} from "@/lib/certificates";
import {
  COURSE_TEST_TYPES,
  getCourseCompletionFromRows,
  type CourseCompletion,
  type CourseProgressRow,
} from "@/lib/course-completion";
import { LEVELS, type CourseLevel } from "@/lib/course-levels";
import { LESSON_FORMS, TEST_FORMS, pluralize } from "@/lib/course-stats";
import { resolveCurrentUser } from "@/lib/current-user";
import { resolveSiteUrl } from "@/lib/site-url";
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

/** Результат чтения прогресса: строки либо честная ошибка без выдуманных нулей. */
type ProgressRead =
  | { rows: CourseProgressRow[]; failed: false }
  | { rows: []; failed: true };

/**
 * Читает уроки и тесты одного курса.
 *
 * Сначала пробуем полный набор колонок. Если база ещё без миграции
 * pro_course_access.sql (нет course_type), повторяем запрос без него: старые
 * строки относятся к базовому курсу, и сертификат по ним не выдаётся, пока нет
 * строк тестов. Так страница не падает, а честно показывает незавершённость.
 */
async function readProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  level: CourseLevel,
): Promise<ProgressRead> {
  const fullResult = await supabase
    .from("lesson_progress")
    .select("course_type, lesson_id, completed_at")
    .eq("user_id", userId)
    .in("course_type", [level.key, COURSE_TEST_TYPES[level.key]]);

  if (!fullResult.error) {
    return {
      rows: (fullResult.data as CourseProgressRow[] | null) ?? [],
      failed: false,
    };
  }

  const fallbackResult = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed_at")
    .eq("user_id", userId);

  if (fallbackResult.error) {
    return { rows: [], failed: true };
  }

  return {
    rows: (fallbackResult.data as CourseProgressRow[] | null) ?? [],
    failed: false,
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
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-400">
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
        <p className="text-sm tabular-nums text-slate-400">
          {done} из {total}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${barClassName}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-slate-400">{hint}</p>
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

/** CSS печати: один лист A4 в альбомной ориентации без полей браузера. */
const PRINT_STYLES = `
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .certificate-sheet {
    width: 297mm !important;
    height: 208mm !important;
    min-height: 0 !important;
    max-width: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    aspect-ratio: auto !important;
  }
}
`;

/**
 * Сам бланк сертификата.
 *
 * На экране это карточка с пропорциями листа A4 (альбомная ориентация), при
 * печати — ровно 297×208 мм. Высота чуть меньше 210 мм: некоторые браузеры
 * добавляют доли миллиметра и создают вторую пустую страницу.
 *
 * Ссылка проверки печатается мелко внизу: по ней любой человек может открыть
 * /verify/[id] и убедиться, что имя и курс не подделаны.
 */
function CertificateSheet({
  level,
  certificate,
  verifyUrl,
}: {
  level: CourseLevel;
  certificate: Certificate;
  verifyUrl: string;
}) {
  return (
    <>
      <style>{PRINT_STYLES}</style>

      <article
        aria-label={`Сертификат TriDi: ${level.title}, ${certificate.name}`}
        className="certificate-sheet relative mx-auto mt-8 min-h-[560px] w-full max-w-[1100px] overflow-hidden rounded-[1.75rem] bg-[#fbf6e8] text-[#14243f] shadow-2xl shadow-black/40 sm:aspect-[297/210] sm:min-h-0 print:mt-0"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 border-[10px] border-[#13233f] sm:border-[14px] print:border-[12mm]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[18px] border border-[#c1993f] sm:inset-[26px] print:inset-[17mm]"
        />

        <div className="relative flex h-full flex-col px-[9%] py-[6%] print:px-[12mm] print:py-[9mm]">
          <div className="flex items-center justify-between gap-4 border-b border-[#14243f]/15 pb-2 text-[7px] uppercase tracking-[0.2em] text-[#14243f]/65 sm:pb-3 sm:text-[10px] print:text-[9pt]">
            <span className="text-[16px] font-black tracking-[0.32em] text-[#14243f] sm:text-[22px] print:text-[21pt]">
              TRIDI
            </span>
            <span>Онлайн-школа 3D-печати</span>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center py-4 text-center sm:py-[2%]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.48em] text-[#a17c28] sm:text-xs print:text-[11pt]">
              Сертификат
            </p>

            <div className="mt-2 flex w-[62%] items-center gap-3 sm:mt-[2%]">
              <span className="h-px flex-1 bg-[#c1993f]/70" />
              <span aria-hidden className="text-[8px] text-[#c1993f]">
                ◆
              </span>
              <span className="h-px flex-1 bg-[#c1993f]/70" />
            </div>

            <p className="mt-2 text-[8px] uppercase tracking-[0.3em] text-[#14243f]/60 sm:mt-[2%] sm:text-[10px] print:text-[9.5pt]">
              о прохождении курса
            </p>
            <h2 className="mt-1 max-w-[92%] text-[clamp(0.95rem,2.3vw,1.85rem)] font-bold leading-snug print:text-[19pt]">
              {level.title}
            </h2>

            <p className="mt-3 text-[7px] uppercase tracking-[0.26em] text-[#14243f]/55 sm:mt-[2.5%] sm:text-[9px] print:text-[8.5pt]">
              выдан
            </p>
            <p className="mt-1 max-w-[94%] break-words text-[clamp(1.45rem,4vw,3.1rem)] font-bold leading-tight print:text-[31pt]">
              {certificate.name}
            </p>
            <div className="mt-2 h-px w-[48%] bg-[#c1993f]/70" />

            <p className="mt-3 max-w-[50rem] text-[clamp(0.55rem,1.05vw,0.9rem)] leading-relaxed text-[#33415c] sm:mt-[2.5%] print:text-[10.5pt]">
              Курс пройден полностью: все уроки с материалом изучены, все тесты
              модулей сданы.
            </p>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 border-t border-[#14243f]/15 pt-3 text-[7px] sm:pt-[2%] sm:text-[10px] print:text-[9.5pt]">
            <div>
              <p className="uppercase tracking-[0.18em] text-[#14243f]/55">
                Дата выдачи
              </p>
              <p className="mt-1 font-semibold">
                {formatCertificateDate(certificate.issuedAt)}
              </p>
            </div>

            <div className="min-w-[90px] text-center sm:min-w-[150px]">
              <p className="font-serif text-[clamp(0.9rem,2vw,1.6rem)] italic leading-none text-[#14243f] print:text-[17pt]">
                TriDi
              </p>
              <p className="mt-1 border-t border-[#14243f]/35 px-2 pt-1 text-[6px] uppercase tracking-[0.16em] text-[#14243f]/55 sm:text-[8px] print:text-[7.5pt]">
                Основатель школы
              </p>
            </div>

            <div className="text-right">
              <p className="uppercase tracking-[0.18em] text-[#14243f]/55">
                Номер
              </p>
              <p className="mt-1 font-mono font-semibold tracking-[0.04em]">
                {certificate.number}
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-baseline justify-center gap-x-2 text-[5.5px] leading-snug text-[#14243f]/55 sm:mt-[1.5%] sm:text-[7px] print:text-[6.5pt]">
            <span className="uppercase tracking-[0.14em]">
              Проверка подлинности:
            </span>
            <span className="break-all font-mono">{verifyUrl}</span>
          </div>
        </div>
      </article>
    </>
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

  const progress = await readProgress(supabase, identity.id, level);

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
          description={`Сертификат выдан на имя ${certificate.name}. Его можно сохранить в PDF, распечатать или отправить ссылку на публичную проверку — работодателю не нужен доступ к вашему аккаунту.`}
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
      </div>

      <CertificateSheet
        level={level}
        certificate={certificate}
        verifyUrl={verifyUrl}
      />

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-slate-500 print:hidden">
        При печати выберите «Сохранить как PDF», если нужен файл. Ссылка внизу
        сертификата ведёт на страницу проверки: подпись подтверждает имя, курс и
        дату выдачи.
      </p>
    </CertificatePageShell>
  );
}

