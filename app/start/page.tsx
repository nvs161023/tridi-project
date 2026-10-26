"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./start.module.css";

/**
 * Лендинг бесплатного уровня «Новичок» на /start.
 *
 * Оформление переработано под премиальный SaaS/EdTech: bento-сетка болей,
 * стеклянные карточки, aurora-градиенты, вертикальный таймлайн программы
 * и аккордеон FAQ.
 *
 * Таймер — перенос script.js: дедлайн на 24 часа хранится в localStorage,
 * поэтому перезагрузка страницы отсчёт не сбрасывает. До гидратации значение
 * неизвестно (localStorage есть только в браузере), поэтому сервер и первый
 * клиентский рендер показывают «00:00:00» — так разметка не расходится.
 */

/** Ключ и длительность таймера — те же, что были в script.js лендинга. */
const TIMER_STORAGE_KEY = "tridi_landing_timer_end";
const TIMER_DURATION_MS = 24 * 60 * 60 * 1000;

/** Куда ведут все кнопки лендинга. */
const SIGN_UP_HREF = "/auth/sign-up";

const MS_IN_HOUR = 60 * 60 * 1000;
const MS_IN_MINUTE = 60 * 1000;
const MS_IN_SECOND = 1000;

/** Два знака в счётчике: 7 → «07». */
function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Остаток до дедлайна в часы, минуты и секунды.
 *
 * Часы считаются по модулю суток, как в исходном скрипте: если в localStorage
 * остался дедлайн больше чем на 24 часа вперёд, счётчик не покажет «25».
 */
function splitTimeLeft(timeLeftMs: number) {
  return {
    hours: pad(Math.floor((timeLeftMs % (24 * MS_IN_HOUR)) / MS_IN_HOUR)),
    minutes: pad(Math.floor((timeLeftMs % MS_IN_HOUR) / MS_IN_MINUTE)),
    seconds: pad(Math.floor((timeLeftMs % MS_IN_MINUTE) / MS_IN_SECOND)),
  };
}

/**
 * Название проекта для шапки и подвала лендинга.
 *
 * Разметка повторяет логотип главной страницы (`components/Logo.tsx`):
 * белое «tridi», синее «-print» и серое «.ru» мельче остальных.
 */
function BrandName() {
  return (
    <span className={styles.logoText}>
      <span className={styles.logoTextWhite}>tridi</span>
      <span className={styles.logoTextBlue}>-print</span>
      <span className={styles.logoTextGray}>.ru</span>
    </span>
  );
}

type PainPoint = {
  icon: string;
  title: string;
  text: string;
  label?: string;
};

/** Четыре боли новичка: первая — главная и занимает широкую ячейку bento. */
const PAIN_POINTS: PainPoint[] = [
  {
    icon: "🖨️",
    label: "Главная боль",
    title: "Принтер стоит без дела",
    text: "Купили оборудование, а что с ним делать — непонятно. Страшно сломать сопло, испортить пластик или потратить выходные на настройки.",
  },
  {
    icon: "🌀",
    title: "Деталь отваливается",
    text: "Первый слой не прилипает, модель отклеивается на десятом слое, а почему — непонятно.",
  },
  {
    icon: "🧩",
    title: "Сотни настроек",
    text: "Открываете слайсер, а там десятки непонятных параметров. Что менять — неизвестно.",
  },
  {
    icon: "💸",
    title: "Не знаю себестоимость",
    text: "Как посчитать, сколько стоит напечатать деталь и не уйти в минус?",
  },
];

type Lesson = {
  number: string;
  icon: string;
  title: string;
  text: string;
};

/** Программа бесплатного уровня: номер, иконка, название и короткое описание. */
const LESSONS: Lesson[] = [
  {
    number: "01",
    icon: "🚀",
    title: "Первый запуск без страха сломать принтер",
    text: "Собираем принтер, выставляем стол и делаем безопасный тестовый запуск.",
  },
  {
    number: "02",
    icon: "🖥️",
    title: "Что такое слайсер и как его готовить",
    text: "Разбираем Cura и PrusaSlicer: профили, температуры и первый G-code.",
  },
  {
    number: "03",
    icon: "🧲",
    title: "Идеальный первый слой: секреты адгезии",
    text: "Настраиваем зазор сопла и подбираем адгезию, чтобы деталь держалась до конца.",
  },
  {
    number: "04",
    icon: "🕸️",
    title: "Как избавиться от «соплей» и паутины",
    text: "Находим причину стрингинга и лечим её ретрактом, температурой и скоростью.",
  },
  {
    number: "05",
    icon: "🧱",
    title: "Прочность деталей: слои и заполнение",
    text: "Выбираем толщину стенок и заполнение под нагрузку, а не «на глаз».",
  },
  {
    number: "06",
    icon: "📐",
    title: "Основы 3D-моделирования для печати",
    text: "Готовим модель к печати: допуски, ориентация и поддержки.",
  },
  {
    number: "07",
    icon: "🔍",
    title: "Диагностика дефектов: почему всё пошло не так",
    text: "Смотрим на дефект и по чек-листу находим настройку, которая его вызывает.",
  },
  {
    number: "08",
    icon: "🏆",
    title: "Финальный проект: печатаем крутую деталь",
    text: "Собираем все навыки и печатаем финальную деталь для портфолио.",
  },
];

