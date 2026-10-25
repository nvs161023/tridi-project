import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/Logo";
import { LEGAL_DOCUMENTS, LEGAL_OPERATOR, LEGAL_UPDATED_AT } from "@/lib/legal";

/**
 * Общий каркас раздела /legal: навигация по документам и реквизиты владельца.
 *
 * Своя шапка, а не components/Header: тот читает сессию из cookies и требует
 * переменных Supabase, а юридические документы должны открываться всегда и
 * статически — в том числе когда база недоступна. Векторный логотип берём из
 * components/Logo: он статический и тоже не обращается к Supabase.
 */
export const metadata: Metadata = {
  title: {
    default: "Юридические документы — TriDi",
    template: "%s — TriDi",
  },
  description:
    "Политика обработки персональных данных, согласие на обработку, пользовательское соглашение, публичная оферта и политика использования cookie сервиса TriDi.",
};

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-5 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Logo />
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span aria-hidden>←</span> На главную
            </Link>
          </div>

          <nav aria-label="Юридические документы" className="mt-5">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {LEGAL_DOCUMENTS.map((document) => (
                <li key={document.href}>
                  <Link
                    href={document.href}
                    className="text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    {document.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        {children}

        <footer className="mt-14 border-t border-white/10 pt-8 text-sm leading-relaxed text-slate-300">
          <p>
            Оператор и владелец сервиса: {LEGAL_OPERATOR.fullName}, ИНН{" "}
            {LEGAL_OPERATOR.inn}. Налоговый режим: {LEGAL_OPERATOR.taxStatus}.
          </p>
          <p className="mt-2">
            Адрес сервиса:{" "}
            <a
              href={LEGAL_OPERATOR.domain}
              className="text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
            >
              {LEGAL_OPERATOR.domain}
            </a>
            . Обращения:{" "}
            <a
              href={`mailto:${LEGAL_OPERATOR.email}`}
              className="text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
            >
              {LEGAL_OPERATOR.email}
            </a>
            . Текущая редакция документов — от {LEGAL_UPDATED_AT}.
          </p>
        </footer>
      </main>
    </div>
  );
}
