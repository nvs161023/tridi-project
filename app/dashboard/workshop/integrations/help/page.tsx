import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Header } from "@/components/Header";
import { AgentDownloadButton } from "@/components/workshop/AgentDownloadButton";
import { LEGAL_OPERATOR } from "@/lib/legal";

/**
 * Помощь Мастерской: быстрый старт, FAQ и подключение маркетплейсов.
 *
 * Порядок разделов повторяет путь мастера: сначала «Быстрый старт» — шесть
 * шагов от скачивания агента до первой печати, затем FAQ — ответы на то, что
 * ломается чаще всего, и только потом длинные инструкции по площадкам. Ссылки
 * на разделы (`#quick-start`, `#faq`, `#ozon`, `#wb`, `#yandex`, `#agent`)
 * стабильны: на них ссылаются карточка агента и вкладка «Интеграции».
 *
 * Страница статическая: она ничего не читает из базы и не знает персональных
 * адресов вебхука, поэтому вместо готовых URL здесь шаги «скопируйте адрес в
 * блоке „Интеграции“» — так инструкция не устаревает и не показывает чужие
 * данные.
 *
 * FAQ — аккордеон на нативных `<details>`: он раскрывается без JavaScript,
 * работает до гидратации и не тянет в страницу клиентский компонент. Маркер
 * браузера скрыт, плюс поворачивается через `group-open`.
 *
 * `noindex`: страница внутренняя и открывается только после входа — её не
 * нужно показывать поисковым системам.
 */

export const metadata: Metadata = {
  title: "Помощь и инструкции",
  description:
    "Быстрый старт Мастерской TriDi: скачать агент, найти принтеры, добавить товар и заказ. FAQ по агенту, принтерам, товарам, заказам, оплате и безопасности, а также подключение Ozon, Wildberries и Яндекс.Маркета.",
  robots: { index: false, follow: false },
};

/** Код внутри ответа: та же monospace-плашка, что и в подсказках вкладки. */
function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[0.85em] text-blue-200">
      {children}
    </code>
  );
}

/**
 * «Быстрый старт»: шесть шагов, которые проходят все.
 *
 * Это не пересказ FAQ, а линейный маршрут: без агента нет принтеров, без
 * принтеров нет печати. Поэтому шаги идут строго по порядку и не разбиты на
 * категории — категории будут ниже, в вопросах.
 */
const QUICK_START_STEPS: readonly ReactNode[] = [
  <>
    <strong className="font-semibold text-white">Скачайте агент.</strong> Кнопка
    «Скачать TriDiAgent.exe» — в шапке Мастерской, здесь вверху страницы и в
    карточке «Локальный агент» на вкладке «Интеграции». Это один файл для
    Windows; Python и библиотеки уже внутри.
  </>,
  <>
    <strong className="font-semibold text-white">
      Запустите и впишите токен.
    </strong>{" "}
    Запустите exe на компьютере в одной сети с принтерами. При первом запуске
    рядом появится <Code>.env</Code>: откройте его блокнотом, вставьте{" "}
    <Code>AGENT_TOKEN</Code> с вкладки «Интеграции» и адрес сайта в{" "}
    <Code>CRM_URL</Code>, сохраните и перезапустите exe.
  </>,
  <>
    <strong className="font-semibold text-white">Найдите принтеры.</strong>{" "}
    Вкладка «Принтеры» → «Найти принтеры в сети». Агент обойдёт подсеть и
    покажет найденное: дайте принтерам имена и добавьте их в парк.
  </>,
  <>
    <strong className="font-semibold text-white">Создайте товар.</strong> Вкладка
    «Товары» → «Добавить товар»: артикул, название, цена и файл печати — 3MF или
    G-code. Если товар продаётся на площадке, добавьте её SKU в блоке «SKU на
    маркетплейсах».
  </>,
  <>
    <strong className="font-semibold text-white">Создайте заказ.</strong> Вкладка
    «Заказы» → «Создать заказ»: клиент, товар, принтер и кнопка «В очередь на
    печать».
  </>,
  <>
    <strong className="font-semibold text-white">Печать и контроль.</strong>{" "}
    Подтвердите, что стол свободен, — агент скачает файл и запустит печать.
    Прогресс, остаток времени и причину отказа видно на карточке заказа.
  </>,
];