type Review = {
  initials: string;
  name: string;
  role: string;
  text: string;
};

/** Отзывы: инициалы — заглушка аватара, имени и роли хватает для доверия. */
const REVIEWS: Review[] = [
  {
    initials: "ДМ",
    name: "Дмитрий",
    role: "новичок",
    text: "Купил Ender 3, месяц стоял. Прошёл 3 урока — наконец-то настроил стол и напечатал нормальную вазу!",
  },
  {
    initials: "АС",
    name: "Анна",
    role: "дизайнер",
    text: "Очень круто, что все схемы нарисованы. Не надо читать тонну текста, просто смотришь и делаешь.",
  },
  {
    initials: "МК",
    name: "Максим",
    role: "инженер",
    text: "Наконец-то понял, что такое ретракт. Спасибо за практику и понятные чек-листы!",
  },
];

type FaqItem = {
  question: string;
  answer: string;
};

/** Вопросы собраны из старых карточек FAQ и дополнены вопросом о сертификате. */
const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Это правда бесплатно?",
    answer:
      "Да, первый уровень «Новичок» полностью бесплатен. Мы хотим, чтобы вы убедились в качестве нашего продукта перед покупкой платных курсов.",
  },
  {
    question: "У меня старый принтер, мне подойдёт?",
    answer:
      "Да. Курс универсален: мы учим основам, которые работают на любом FDM-принтере — Ender, Anycubic, Prusa и других.",
  },
  {
    question: "Нужна ли карта для регистрации?",
    answer:
      "Нет. Для доступа к бесплатному курсу карта не нужна. Просто создайте аккаунт — доступ откроется сразу.",
  },
  {
    question: "Сколько времени займёт обучение?",
    answer:
      "Курс рассчитан на 1–2 вечера. Уроки короткие, с практикой: вы сразу сможете напечатать свою первую деталь.",
  },
  {
    question: "Что я получу после курса?",
    answer:
      "Готовую первую деталь, понятный чек-лист настройки печати и сертификат с QR-кодом, который можно показать заказчику или добавить в портфолио.",
  },
];

