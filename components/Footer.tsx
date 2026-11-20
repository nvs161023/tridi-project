import Link from "next/link";

import { Logo } from "@/components/Logo";
import { LEGAL_DOCUMENTS, LEGAL_OPERATOR } from "@/lib/legal";

/** Телефон для ссылки `tel:`: оставляем только цифры и ведущий плюс. */
const PHONE_HREF = `tel:${LEGAL_OPERATOR.phone.replace(/[^\d+]/g, "")}`;

/** Готовая строка реквизитов: её проверяют платёжные сервисы при активации. */
const SELLER_REQUISITES = `Самозанятый ${LEGAL_OPERATOR.shortName}, ИНН ${LEGAL_OPERATOR.inn}`;

/**
 * Продуктовые разделы в футере.
 *
 * До этого в подвале были только документы и контакты: попасть на Конструктор,
 * Генератор или Мастерскую можно было лишь из шапки, а из глубины страницы —
 * только кнопкой «наверх». Отдельная колонка даёт каждой витрине постоянную
 * ссылку и помогает поисковику обойти продукт целиком, а не одну главную.
 */
const PLATFORM_LINKS = [
  // Витрины, а не рабочие страницы: они открыты гостю и индексируются,
  // а /constructor и /3d-generator требуют входа.
  { href: "/preview/constructor", label: "Конструктор 3D" },
  { href: "/preview/generator", label: "Генератор по фото" },
  { href: "/tools/workshop", label: "Мастерская" },
  { href: "/gallery", label: "Галерея моделей" },
  { href: "/profiles", label: "Профили печати" },
  { href: "/pricing", label: "Тарифы Pro" },
  { href: "/subscription", label: "Обучение" },
  { href: "/blog", label: "Блог" },
  { href: "/forum", label: "Форум" },
] as const;

const footerHeadingClassName =
  "text-xs font-semibold tracking-[0.14em] text-white/90 uppercase";

const footerLinkClassName =
  "w-fit text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]";

const contactLinkClassName = `${footerLinkClassName} text-base font-medium`;

/**
 * Футер сайта со ссылками на юридические документы и реквизитами продавца.
 *
 * Показывается на всех страницах (подключён в app/layout.tsx): ссылки на политику,
 * согласие, соглашение и оферту должны быть доступны с любой страницы, а не только
 * с регистрации. Реквизиты берутся из lib/legal.ts — того же источника, что и в
 * самих документах. Телефон, ИНН и email вынесены в отдельную карточку: их
 * проверяют платёжные сервисы при активации магазина.
 *
 * Кроме пяти документов в футере стоят ссылка на их оглавление `/legal` и
 * ссылка на лендинг бесплатного уровня `/start`: обе страницы были сиротами —
 * попасть на них можно было только из карты сайта и статей блога (см.
 * all-pages-audit.md, раздел «Страницы-сироты»).
 */
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.05] bg-black/50 backdrop-blur-xl print:hidden">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.2fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Logo variant="wordmark" />
              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-semibold text-zinc-400">
                18+
              </span>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-zinc-400">
              Платформа для 3D-печати: модели по фото и параметрам, профили
              слайсеров и Мастерская для заказов.
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-400">
              Сервис предназначен для лиц старше 18 лет.
            </p>
            {/*
              Ссылка на лендинг бесплатного уровня. Без неё /start оставался
              сиротой: из меню и с главной все кнопки бесплатного старта ведут
              сразу на регистрацию, а на сам лендинг ссылались только статьи
              блога (см. all-pages-audit.md, раздел «Страницы-сироты»).
            */}
            <Link
              href="/start"
              className="mt-5 inline-flex w-fit items-center gap-2 text-sm font-semibold text-white/85 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
            >
              Бесплатный курс для новичков
              <span aria-hidden>→</span>
            </Link>
          </div>

          <nav aria-label="Разделы платформы">
            <h2 className={footerHeadingClassName}>Платформа</h2>
            <ul className="mt-5 grid gap-2.5 text-sm sm:grid-cols-2 lg:grid-cols-1">
              {PLATFORM_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={footerLinkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Юридические документы">
            <h2 className={footerHeadingClassName}>Документы</h2>
            <ul className="mt-5 space-y-3 text-sm">
              {/*
                Оглавление документов. Отдельная строка нужна, чтобы /legal
                перестал быть сиротой: в футере перечислены только пять
                документов, а ссылки на сам список не было нигде, кроме карты
                сайта (см. all-pages-audit.md §5).
              */}
              <li>
                <Link href="/legal" className={footerLinkClassName}>
                  Все документы
                </Link>
              </li>
              {LEGAL_DOCUMENTS.map((document) => (
                <li key={document.href}>
                  <Link
                    href={document.href}
                    className={footerLinkClassName}
                  >
                    {document.footerLabel ?? document.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section
            aria-labelledby="footer-requisites-heading"
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:col-span-2 lg:col-span-1"
          >
            <h2 id="footer-requisites-heading" className={footerHeadingClassName}>
              Реквизиты и контакты
            </h2>

            <p className="mt-4 text-base font-semibold leading-relaxed text-white/90">
              {SELLER_REQUISITES}
            </p>

            <dl className="mt-5 grid gap-x-8 gap-y-4 text-sm md:grid-cols-2 lg:grid-cols-1">
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.1em] text-zinc-400 uppercase">
                  Статус
                </dt>
                <dd className="mt-1 leading-relaxed text-zinc-400">
                  {LEGAL_OPERATOR.sellerStatus}
                </dd>
              </div>

              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <dt className="text-[11px] font-semibold tracking-[0.1em] text-zinc-400 uppercase">
                  ИНН
                </dt>
                <dd className="font-mono text-base font-semibold tracking-wide text-white/90">
                  {LEGAL_OPERATOR.inn}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-semibold tracking-[0.1em] text-zinc-400 uppercase">
                  Телефон
                </dt>
                <dd className="mt-1">
                  <a href={PHONE_HREF} className={contactLinkClassName}>
                    {LEGAL_OPERATOR.phone}
                  </a>
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-semibold tracking-[0.1em] text-zinc-400 uppercase">
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

        <div className="mt-12 flex flex-col gap-2 text-xs leading-relaxed text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {currentYear} tridi-print.ru — платформа для 3D-печати. Все права
            защищены.
          </p>
          <p>Оплата через Robokassa · чек НПД на email</p>
        </div>
      </div>
    </footer>
  );
}