/**
 * Вопрос и ответ FAQ.
 *
 * Вопрос формулируется словами мастера («принтер офлайн», «windows ругается»),
 * а не внутренними терминами: человек ищет именно такую строку. Ответ без
 * маркетинга: что проверить, что нажать и чего продукт не умеет.
 */
type FaqItem = {
  question: string;
  answer: ReactNode;
};

type FaqCategory = {
  /** Якорь категории внутри `#faq`; он же ключ списка. */
  id: string;
  title: string;
  items: readonly FaqItem[];
};

/** FAQ: агент — самый частый источник вопросов, поэтому категория первая. */
const FAQ_AGENT: FaqCategory = {
  id: "faq-agent",
  title: "Агент",
  items: [
    {
      question: "Как скачать и запустить агент?",
      answer: (
        <>
          <p>
            Кнопка «Скачать TriDiAgent.exe» есть в шапке Мастерской, здесь
            вверху страницы и в карточке «Локальный агент» на вкладке
            «Интеграции». Это один exe для Windows: Python и библиотеки уже
            внутри, размер — около 11 МБ.
          </p>
          <p className="mt-2">
            Запустите файл двойным кликом на компьютере, который стоит в одной
            сети с принтерами. При первом запуске рядом с exe появится{" "}
            <Code>.env</Code>; откройте его блокнотом, впишите{" "}
            <Code>AGENT_TOKEN</Code> из «Интеграций» и адрес сайта в{" "}
            <Code>CRM_URL</Code>, сохраните и перезапустите exe. В окне агента
            пойдут строки опроса принтеров — значит связь с Мастерской есть.
          </p>
        </>
      ),
    },
    {
      question: "Windows пишет «Неизвестный издатель». Это опасно?",
      answer: (
        <>
          <p>
            Нет, если файл скачан с этого сайта. EXE не подписан сертификатом
            code signing — это платная услуга, поэтому SmartScreen показывает
            предупреждение. Нажмите «Подробнее» → «Выполнить в любом случае».
          </p>
          <p className="mt-2">
            Проверить программу можно самому: исходный код агента лежит в папке{" "}
            <Code>agent/</Code> проекта, а <Code>python build_exe.py</Code>{" "}
            собирает такой же exe из этих исходников — файлы можно сравнить.
            Если антивирус удалил exe, добавьте папку агента в исключения
            осознанно; отключать защиту целиком не нужно.
          </p>
        </>
      ),
    },
    {
      question: "Как настроить автозапуск после перезагрузки?",
      answer: (
        <>
          <p>
            Проще всего — ярлык в папке автозагрузки: <Code>Win+R</Code> →{" "}
            <Code>shell:startup</Code> → положить туда ярлык на{" "}
            <Code>TriDiAgent.exe</Code>. Важно, чтобы рабочая папка ярлыка была
            папкой с exe: рядом лежат <Code>.env</Code> и <Code>temp/</Code>.
          </p>
          <p className="mt-2">
            Надёжнее — Планировщик задач: «Создать задачу» → триггер «При
            запуске компьютера» → действие «Запустить программу» с полным путём
            к exe и той же рабочей папкой. Права администратора не нужны. Без
            автозапуска после перезагрузки агент не работает, и очередь печати
            стоит.
          </p>
        </>
      ),
    },
    {
      question: "Принтер показывает «Офлайн». Что проверить?",
      answer: (
        <>
          <p>
            «Офлайн» значит, что агент давно не получал ответа от принтера
            (порог — две минуты). Проверьте по порядку: агент запущен на том же
            компьютере и в той же сети, что принтер; IP-адрес в карточке
            совпадает с адресом в веб-интерфейсе принтера; принтер включён и не
            спит; для Bambu Lab включён LAN-режим и верный Access Code, для
            FlashForge — Check Code.
          </p>
          <p className="mt-2">
            Затем нажмите «Проверить связь» в карточке — результат появится там
            же. Если агент не запущен, статус просто застывает на последнем
            ответе: сам он не обновится.
          </p>
        </>
      ),
    },
    {
      question: "Обязательно ли ставить Python?",
      answer: (
        <p>
          Нет. <Code>TriDiAgent.exe</Code> собран как один файл и несёт
          интерпретатор внутри. Python нужен только тому, кто собирает exe из
          исходников или запускает агент скриптом (<Code>python main.py</Code>).
        </p>
      ),
    },
  ],
};

