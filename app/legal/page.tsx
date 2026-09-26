import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL_DOCUMENTS, LEGAL_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Юридические документы",
  description:
    "Все юридические документы сервиса TriDi: политика обработки персональных данных, согласие, пользовательское соглашение, публичная оферта и политика cookie.",
};

/**
 * Оглавление раздела /legal.
 *
 * Нужно, чтобы на /legal не было 404 и чтобы документы (на них ссылаются футер и
 * форма регистрации) можно было найти в одном месте, а не угадывать адрес.
 */
export default function LegalIndexPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
        Юридические документы
      </h1>
      <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
        Сервис TriDi обрабатывает персональные данные в соответствии с Федеральным
        законом № 152-ФЗ «О персональных данных». Ниже — документы, которые
        определяют порядок работы сервиса и обработки данных пользователей.
      </p>

      <ul className="mt-10 space-y-3">
        {LEGAL_DOCUMENTS.map((document) => (
          <li key={document.href}>
            <Link
              href={document.href}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base font-semibold text-white transition-colors hover:border-blue-500/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span aria-hidden className="text-blue-300">
                📄
              </span>
              {document.label}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm leading-relaxed text-slate-400">
        Вопросы по документам и обработке данных: {LEGAL_OPERATOR.fullName}, ИНН{" "}
        {LEGAL_OPERATOR.inn},{" "}
        <a
          href={`mailto:${LEGAL_OPERATOR.email}`}
          className="text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
        >
          {LEGAL_OPERATOR.email}
        </a>
        .
      </p>
    </>
  );
}
