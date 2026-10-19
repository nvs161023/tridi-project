import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import {
  formatCertificateDate,
  readCertificateToken,
  type Certificate,
} from "@/lib/certificates";
import { LEVELS, type CourseLevel } from "@/lib/course-levels";

type VerifyPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Ссылка на проверку может прийти из письма или мессенджера уже закодированной.
 * Next.js обычно раскодирует сегмент сам, но повторное декодирование безопасно
 * (в токене нет символа «%»), зато разные варианты ссылки работают одинаково.
 */
function normalizeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Уровень по ключу из подписанного токена. */
function findLevel(certificate: Certificate): CourseLevel | undefined {
  return LEVELS.find((level) => level.key === certificate.course);
}

export async function generateMetadata({
  params,
}: VerifyPageProps): Promise<Metadata> {
  const { id } = await params;
  const certificate = readCertificateToken(normalizeSegment(id));

  return {
    title: certificate
      ? `Сертификат ${certificate.number} — TriDi`
      : "Сертификат не найден — TriDi",
    description: certificate
      ? "Публичная проверка сертификата TriDi: имя получателя, курс и дата выдачи подтверждены подписью."
      : "Ссылка на сертификат повреждена или подпись не совпала.",
    // Персональный документ не индексируем: ссылка предназначена для проверки,
    // а не для поисковой выдачи.
    robots: { index: false, follow: false },
  };
}

/** Общая рамка страницы проверки. */
function VerifyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <main className="mx-auto flex max-w-4xl flex-col px-5 py-12 sm:px-8 sm:py-20">
        {children}
      </main>
    </div>
  );
}

/** Строка с подписью и значением — таблица данных сертификата. */
function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-white/10 py-4 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-sm text-slate-300">{label}</dt>
      <dd className="text-base font-semibold text-white sm:text-right">
        {children}
      </dd>
    </div>
  );
}

/** Подпись верна: показываем ровно те данные, которые были подписаны. */
function ValidCertificate({
  certificate,
  level,
}: {
  certificate: Certificate;
  level: CourseLevel;
}) {
  return (
    <VerifyShell>
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
        <span aria-hidden>✓</span>
        Подпись верна — сертификат подлинный
      </div>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
        Сертификат TriDi
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
        Документ выдан онлайн-школой 3D-печати TriDi. Данные ниже взяты из
        подписанного токена: имя, курс и дату нельзя изменить, не нарушив
        подпись.
      </p>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
        <dl>
          <DetailRow label="Номер">{certificate.number}</DetailRow>
          <DetailRow label="Получатель">{certificate.name}</DetailRow>
          <DetailRow label="Курс">{level.title}</DetailRow>
          <DetailRow label="Уровень">{level.shortTitle}</DetailRow>
          <DetailRow label="Дата выдачи">
            {formatCertificateDate(certificate.issuedAt)}
          </DetailRow>
          <DetailRow label="Статус">
            <span className="text-emerald-300">Действителен</span>
          </DetailRow>
        </dl>
      </section>

      <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-sm leading-relaxed text-slate-300">
        Сертификат подтверждает, что курс пройден полностью: изучены все уроки с
        материалом и сданы все тесты модулей. Если данные на бумажной копии
        отличаются от этой страницы, доверяйте этой странице.
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          На главную TriDi
        </Link>
        <Link
          href="/#levels"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Программы курсов
        </Link>
      </div>
    </VerifyShell>
  );
}

/** Подпись не сошлась или ссылка повреждена — никаких данных не показываем. */
function InvalidCertificate() {
  return (
    <VerifyShell>
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300">
        <span aria-hidden>×</span>
        Сертификат не найден
      </div>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
        Проверить не удалось
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
        Ссылка повреждена или сокращена, сертификат подделан, либо сервер
        проверки временно не настроен. Попросите владельца сертификата прислать
        ссылку целиком или сверьте номер документа.
      </p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-relaxed text-slate-300">
        Настоящий сертификат TriDi всегда содержит номер вида
        <span className="font-mono text-slate-200"> TRI-2026-AB12CD34</span> и
        ссылку проверки на этом сайте. По одному номеру проверить документ
        нельзя: номер не секрет и легко подделывается, а подпись — нет.
      </div>

      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          На главную TriDi
        </Link>
      </div>
    </VerifyShell>
  );
}

/**
 * Публичная проверка сертификата — /verify/<token>.
 *
 * Вход не нужен: страницу открывает любой человек по ссылке. Запросов к базе
 * тоже нет — токен содержит имя, курс и дату, а HMAC-подпись подтверждает, что
 * их не изменили. Поэтому страница работает даже без сессии и не раскрывает
 * чужие данные без знания ссылки.
 */
export default async function VerifyCertificatePage({
  params,
}: VerifyPageProps) {
  const { id } = await params;
  const certificate = readCertificateToken(normalizeSegment(id));
  const level = certificate ? findLevel(certificate) : undefined;

  if (!certificate || !level) {
    return <InvalidCertificate />;
  }

  return <ValidCertificate certificate={certificate} level={level} />;
}