/** FAQ: принтеры — второй по частоте источник писем в поддержку. */
const FAQ_PRINTERS: FaqCategory = {
  id: "faq-printers",
  title: "Принтеры",
  items: [
    {
      question: "«Найти принтеры в сети» ничего не нашёл. Почему?",
      answer: (
        <>
          <p>
            Поиск копирует то, что делает агент: он обходит подсеть того
            компьютера, где запущен, и опрашивает адреса на портах Bambu Lab и
            FlashForge. Если список пуст — принтер и компьютер в разных сетях:
            гостевая Wi-Fi-сеть, VLAN или изоляция клиентов на роутере как раз
            это и делают.
          </p>
          <p className="mt-2">
            Проверьте: компьютер и принтер в одной подсети (например, оба{" "}
            <Code>192.168.1.x</Code>); на компьютере разрешён исходящий трафик в
            локальную сеть (брандмауэр Windows, антивирус); принтер включён.
            Если сеть большая, добавьте принтер вручную по IP — кнопка «Добавить
            принтер».
          </p>
        </>
      ),
    },
    {
      question: "Какие принтеры поддерживаются?",
      answer: (
        <>
          <p>
            Восемь протоколов, они же варианты в поле «Протокол»: Moonraker
            (Klipper), OctoPrint, Bambu Lab (LAN), Prusa (PrusaLink), Creality
            (K1 / K2 / Hi), Anycubic (Kobra), FlashForge (Adventurer) и Elegoo
            (Centauri Carbon). Для них агент умеет и статус, и запуск печати.
          </p>
          <p className="mt-2">
            Принтер на Klipper или OctoPrint подключается по адресу и ключу API,
            поэтому список моделей шире названий в подписях: подойдёт любой
            принтер с этими прошивками. Если протокола нет в списке, заведите
            принтер как «ручную отправку»: очередь и заказы в Мастерской будут,
            а файл вы отправите сами.
          </p>
        </>
      ),
    },
    {
      question: "Где взять IP-адрес и код доступа принтера?",
      answer: (
        <>
          <p>
            IP-адрес виден на экране принтера: «Настройки» → «Сеть» (Bambu Lab)
            или «Настройки» → «Wi-Fi» (FlashForge). Там же у Bambu Lab включите
            LAN-режим и посмотрите Access Code, у FlashForge — Check Code.
          </p>
          <p className="mt-2">
            Совет: закрепите адрес за принтером в роутере (DHCP reservation) —
            иначе после перезагрузки роутера IP изменится, и принтер «пропадёт».
            Код доступа меняется при сбросе сетевых настроек принтера — тогда
            обновите его и в Мастерской.
          </p>
        </>
      ),
    },
    {
      question: "Печать не стартует или сразу обрывается. Что делать?",
      answer: (
        <>
          <p>
            Сначала посмотрите причину в карточке заказа: мастерская пишет,
            почему агент не взял файл, — «стол не подтверждён», «нет файла
            печати», «принтер занят». Дальше проверьте по порядку: стол свободен
            и подтверждён; файл — G-code под эту модель (G-code от другого
            принтера может начать печать и сразу остановиться); катушка не
            пуста, пластик не закончился; на принтере не висит ошибка с прошлой
            печати.
          </p>
          <p className="mt-2">
            Для Bambu Lab с AMS проверьте, что сопоставление филамента в файле и
            в принтере совпадает: при несовпадении принтер откажется печатать,
            хотя задание уйдёт.
          </p>
        </>
      ),
    },
  ],
};

