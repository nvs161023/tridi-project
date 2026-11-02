import type { Metadata } from "next";
import Link from "next/link";

import {
  LegalDocumentHeader,
  LegalList,
  LegalRequisites,
  LegalSection,
  LegalTerm,
} from "@/components/legal/LegalText";
import { LEGAL_OPERATOR, LEGAL_UPDATED_AT } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Политика использования cookie",
  description:
    "Какие cookie использует сервис TriDi: необходимые для авторизации и аналитические cookie Яндекс.Метрики и Google Analytics 4, которые подключаются только после согласия «Принять все» в баннере. Как отключить cookie и изменить свой выбор.",
};

/**
 * Политика использования cookie.
 *
 * Документ намеренно короткий и честный: необходимые cookie авторизации плюс
 * аналитические cookie двух счётчиков — Яндекс.Метрики и Google Analytics 4,
 * которые подключаются только после выбора «Принять все». Реализация —
 * components/analytics/Analytics.tsx: без согласия скрипты не загружаются, поэтому
 * у отказавшегося пользователя аналитических файлов не появляется. Если набор
 * счётчиков изменится, раздел 2 и текст баннера правятся вместе с кодом (см.
 * components/CookieBanner.tsx).
 */
export default function CookiesPolicyPage() {
  return (
    <>
      <LegalDocumentHeader
        title="Политика использования cookie"
        updatedAt={LEGAL_UPDATED_AT}
        description={
          <>
            Политика объясняет, что такое cookie, какие файлы использует сервис
            TriDi, нужны ли они для работы и как их отключить. Общие правила
            обработки данных — в{" "}
            <Link
              href="/legal/privacy"
              className="text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
            >
              Политике обработки персональных данных
            </Link>
            .
          </>
        }
      />

      <LegalSection number={1} title="Что такое cookie">
        <LegalTerm term="Cookie">
          небольшой текстовый файл, который сайт просит браузер сохранить. При
          следующих обращениях браузер отправляет его обратно, и сайт узнаёт, что
          это тот же пользователь.
        </LegalTerm>
        <p>
          Cookie бывают сессионными (живут до закрытия браузера или до истечения
          срока) и постоянными. Помимо cookie сайт может использовать локальное
          хранилище браузера (localStorage) — там хранятся небольшие настройки,
          которые не отправляются на сервер.
        </p>
      </LegalSection>

      <LegalSection number={2} title="Какие cookie использует сайт">
        <p className="font-semibold text-white">Необходимые cookie</p>
        <LegalList
          items={[
            <>
              <span className="font-semibold text-white">
                Сессия авторизации
              </span>{" "}
              — cookie системы авторизации Supabase (имена начинаются с{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
                sb-
              </code>
              ). Они содержат токены сессии и нужны, чтобы пользователь оставался
              в личном кабинете при переходах между страницами. Без этих cookie
              вход в аккаунт технически невозможен.
            </>,
            <>
              <span className="font-semibold text-white">
                Выбор в cookie-баннере
              </span>{" "}
              — небольшое значение в localStorage (ключ{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
                tridi-cookie-consent
              </code>
              ): так сайт помнит, что вы уже ответили, и не показывает баннер
              снова. Эта запись не отправляется на сервер.
            </>,
            <>
              <span className="font-semibold text-white">
                Технические cookie защиты
              </span>{" "}
              — могут создаваться инфраструктурой при обработке запроса для
              защиты от атак и корректной работы балансировки, если такая защита
              включена.
            </>,
          ]}
        />
        <p className="font-semibold text-white">Аналитические cookie</p>
        <p>
          Для анализа посещаемости подключена{" "}
          <span className="font-semibold text-white">Яндекс.Метрика</span> —
          сервис веб-аналитики ООО «Яндекс», номер счётчика{" "}
          <span className="font-semibold text-white">114006526</span>. Счётчик
          показывает, какие страницы и уроки смотрят, откуда приходят посетители и
          где в интерфейсе возникают ошибки. Метрика создаёт четыре файла:
        </p>
        <LegalList
          items={[
            <>
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
                _ym_uid
              </code>{" "}
              — постоянный идентификатор посетителя: по нему повторный визит
              отличается от нового, и один человек не считается двумя;
            </>,
            <>
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
                _ym_did
              </code>{" "}
              — идентификатор для статистики устройств и источников входа;
            </>,
            <>
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
                _ym_isad
              </code>{" "}
              — признак включённого блокировщика рекламы: без него оценки
              посещаемости были бы завышены;
            </>,
            <>
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
                _ym_visorc
              </code>{" "}
              — служебный файл Вебвизора: он записывает, как посетитель ведёт себя
              на странице (клики, прокрутка, движение по разделам). Пароли и
              платёжные данные Вебвизор не записывает.
            </>,
          ]}
        />
        <p>
          Сроки хранения этих файлов задаёт Метрика: от получаса у служебного{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
            _ym_visorc
          </code>{" "}
          до года у идентификаторов{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
            _ym_uid
          </code>{" "}
          и{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
            _ym_did
          </code>
          .
        </p>
        <p>
          Второй счётчик —{" "}
          <span className="font-semibold text-white">Google Analytics 4</span>{" "}
          (Google LLC, США, поток данных{" "}
          <span className="font-semibold text-white">G-4EG334M7QJ</span>). Он
          собирает похожую статистику: какие страницы смотрят, сколько времени на
          них проводят, из какой страны и с какого источника пришли. GA4 создаёт
          два файла:
        </p>
        <LegalList
          items={[
            <>
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
                _ga
              </code>{" "}
              — идентификатор посетителя: по нему Google отличает повторный визит от
              нового. Срок хранения — до 2 лет;
            </>,
            <>
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
                _ga_G-4EG334M7QJ
              </code>{" "}
              — состояние текущей сессии в этом потоке данных GA4: номер сессии,
              отметка времени последнего обращения. Срок хранения — до 2 лет.
            </>,
          ]}
        />
        <p>
          Данные, которые собирает GA4, передаются в Google LLC (США). Это
          трансграничная передача обезличенных данных веб-аналитики: подробнее — в{" "}
          <Link
            href="/legal/privacy"
            className="text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
          >
            Политике обработки персональных данных
          </Link>
          , разделы 7.1 и 8.
        </p>
        <p>
          Оба счётчика загружаются{" "}
          <span className="font-semibold text-white">только</span> после того, как
          пользователь нажал «Принять все» в баннере согласия. Пока выбор не сделан
          или выбрано «Только необходимые», скрипты Метрики и GA4 на страницу не
          загружаются, а файлы{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">_ym_*</code>{" "}
          и{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">_ga*</code>{" "}
          не создаются.
        </p>
        <p>
          Рекламные системы, пиксели соцсетей и трекеры объявлений на сайте не
          подключены: оба счётчика включены в режиме обычной статистики, рекламные
          функции (Google Ads, аудитории для таргетинга) не используются.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Как отключить cookie в браузере">
        <p>
          Cookie можно запретить или удалить в настройках браузера — в разделе
          «Конфиденциальность» (Chrome, Firefox, Safari, Edge и другие браузеры
          называют это по-разному: «Файлы cookie и данные сайтов», «Управление
          данными сайтов», «Заблокировать все cookie»).
        </p>
        <LegalList
          items={[
            "если запретить cookie полностью, вход в аккаунт и сохранение прогресса станут невозможны: необходимые cookie авторизации входят в этот запрет;",
            "удаление cookie завершает сессию: чтобы продолжить обучение, потребуется войти заново;",
            "в приватном режиме браузера cookie удаляются после закрытия окна — прогресс курса при этом сохраняется, так как он хранится в аккаунте, а не в браузере.",
          ]}
        />
      </LegalSection>

      <LegalSection number={4} title="Согласие на cookie">
        <p>
          При первом посещении сайта показывается баннер с выбором: «Принять все»
          или «Только необходимые». Выбор сохраняется в браузере и не
          запрашивается заново. Формулировка «продолжая пользоваться сайтом, вы
          соглашаетесь с использованием cookie» на сайте не применяется: согласие
          должно быть явным действием пользователя.
        </p>
        <p>
          Изменить решение можно в любой момент: очистите данные сайта в браузере
          (в том числе localStorage) — при следующем визите баннер появится снова.
          Варианты выбора дают разный набор файлов: «Только необходимые» оставляет
          cookie авторизации и запись о вашем выборе, а «Принять все» дополнительно
          подключает аналитические cookie Метрики и Google Analytics 4 из раздела 2.
        </p>
      </LegalSection>

      <LegalSection number={5} title="Контакт">
        <p>
          Вопросы по использованию cookie направляйте Оператору — реквизиты ниже.
          Обращения по персональным данным рассматриваются в порядке, описанном в
          Политике обработки персональных данных.
        </p>
        <LegalRequisites
          items={[
            { label: "Оператор", value: LEGAL_OPERATOR.fullName },
            { label: "ИНН", value: LEGAL_OPERATOR.inn },
            {
              label: "Email для обращений",
              value: (
                <a
                  href={`mailto:${LEGAL_OPERATOR.email}`}
                  className="text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
                >
                  {LEGAL_OPERATOR.email}
                </a>
              ),
            },
            { label: "Адрес сервиса", value: LEGAL_OPERATOR.domain },
          ]}
        />
      </LegalSection>
    </>
  );
}
