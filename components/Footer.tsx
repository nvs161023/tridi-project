import Link from "next/link";

import { LEGAL_DOCUMENTS, LEGAL_OPERATOR } from "@/lib/legal";

/**
 * Футер сайта со ссылками на юридические документы.
 *
 * Показывается на всех страницах (подключён в app/layout.tsx): ссылки на политику,
 * согласие, соглашение и оферту должны быть доступны с любой страницы, а не только
 * с регистрации. Реквизиты берутся из lib/legal.ts — того же источника, что и в
 * самих документах.
 */
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <nav aria-label="Юридические документы">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
            {LEGAL_DOCUMENTS.map((document) => (
              <li key={document.href}>
                <Link
                  href={document.href}
                  className="transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {document.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-6 flex flex-col gap-2 text-xs leading-relaxed text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span aria-hidden>🖨️</span> © {currentYear} TriDi — 3D-печать с нуля.
            Все права защищены.
          </p>
          <p>
            {LEGAL_OPERATOR.fullName} · ИНН {LEGAL_OPERATOR.inn} ·{" "}
            <a
              href={`mailto:${LEGAL_OPERATOR.email}`}
              className="transition-colors hover:text-blue-400"
            >
              {LEGAL_OPERATOR.email}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