/** FAQ: товары — про файлы печати, потому что 9 из 10 отказов именно там. */
const FAQ_PRODUCTS: FaqCategory = {
  id: "faq-products",
  title: "Товары",
  items: [
    {
      question: "Какие форматы файлов печати?",
      answer: (
        <>
          <p>
            3MF и G-code (расширения <Code>.3mf</Code>, <Code>.gcode</Code> и{" "}
            <Code>.gco</Code>). STL и OBJ не подходят: это модель без настроек
            печати, принтер её не выполнит — сначала нужно слайсить.
          </p>
          <p className="mt-2">
            3MF удобнее: внутри уже лежат настройки и раскладка. Но часть
            протоколов принимает только G-code — например PrusaLink отклоняет
            .3mf. Если товар печатается на нескольких моделях принтеров, держите
            файл под каждую: G-code от другой модели может начать печать и сразу
            остановиться.
          </p>
        </>
      ),
    },
    {
      question: "Где взять G-code или 3MF для товара?",
      answer: (
        <>
          <p>
            В слайсере: Bambu Studio или OrcaSlicer (Bambu Lab), PrusaSlicer
            (Prusa), FlashPrint (FlashForge), OrcaSlicer или Cura (Klipper,
            OctoPrint и остальные). Выберите профиль своей модели принтера и
            пластика, нажмите «Слайсить», затем экспорт файла на диск — не
            «Отправить на принтер».
          </p>
          <p className="mt-2">
            Готовый файл загрузите в товар: вкладка «Товары» → карточка товара →
            «Файл печати». Мастерская читает из G-code вес и время печати, если
            слайсер записал их в комментариях, — эти цифры нужны для
            себестоимости и планирования.
          </p>
        </>
      ),
    },
    {
      question: "Можно ли добавить товар без файла и цены?",
      answer: (
        <>
          <p>
            Да. Артикул и название — обязательные, остальное можно заполнить
            позже: карточка сохранится. Но заказ с таким товаром не встанет в
            очередь, пока нет файла печати, — мастерская честно напишет причину
            в карточке.
          </p>
          <p className="mt-2">
            Цена нужна для выручки в статистике и для выгрузки каталога на
            площадки. Если товар продаётся на Ozon, WB или Яндекс.Маркете,
            добавьте SKU площадки в блоке «SKU на маркетплейсах» — без него
            заказы с площадки не сопоставятся с товаром.
          </p>
        </>
      ),
    },
  ],
};

/** FAQ: оплата и доступ — почему Мастерская вообще открывается. */
const FAQ_ACCESS: FaqCategory = {
  id: "faq-access",
  title: "Оплата и доступ",
  items: [
    {
      question: "Что нужно, чтобы Мастерская открылась?",
      answer: (
        <>
          <p>
            Активный пакет «Всё включено» или подписка Pro. Без них страница
            показывает замок со списком возможностей, а не пустые вкладки:
            сервер проверяет доступ и при открытии страницы, и повторно в каждом
            действии — обойти интерфейс не получится.
          </p>
          <p className="mt-2">
            Цены и способы оплаты — на странице{" "}
            <Link
              href="/subscription"
              className="font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
            >
              «Тарифы»
            </Link>
            . Оплата проходит через Robokassa, чек приходит на почту, указанную
            при оплате.
          </p>
        </>
      ),
    },
    {
      question: "Срок доступа закончился. Данные пропали?",
      answer: (
        <p>
          Нет. Заказы, товары, принтеры и настройки остаются в аккаунте: доступ
          закрывает только интерфейс. В кабинете видно, до какой даты открыт
          доступ, — после продления всё возвращается на свои места.
        </p>
      ),
    },
    {
      question: "Куда написать, если что-то не работает?",
      answer: (
        <>
          <p>
            Почта{" "}
            <a
              href={`mailto:${LEGAL_OPERATOR.email}`}
              className="font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
            >
              {LEGAL_OPERATOR.email}
            </a>
            , телефон {LEGAL_OPERATOR.phone}. Чтобы разобраться с первого письма,
            приложите: что нажимали, текст ошибки или скриншот, время события и
            версию агента из окна запуска.
          </p>
          <p className="mt-2">
            Вопросы по принтерам быстрее решаются с логом агента: скопируйте
            последние строки из его окна — там видно, ответил ли принтер и что
            именно ответил.
          </p>
        </>
      ),
    },
  ],
};

