import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Правила форума — TriDi",
  description:
    "Правила сообщества TriDi: уважение к участникам, запрет мата, рекламы и обхода оплаты. Все темы и ответы проходят премодерацию.",
};

const RULES: readonly { title: string; text: string }[] = [
  {
    title: "Уважение к участникам",
    text: "Обсуждайте идеи, а не людей. Оскорбления, угрозы, травля и дискриминация недопустимы — даже в шутку и даже в ответ на грубость.",
  },
  {
    title: "Без мата и запрещённых тем",
    text: "Не используйте нецензурную лексику, включая замаскированную. Запрещены призывы к насилию, экстремизм и любой незаконный контент.",
  },
  {
    title: "Без рекламы и обхода оплаты",
    text: "Не публикуйте ссылки на сторонние магазины, каналы и сервисы без согласования. Не предлагайте оплату курсов напрямую, в обход сайта, и не торгуйте доступами.",
  },
  {
    title: "По делу и в правильном разделе",
    text: "Выбирайте подходящую категорию. В теме опишите принтер, пластик, слайсер и настройки — так ответ будет точнее. Дубли и «поднятие» тем без причины удаляются.",
  },
  {
    title: "Чужие данные и файлы",
    text: "Не публикуйте личные данные других людей и не выкладывайте платные модели или профили, если у вас нет права ими делиться.",
  },
  {
    title: "Модерация",
    text: "Каждая тема и каждый ответ сначала попадают на проверку. Мы можем отклонить материал без объяснения причин или попросить исправить формулировки.",
  },
];

/**
 * Правила форума.
 *
 * Отдельная публичная страница: на неё ссылаются форма создания темы и форма
 * ответа. Статическая — не обращается к Supabase, поэтому открывается даже
 * тогда, когда база временно недоступна.
 */
export default function ForumRulesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <Link
          href="/forum"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden>←</span> К форуму
        </Link>

        <p className="mt-8 text-sm font-semibold tracking-widest text-blue-400 uppercase">
          Сообщество TriDi
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Правила форума
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
          Форум — место для спокойного обмена опытом по 3D-печати. Правила
          короткие: они нужны, чтобы вопросы получали ответы, а новички не
          боялись спрашивать.
        </p>

        <ol className="mt-10 space-y-4">
          {RULES.map((rule, index) => (
            <li
              key={rule.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7"
            >
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/10 text-sm font-extrabold text-blue-200"
                >
                  {index + 1}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">{rule.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {rule.text}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-10 rounded-3xl border border-amber-400/25 bg-amber-500/10 p-6 sm:p-7">
          <h2 className="text-lg font-bold text-amber-100">
            Что будет за нарушение
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-100/90">
            Материал могут отклонить, а автора — заблокировать на форуме на срок
            или бессрочно. Блокировка форума не отменяет доступ к уже купленным
            курсам и подписке: это отдельные вещи.
          </p>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7">
          <h2 className="text-lg font-bold text-white">Проверка материалов</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            После отправки тема или ответ получают статус «на модерации» и видны
            только автору. После одобрения они появляются в публичном списке и
            становятся доступны поисковым системам. Мы стараемся проверять
            материалы в течение дня.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/forum/new"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Создать тему
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/forum"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Читать темы
          </Link>
        </div>
      </main>
    </div>
  );
}
