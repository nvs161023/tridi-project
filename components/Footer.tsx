import Link from "next/link";

import { Logo } from "@/components/Logo";
import { LEGAL_DOCUMENTS, LEGAL_OPERATOR } from "@/lib/legal";

/** Телефон для ссылки `tel:`: оставляем только цифры и ведущий плюс. */
const PHONE_HREF = `tel:${LEGAL_OPERATOR.phone.replace(/[^\d+]/g, "")}`;

const legalLinkClassName =
  "transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const contactLinkClassName =
  "inline-flex text-base font-semibold text-blue-300 underline decoration-blue-400/40 underline-offset-4 transition-colors hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

/**
 * Футер сайта со ссылками на юридические документы и реквизитами продавца.
 *
 * Показывается на всех страницах (подключён в app/layout.tsx): ссылки на политику,
 * согласие, соглашение и оферту должны быть доступны с любой страницы, а не только
 * с регистрации. Реквизиты берутся из lib/legal.ts — того же источника, что и в
 * самих документах. Телефон, ИНН и email вынесены в отдельную карточку: их
 * проверяют платёжные сервисы при активации магазина.
 */
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,0.95fr)_minmax(0,1.2fr)] lg:gap-8">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Logo variant="wordmark" />
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
                18+
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              Онлайн-курс по 3D-печати: практика, тесты и профили для слайсеров.
            </p>
          </div>

          <nav aria-label="Юридические документы">
            <h2 className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Документы
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              {LEGAL_DOCUMENTS.map((document) => (
                <li key={document.href}>
                  <Link
                    href={document.href}
                    className={legalLinkClassName}
                  >
                    {document.footerLabel ?? document.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section
            aria-labelledby="footer-requisites-heading"
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6 md:col-span-2 lg:col-span-1"
          >
            <h2
              id="footer-requisites-heading"
              className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
            >
              Реквизиты и контакты
            </h2>

            <dl className="mt-4 grid gap-x-8 gap-y-3.5 text-sm md:grid-cols-2 lg:grid-cols-1">
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
                  Продавец
                </dt>
                <dd className="mt-1 font-semibold text-slate-100">
                  {LEGAL_OPERATOR.shortName}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
                  Статус
                </dt>
                <dd className="mt-1 leading-relaxed text-slate-200">
                  {LEGAL_OPERATOR.sellerStatus}
                </dd>
              </div>

              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 md:border-t md:border-white/10 md:pt-3.5">
                <dt className="text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
                  ИНН
                </dt>
                <dd className="font-mono text-base font-semibold tracking-wide text-slate-100">
                  {LEGAL_OPERATOR.inn}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
                  Телефон
                </dt>
                <dd className="mt-1">
                  <a href={PHONE_HREF} className={contactLinkClassName}>
                    {LEGAL_OPERATOR.phone}
                  </a>
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
                  Email
                </dt>
                <dd className="mt-1">
                  <a
                    href={`mailto:${LEGAL_OPERATOR.email}`}
                    className={`${contactLinkClassName} break-all`}
                  >
                    {LEGAL_OPERATOR.email}
                  </a>
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs leading-relaxed text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {currentYear} tridi-print.ru — 3D-печать с нуля. Все права защищены.
          </p>
          <p>Оплата через Robokassa · чек НПД на email</p>
        </div>
      </div>
    </footer>
  );
}