/** FAQ: безопасность — что где лежит и кто это видит. */
const FAQ_SECURITY: FaqCategory = {
  id: "faq-security",
  title: "Безопасность",
  items: [
    {
      question: "Где хранятся токен агента и пароли принтеров?",
      answer: (
        <>
          <p>
            Токен агента — в настройках мастерской (колонка{" "}
            <Code>agent_token</Code>) и в файле <Code>.env</Code> рядом с exe.
            отдельным полем <Code>printer_secrets</Code>: списки принтеров его не
            читают, поэтому коды не попадают в интерфейс и в журналы агента.
          </p>
          <p className="mt-2">
            <Code>.env</Code> — такой же секрет, как пароль: не пересылайте его в
            мессенджерах и не выкладывайте. В git файл не попадает. Если токен
            утёк, поменяйте значение <Code>agent_token</Code> в базе и впишите
            новое в <Code>.env</Code>, затем перезапустите агент: старый токен
            перестанет работать.
          </p>
        </>
      ),
    },
    {
      question: "Что агент делает на моём компьютере?",
      answer: (
        <>
          <p>
            Только то, что нужно для печати: опрашивает Мастерскую по HTTPS
            (сам, исходящими запросами — входящих портов он не открывает),
            забирает задания своей мастерской, скачивает файл печати во временную
            папку <Code>temp/</Code> и отправляет его принтеру в локальной сети.
          </p>
          <p className="mt-2">
            Агент не читает ваши файлы, не снимает экран и не отправляет ничего,
            кроме статусов принтеров и отчётов о печати. Каждый запрос виден
            строкой в его окне — скрытых действий нет. Подробнее — файл{" "}
            <Code>agent/SECURITY.md</Code> в проекте.
          </p>
        </>
      ),
    },
    {
      question: "Кто ещё видит мои заказы и клиентов?",
      answer: (
        <p>
          Никто, кроме владельца аккаунта. Записи привязаны к пользователю, а
          доступ к строкам закрыт политиками на стороне базы: чужой аккаунт не
          прочитает ваши заказы, даже зная их идентификаторы. Файлы печати не
          публичны — их получает только агент по токену мастерской.
        </p>
      ),
    },
    {
      question: "Передаются ли модели и файлы печати на маркетплейсы?",
      answer: (
        <>
          <p>
            Нет. На Ozon, Wildberries и Яндекс.Маркет уходят только данные о
            заказе и статусе: номер, состав, трекинг. Файлы печати остаются в
            Мастерской.
          </p>
          <p className="mt-2">
            Из каталога на площадки уходит CSV с артикулом, названием, ценой,
            весом и габаритами — выгрузка запускается вручную из вкладки
            «Товары».
          </p>
        </>
      ),
    },
  ],
};

/** FAQ: заказы и печать — что происходит после кнопки «В очередь». */
const FAQ_ORDERS: FaqCategory = {
  id: "faq-orders",
  title: "Заказы и печать",
  items: [
    {
      question: "Как создать заказ и отправить его в печать?",
      answer: (
        <>
          <p>
            Вкладка «Заказы» → «Создать заказ»: клиент (или «Без клиента»),
            товар, количество, срок сдачи. Заказ появится в колонке «Новые».
            Откройте карточку и нажмите «В очередь на печать», выбрав принтер.
          </p>
          <p className="mt-2">
            Перед запуском мастерская попросит подтвердить, что стол свободен.
            Это не формальность: агент не может проверить, убрали ли вы прошлую
            деталь, а печать поверх модели испортит и стол, и сопло.
          </p>
        </>
      ),
    },
    {
      question: "Заказ висит в очереди, печать не начинается. Почему?",
      answer: (
        <>
          <p>
            Сайт не отправляет файл сам: он кладёт задание в очередь, а забирает
            его агент. Поэтому сначала проверьте, что агент запущен на ферме и в
            его окне идут строки опроса. Затем — что принтер онлайн, свободен и
            у товара есть файл печати.
          </p>
          <p className="mt-2">
            Причина отказа всегда написана в карточке заказа: «принтер занят»,
            «нет файла печати», «стол не подтверждён», «принтер не отвечает».
            Исправьте причину и поставьте задание в очередь снова — вручную
            ничего перезапускать не нужно.
          </p>
        </>
      ),
    },
    {
      question: "Как остановить уже начатую печать?",
      answer: (
        <>
          <p>
            В карточке заказа нажмите «Отменить печать». Мастерская поднимет
            флаг, агент увидит его на следующем опросе и остановит печать, а
            задание закроется как отменённое — не как поломка, поэтому
            статистика отказов не испортится.
          </p>
          <p className="mt-2">
            Если агент не запущен или принтер завис, задание можно закрыть
            принудительно, а печать остановить кнопкой на самом принтере. Отмена
            не возвращает пластик и время — решение лучше принимать до запуска.
          </p>
        </>
      ),
    },
  ],
};