export default function StartPage() {
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(TIMER_STORAGE_KEY);
    const parsed = stored === null ? Number.NaN : Number.parseInt(stored, 10);

    let deadline = parsed;

    if (!Number.isFinite(deadline) || deadline <= 0) {
      // Таймера ещё нет — ставим дедлайн на 24 часа вперёд.
      deadline = Date.now() + TIMER_DURATION_MS;
      window.localStorage.setItem(TIMER_STORAGE_KEY, String(deadline));
    }

    // Считаем от дедлайна, а не уменьшаем счётчик: интервал может подтормозить
    // на спящем ноутбуке, а время всё равно должно быть честным.
    const updateTimer = () => setTimeLeftMs(Math.max(0, deadline - Date.now()));

    updateTimer();
    const intervalId = window.setInterval(updateTimer, MS_IN_SECOND);

    return () => window.clearInterval(intervalId);
  }, []);

  const { hours, minutes, seconds } = splitTimeLeft(timeLeftMs ?? 0);

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.siteHeader}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Link href="/" className={styles.logo} aria-label="TriDi — на главную">
            {/*
             * Знак проекта — тот же рисунок, что в шапке сайта
             * (components/Logo.tsx). В public/ лежит его копия logo.svg:
             * SVG-компонент картинкой не подключить. unoptimized — чтобы
             * next/image отдал файл как есть, без оптимизатора для SVG.
             */}
            <Image
              alt=""
              aria-hidden="true"
              className={styles.logoImage}
              height={36}
              priority
              src="/logo.svg"
              unoptimized
              width={36}
            />
            <BrandName />
          </Link>

          <nav className={styles.headerNav} aria-label="Разделы лендинга">
            <a href="#program">Программа</a>
            <a href="#reviews">Отзывы</a>
            <a href="#faq">Вопросы</a>
          </nav>

          <Link href={SIGN_UP_HREF} className={styles.headerBtn}>
            Начать бесплатно
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroAurora} aria-hidden="true" />
        <div className={styles.container}>
          <div className={`${styles.glassCard} ${styles.timerCard}`}>
            <span className={styles.timerDot} aria-hidden="true" />
            <span className={styles.timerLabel}>
              Бесплатный доступ закроется через
            </span>
            <span className={styles.timerDigits}>
              <span>{hours}</span>
              <span className={styles.timerSeparator}>:</span>
              <span>{minutes}</span>
              <span className={styles.timerSeparator}>:</span>
              <span>{seconds}</span>
            </span>
          </div>

          <div className={styles.badge}>🎁 Первый уровень — бесплатно</div>

          <h1 className={styles.heroTitle}>
            Напечатай свою первую идеальную деталь.
            <span className={styles.heroTitleAccent}>
              Даже если принтер пылится с прошлого года.
            </span>
          </h1>

          <p className={styles.heroLead}>
            Бесплатный курс из 8 уроков. Без сломанных принтеров, слипшегося
            пластика и непонятных терминов. Практика с первого урока.
          </p>

          <div className={styles.ctaGroup}>
            <Link
              href={SIGN_UP_HREF}
              className={`${styles.btnPrimary} ${styles.ctaButton}`}
            >
              Начать бесплатно
              <span aria-hidden="true">→</span>
            </Link>
            <a href="#program" className={styles.ctaSecondary}>
              Смотреть программу
            </a>
          </div>

          <div className={styles.heroTrust}>
            <span>Без привязки карты</span>
            <span>Доступ сразу после регистрации</span>
            <span>8 уроков и 250+ схем</span>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.mockup}>
              <div className={styles.mockupHeader}>
                <span />
                <span />
                <span />
                <span className={styles.mockupTitle}>
                  Курс &quot;Новичок&quot;
                </span>
              </div>
              <div className={styles.mockupBody}>
                <div className={styles.mockupSidebar}>
                  <div className={`${styles.sidebarItem} ${styles.active}`}>01. Введение</div>
                  <div className={styles.sidebarItem}>02. Слайсер</div>
                  <div className={styles.sidebarItem}>03. Адгезия</div>
                  <div className={styles.sidebarItem}>04. Ретракт</div>
                </div>
                <div className={styles.mockupContent}>
                  <h3 className={styles.mockupHeading}>Что такое слайсер?</h3>
                  <p className={styles.mockupText}>
                    В этом уроке разберем, как подготовить модель к печати и настроить основные
                    параметры.
                  </p>
                  <div className={styles.mockupVideoBox}>
                    {/*
                     * Кадр с печатью вместо пустой заглушки. fill растягивает
                     * картинку на весь блок, sizes повторяет реальную ширину
                     * блока: мокап не шире 900 px, на телефоне — во всю ширину.
                     */}
                    <Image
                      alt="Процесс 3D-печати"
                      className={styles.mockupVideoImage}
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 640px"
                      src="/hero-video-preview.jpg"
                    />
                    <div className={styles.playIcon}>▶</div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.glowCenter} aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.painSection}`} id="pains">
        <div className={styles.container}>
          <p className={styles.eyebrow}>С чего начинается порядок</p>
          <h2 className={styles.sectionTitle}>Знакомая ситуация?</h2>
          <p className={styles.sectionSubtitle}>
            Если хотя бы один пункт про вас — дальше можно не собирать советы
            по форумам.
          </p>

          <div className={styles.bentoGrid}>
            {PAIN_POINTS.map((pain, index) => (
              <article
                key={pain.title}
                className={`${styles.glassCard} ${styles.bentoCard} ${
                  index === 0
                    ? `${styles.bentoCardWide} ${styles.bentoItemLarge}`
                    : styles.bentoItemSmall
                }`}
              >
                {pain.label ? (
                  <span className={styles.bentoLabel}>{pain.label}</span>
                ) : null}
                <div className={styles.painIcon} aria-hidden="true">
                  {pain.icon}
                </div>
                <h3>{pain.title}</h3>
                <p>{pain.text}</p>
              </article>
            ))}
          </div>

          <p className={styles.conclusion}>
            Хватит гуглить разрозненные советы. Мы собрали чёткую систему.
          </p>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.programSection}`}
        id="program"
      >
        <div className={styles.container}>
          <p className={styles.eyebrow}>8 уроков · практика с первого дня</p>
          <h2 className={styles.sectionTitle}>Программа курса</h2>
          <p className={styles.sectionSubtitle}>
            От первого запуска до готовой детали — по шагам, без лишней теории.
          </p>

          <div className={styles.timelineContainer}>
            {LESSONS.map((lesson) => (
              <div
                key={lesson.number}
                className={`${styles.timelineItem} ${styles.glassCard}`}
              >
                <div className={styles.timelineNumber}>{lesson.number}</div>
                <div className={styles.timelineContent}>
                  <div className={styles.lessonIcon} aria-hidden="true">
                    {lesson.icon}
                  </div>
                  <h3 className={styles.lessonTitle}>{lesson.title}</h3>
                  <p className={styles.lessonText}>{lesson.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} id="reviews">
        <div className={styles.container}>
          <p className={styles.eyebrow}>Реальные первые детали</p>
          <h2 className={styles.sectionTitle}>Они уже начали печатать</h2>
          <p className={styles.sectionSubtitle}>
            Три истории людей, у которых принтер тоже когда-то стоял без дела.
          </p>

          <div className={styles.reviewsGrid}>
            {REVIEWS.map((review) => (
              <article
                key={review.name}
                className={`${styles.glassCard} ${styles.reviewCard}`}
              >
                <div className={styles.reviewHeader}>
                  <div className={styles.reviewAvatar} aria-hidden="true">
                    {review.initials}
                  </div>
                  <div>
                    <div className={styles.reviewName}>{review.name}</div>
                    <div className={styles.reviewRole}>{review.role}</div>
                  </div>
                </div>
                <div className={styles.reviewStars} aria-label="Оценка 5 из 5">
                  ★★★★★
                </div>
                <p className={styles.reviewText}>«{review.text}»</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={`${styles.glassCard} ${styles.whyFreeCard}`}>
            <p className={styles.eyebrow}>Без подвоха</p>
            <h2 className={styles.sectionTitle}>
              Почему мы отдаём это бесплатно?
            </h2>
            <p className={styles.whyFreeText}>
              Мы уверены в качестве продукта. Пройдите первый уровень,
              напечатайте деталь и посмотрите, как работает платформа. Если
              понравится — перейдёте на платные уровни, где мы учим создавать
              прочные детали и зарабатывать на 3D-печати.
            </p>
            <div className={styles.whyFreeStats}>
              <div className={styles.whyFreeStat}>
                <strong>8</strong>
                <span>уроков в первом уровне</span>
              </div>
              <div className={styles.whyFreeStat}>
                <strong>250+</strong>
                <span>наглядных схем</span>
              </div>
              <div className={styles.whyFreeStat}>
                <strong>0 ₽</strong>
                <span>за весь первый уровень</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/*
       * Сертификат — подтверждение навыков после бесплатного уровня. Превью
       * лежит в public/certificate-example.png (911×643), поэтому next/image
       * получает реальные width/height: так браузер знает пропорции до загрузки
       * и секция не «прыгает». sizes повторяет max-width обёртки, а не экрана.
       */}
      <section className={styles.section} id="certificate">
        <div className={styles.container}>
          <p className={styles.eyebrow}>Документ, а не просто галочка</p>
          <h2 className={styles.sectionTitle}>Подтверждение ваших навыков</h2>
          <p className={styles.sectionSubtitle}>
            После прохождения курса вы получите официальный сертификат с
            уникальным QR-кодом для проверки.
          </p>
          <div className={`${styles.glassCard} ${styles.certificateWrapper}`}>
            <div className={styles.certificateInner}>
              <Image
                alt="Сертификат об окончании курса"
                className={styles.certificateImage}
                height={643}
                sizes="(max-width: 768px) 100vw, 800px"
                src="/certificate-example.png"
                width={911}
              />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="faq">
        <div className={styles.container}>
          <p className={styles.eyebrow}>Коротко о главном</p>
          <h2 className={styles.sectionTitle}>Частые вопросы</h2>
          <p className={styles.sectionSubtitle}>
            Нажмите на вопрос — ответ раскроется без перезагрузки страницы.
          </p>

          <div className={styles.faqWrapper}>
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className={styles.faqItem}>
                <summary className={styles.faqSummary}>
                  {item.question}
                </summary>
                <div className={styles.faqContent}>{item.answer}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalCtaGlow} aria-hidden="true" />
        <div className={styles.container}>
          <p className={styles.eyebrow}>Первый шаг — сегодня</p>
          <h2 className={styles.finalCtaTitle}>Начни печатать уже сегодня</h2>
          <p className={styles.finalCtaSubtitle}>
            Регистрация занимает 1 минуту. Первый уровень — бесплатно.
          </p>
          <Link
            href={SIGN_UP_HREF}
            className={`${styles.btnPrimary} ${styles.ctaButton} ${styles.ctaButtonLarge} ${styles.finalCtaButton}`}
          >
            Зарегистрироваться бесплатно
            <span aria-hidden="true">→</span>
          </Link>
          <div className={styles.subtext}>
            Более 250 наглядных схем, 38 уроков и доступ к сообществу впереди.
          </div>
        </div>
      </section>

      {/* Sticky CTA для мобильных */}
      <div className={styles.mobileStickyCta}>
        <div className={styles.stickyText}>Первый уровень — бесплатно</div>
        <Link href={SIGN_UP_HREF} className={`${styles.btnPrimary} ${styles.stickyBtn}`}>
          Начать
        </Link>
      </div>
    </div>
  );
}
