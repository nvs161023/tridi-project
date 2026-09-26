import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Header } from "@/components/Header";
import { authHref } from "@/lib/auth-redirect";
import { USER_HEADER, decodeRequestUser } from "@/lib/supabase/user-headers";

/**
 * Конструктор 3D-моделей — пока заглушка.
 *
 * Ссылки сюда стоят на финале базового курса, в уроке и тесте продвинутого курса
 * и в кабинете после окончания курса. До этой страницы они вели в 404: человек,
 * который только что закончил обучение, нажимал «Перейти в конструктор» и попадал
 * на страницу ошибки. Теперь здесь честно написано, что раздел в разработке, и
 * показано, что будет внутри.
 *
 * Страница под авторизацией: путь перечислен в config.matcher (middleware.ts) и в
 * PROTECTED_PATH_PREFIXES, поэтому гостя middleware уводит на вход. Проверка ниже
 * — страховка на случай запроса мимо middleware (та же логика, что в кабинете):
 * без неё страница открылась бы любому, кто знает адрес.
 *
 * robots: noindex — разделу-черновику в поиске делать нечего, как и странице
 * подтверждения email.
 */
export const metadata: Metadata = {
  title: "Конструктор 3D-моделей — TriDi",
  description:
    "Конструктор 3D-моделей TriDi: готовые шаблоны ваз, брелоков и светильников. Раздел в разработке — шаблоны появятся в подписке Maker и Pro.",
  robots: {
    index: false,
    follow: false,
  },
};

/** Шаблон модели: что это, что можно будет настраивать и когда ждать. */
type ConstructorTemplate = {
  icon: string;
  title: string;
  /** Статус готовности — пока у всех шаблонов одинаковый. */
  status: string;
  description: string;
  settings: string[];
};

const templates: ConstructorTemplate[] = [
  {
    icon: "🏺",
    title: "Вазы",
    status: "Скоро",
    description:
      "Декоративные вазы под сухоцветы и живые цветы: спиральные, гранёные, с узором по высоте.",
    settings: [
      "Высота и диаметр",
      "Толщина стенки и режим вазы",
      "Текстура: спираль, ромб, гладкая",
      "Готовые STL и профиль печати",
    ],
  },
  {
    icon: "🔑",
    title: "Брелоки",
    status: "Скоро",
    description:
      "Именные и корпоративные брелоки: текст, логотип и форма подбираются под заказ, печать без поддержек.",
    settings: [
      "Имя, дата или логотип",
      "Форма: круг, овал, плашка",
      "Отверстие под кольцо",
      "Цвет букв: печать со сменой филамента",
    ],
  },
  {
    icon: "💡",
    title: "Светильники",
    status: "Скоро",
    description:
      "Абажуры для настольных ламп и бра: перфорация, из которой на стене собирается узор.",
    settings: [
      "Абажур: сфера, конус, цилиндр",
      "Толщина и рисунок перфорации",
      "Посадка под патрон E27 / E14",
      "Крепление и канал под кабель",
    ],
  },
];

export default async function ConstructorPage() {
  const identity = decodeRequestUser((await headers()).get(USER_HEADER));

  if (!identity) {
    redirect(authHref("/auth/login", "/constructor"));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden>←</span>
          Вернуться в личный кабинет
        </Link>

        <header className="mt-8 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1 text-sm font-semibold text-amber-200">
            <span aria-hidden>🛠</span>
            Раздел в разработке
          </span>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Конструктор 3D-моделей
          </h1>

          <p className="mt-4 text-lg leading-relaxed text-slate-400 sm:text-xl">
            Здесь можно будет собрать модель из готового шаблона: задать размеры,
            подписать брелок именем, выбрать узор абажура и скачать файл для
            печати. Шаблоны ваз, брелоков и светильников уже готовятся — ниже
            видно, что в каждом можно будет настраивать.
          </p>

          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Обучение это никак не затрагивает: уроки, тесты и прогресс работают
            как и раньше, а конструктор войдёт в подписку Maker и Pro — так и
            написано на странице тарифов.
          </p>
        </header>

        <section aria-label="Будущие шаблоны" className="mt-12 sm:mt-14">
          <ul className="grid gap-6 lg:grid-cols-3 lg:gap-8">
            {templates.map((template) => (
              <li
                key={template.title}
                className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-8"
              >
                <div className="flex items-start justify-between gap-4">
                  <span aria-hidden className="text-4xl">
                    {template.icon}
                  </span>
                  <span className="rounded-full border border-slate-500/40 bg-slate-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-slate-300 uppercase">
                    {template.status}
                  </span>
                </div>

                <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-white">
                  {template.title}
                </h2>

                <p className="mt-3 text-base leading-relaxed text-slate-400">
                  {template.description}
                </p>

                <p className="mt-6 text-sm font-semibold tracking-wide text-blue-300">
                  Что можно будет настроить
                </p>

                <ul className="mt-4 space-y-3">
                  {template.settings.map((setting) => (
                    <li key={setting} className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                      />
                      <span className="text-sm leading-relaxed text-slate-300">
                        {setting}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-3xl border border-blue-500/30 bg-blue-500/5 p-7 sm:mt-14 sm:p-9">
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Пока раздел готовится
          </h2>

          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Продолжай курс — как только шаблоны откроются, напишем на почту,
            которую ты указал при регистрации. А если хочется посмотреть, что уже
            доступно в подписке, открой страницу тарифов.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/dashboard"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Вернуться к курсу
              <span aria-hidden>→</span>
            </Link>

            <Link
              href="/subscription"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/20 px-8 text-lg font-semibold text-slate-200 transition-colors hover:border-blue-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 hover:text-white"
            >
              Посмотреть тарифы
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