/** Порядок категорий на странице: от первого запуска к деньгам и доступам. */
const FAQ_CATEGORIES: readonly FaqCategory[] = [
  FAQ_AGENT,
  FAQ_PRINTERS,
  FAQ_PRODUCTS,
  FAQ_ORDERS,
  FAQ_ACCESS,
  FAQ_SECURITY,
];

type Guide = {
  /** Якорь раздела: `#ozon`, `#wb`, `#yandex`, `#agent`. */
  id: string;
  /** Заголовок раздела — как называется площадка в карточке «Интеграций». */
  name: string;
  /** Одно предложение о том, что понадобится. */
  lead: string;
  /** Шаги по порядку; код внутри шага подсвечивается через `Code`. */
  steps: readonly ReactNode[];
};

const GUIDES: readonly Guide[] = [
  {
    id: "ozon",
    name: "Ozon",
    lead: "Для Ozon нужны ключи Seller API и персональный адрес вебхука: по нему площадка сообщает о новых отправлениях.",
    steps: [
      <>
        В личном кабинете Ozon Seller перейдите в «Настройки» → «Seller API».
      </>,
      <>Скопируйте Client-Id.</>,
      <>
        Нажмите «Сгенерировать ключ», выберите роль{" "}
        <Code>Posting FBS read-only</Code> (или <Code>Admin</Code>, если хотите
        управлять заказами), скопируйте Api-Key.
      </>,
      <>
        В Мастерской на вкладке «Интеграции» введите полученные Client-Id и
        Api-Key и нажмите «Сохранить».
      </>,
      <>Скопируйте URL для вебхука Ozon из блока «Интеграции».</>,
      <>
        В Ozon Seller в разделе «Seller API» → «Уведомления» укажите этот URL и
        включите уведомления типа <Code>TYPE_NEW_POSTING</Code>.
      </>,
    ],
  },
  {
    id: "wb",
    name: "Wildberries (WB)",
    lead: "WB не требует API-ключей: продавца определяет секретный токен в адресе вебхука.",
    steps: [
      <>Скопируйте URL для вебхука WB из блока «Интеграции».</>,
      <>
        В личном кабинете WB перейдите в «Настройки» → «Интеграции» →
        «Уведомления».
      </>,
      <>Укажите скопированный URL и сохраните настройки.</>,
      <>Заказы начнут поступать автоматически.</>,
    ],
  },
  {
    id: "yandex",
    name: "Яндекс.Маркет",
    lead: "Яндекс.Маркет подключается одним адресом: ключи для уведомлений не нужны.",
    steps: [
      <>Скопируйте URL для вебхука Яндекса из блока «Интеграции».</>,
      <>
        В кабинете продавца Яндекс.Маркета перейдите в «Настройки» → «API и
        модули» → «API-уведомления».
      </>,
      <>
        Нажмите «Подключить уведомления», укажите URL и выберите событие{" "}
        <Code>ORDER_CREATED</Code>.
      </>,
      <>Нажмите «Подключить».</>,
    ],
  },
  {
    id: "agent",
    name: "Локальный агент (Печать)",
    lead: "Агент печатает сам: браузер не дотянется до принтера в домашней сети, а программа на компьютере рядом с принтерами — дотянется.",
    steps: [
      <>
        Скачайте <Code>TriDiAgent.exe</Code> кнопкой вверху этой страницы или в
        карточке «Локальный агент» на вкладке «Интеграции».
      </>,
      <>
        Скопируйте токен агента из того же блока — кнопка «Скопировать токен».
      </>,
      <>
        Запустите exe на компьютере в одной сети с принтерами. Python не нужен:
        интерпретатор внутри. При первом запуске рядом с exe появится{" "}
        <Code>.env</Code>.
      </>,
      <>
        Откройте <Code>.env</Code> блокнотом и впишите <Code>AGENT_TOKEN</Code>{" "}
        и адрес сайта в <Code>CRM_URL</Code>, сохраните файл.
      </>,
      <>
        Перезапустите exe: в окне пойдут строки опроса принтеров — значит связь с
        Мастерской есть, и задания из очереди начнут забираться.
      </>,
      <>
        Настройте автозапуск: ярлык на exe в{" "}
        <Code>shell:startup</Code> или задача в Планировщике Windows.
      </>,
    ],
  },
];

/** Сборка exe из исходников — не для мастера, а для того, кто проверяет файл. */
const AGENT_BUILD_NOTE =
  "Собрать exe самому: положите build_exe.py в папку agent/, установите зависимости (pip install -r requirements.txt) и запустите python build_exe.py. Результат — dist/TriDiAgent.exe: его можно положить в public/downloads/ и раздавать со своего домена.";

export default function IntegrationsHelpPage() {
  return (
    <div className="min-h-screen text-zinc-100">
      <Header />

      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/dashboard/workshop"
          className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
        >
          <span aria-hidden>←</span>
          Мастерская
        </Link>

        <section
          aria-labelledby="integrations-help-title"
          className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#0a0a0a]/75 px-5 py-7 shadow-[0_40px_120px_-60px_rgba(0,0,0,1)] backdrop-blur-xl sm:px-8 sm:py-9"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 -right-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 left-1/3 h-56 w-56 rounded-full bg-violet-500/[0.07] blur-3xl"
          />

          <div className="relative min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-zinc-300">
                CRM · 3D-печать
              </span>
              <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-blue-200">
                Помощь
              </span>
            </div>

            <h1
              id="integrations-help-title"
              className="mt-5 text-3xl font-extrabold tracking-[-0.03em] text-white sm:text-4xl"
            >
              Помощь и инструкции
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Быстрый старт, ответы на частые вопросы и подключение Ozon, WB и
              Яндекс.Маркета. Если Мастерская открывается впервые — начните с
              шести шагов ниже: без агента и принтеров заказы не печатаются.
            </p>

            <div className="mt-6 flex flex-col items-start gap-2.5 sm:flex-row sm:items-center">
              <AgentDownloadButton tone="primary" showHint />
              <Link
                href="#quick-start"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-xs font-semibold text-zinc-200 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
              >
                Быстрый старт
              </Link>
            </div>

            <nav aria-label="Разделы помощи" className="relative mt-6">
              <ul className="flex flex-wrap gap-2">
                <li>
                  <a
                    href="#quick-start"
                    className="inline-flex min-h-9 items-center rounded-full border border-white/10 bg-white/[0.03] px-3.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                  >
                    Быстрый старт
                  </a>
                </li>
                <li>
                  <a
                    href="#faq"
                    className="inline-flex min-h-9 items-center rounded-full border border-white/10 bg-white/[0.03] px-3.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                  >
                    Частые вопросы
                  </a>
                </li>
                {GUIDES.map((guide) => (
                  <li key={guide.id}>
                    <a
                      href={`#${guide.id}`}
                      className="inline-flex min-h-9 items-center rounded-full border border-white/10 bg-white/[0.03] px-3.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                    >
                      {guide.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </section>

        <section
          id="quick-start"
          aria-labelledby="quick-start-title"
          className="mt-6 scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:mt-8 sm:p-6"
        >
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/10 text-sm font-extrabold text-blue-200"
            >
              ▶
            </span>
            <div className="min-w-0">
              <h2
                id="quick-start-title"
                className="text-xl font-extrabold tracking-tight text-white"
              >
                Быстрый старт: шесть шагов
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Порядок важен: агент находит принтеры, принтеры печатают заказы.
                Пропущенный шаг Мастерскую не ломает — она честно скажет в
                карточке, чего не хватает.
              </p>
            </div>
          </div>

          <ol className="mt-5 space-y-2.5">
            {QUICK_START_STEPS.map((step, index) => (
              <li
                key={index}
                className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3"
              >
                <span
                  aria-hidden
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[11px] font-bold tabular-nums text-zinc-300"
                >
                  {index + 1}
                </span>
                <p className="min-w-0 text-sm leading-relaxed text-zinc-200">
                  {step}
                </p>
              </li>
            ))}
          </ol>

          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            Застряли на принтере? Смотрите{" "}
            <a
              href="#faq-printers"
              className="font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
            >
              вопросы про принтеры
            </a>{" "}
            — там разобраны офлайн, пустой поиск в сети и отказы печати.
          </p>
        </section>

        <section
          id="faq"
          aria-labelledby="faq-title"
          className="mt-6 scroll-mt-24 sm:mt-8"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/10 text-lg font-extrabold text-violet-200"
              >
                ?
              </span>
              <div className="min-w-0">
                <h2
                  id="faq-title"
                  className="text-xl font-extrabold tracking-tight text-white"
                >
                  Частые вопросы
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                  Ответы на то, с чем сталкиваются чаще всего. Вопросы сгруппированы
                  по темам; ответы раскрываются по клику — на телефоне так проще
                  листать.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {FAQ_CATEGORIES.map((category) => (
                <div key={category.id} id={category.id} className="scroll-mt-24">
                  <h3 className="text-xs font-semibold tracking-[0.18em] text-blue-300 uppercase">
                    {category.title}
                  </h3>

                  <div className="mt-3 space-y-2">
                    {category.items.map((item) => (
                      <details
                        key={item.question}
                        className="group rounded-xl border border-white/[0.07] bg-black/30 transition-colors open:border-blue-400/30 open:bg-blue-500/[0.04]"
                      >
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-3.5 text-sm font-semibold text-zinc-100 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset">
                          <span className="min-w-0">{item.question}</span>
                          <span
                            aria-hidden
                            className="mt-0.5 shrink-0 text-base leading-none text-zinc-500 transition-transform group-open:rotate-45 group-open:text-blue-300"
                          >
                            +
                          </span>
                        </summary>
                        <div className="border-t border-white/[0.07] px-4 py-4 text-sm leading-relaxed text-zinc-400">
                          {item.answer}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs leading-relaxed text-zinc-500">
              Не нашли ответ? Напишите на{" "}
              <a
                href={`mailto:${LEGAL_OPERATOR.email}`}
                className="font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
              >
                {LEGAL_OPERATOR.email}
              </a>{" "}
              — приложите скриншот и последние строки из окна агента.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="guides-title"
          className="mt-6 scroll-mt-24 sm:mt-8"
        >
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-sm font-extrabold text-zinc-200"
            >
              ↗
            </span>
            <div className="min-w-0">
              <h2
                id="guides-title"
                className="text-xl font-extrabold tracking-tight text-white"
              >
                Подключение площадок и агента
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Пошаговые инструкции: где взять ключи, куда вставить адрес
                вебхука и что нажать в кабинете площадки. Адреса вебхуков
                персональные — копируйте их на вкладке «Интеграции».
              </p>
            </div>
          </div>
        </section>

        <div className="mt-4 space-y-4 sm:space-y-5">
          {GUIDES.map((guide, guideIndex) => (
            <section
              key={guide.id}
              id={guide.id}
              aria-labelledby={`integrations-help-${guide.id}-title`}
              className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
            >
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/10 text-sm font-extrabold tabular-nums text-blue-200"
                >
                  {String(guideIndex + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h3
                    id={`integrations-help-${guide.id}-title`}
                    className="text-xl font-extrabold tracking-tight text-white"
                  >
                    {guide.name}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                    {guide.lead}
                  </p>
                </div>
              </div>

              <ol className="mt-5 space-y-2.5">
                {guide.steps.map((step, stepIndex) => (
                  <li
                    key={stepIndex}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3"
                  >
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[11px] font-bold tabular-nums text-zinc-300"
                    >
                      {stepIndex + 1}
                    </span>
                    <p className="min-w-0 text-sm leading-relaxed text-zinc-200">
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        <aside
          aria-label="Сборка агента из исходников"
          className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5 sm:p-6"
        >
          <p className="text-sm leading-relaxed text-zinc-400">
            {AGENT_BUILD_NOTE}
          </p>
        </aside>

        <aside
          aria-labelledby="integrations-help-warning-title"
          className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 sm:mt-8 sm:p-6"
        >
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-base font-extrabold text-amber-200"
            >
              !
            </span>
            <div className="min-w-0">
              <h2
                id="integrations-help-warning-title"
                className="text-base font-bold text-amber-100"
              >
                Адрес вебхука и токен — секреты
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-amber-100/90">
                URL вебхука содержит секретный токен, а токен агента открывает
                доступ к заданиям печати. Не публикуйте их в открытом доступе и
                не пересылайте в мессенджерах — как пароль.
              </p>
            </div>
          </div>
        </aside>

        <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
          Кабинеты площадок иногда меняются: если раздела с таким названием нет,
          ищите Seller API или API-уведомления в настройках. Адрес вебхука остаётся
          тем же.
        </p>
      </main>
    </div>
  );
}









