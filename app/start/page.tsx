import Image from "next/image";
import Link from "next/link";

import lessonsData from "@/data/lessons.json";
import {
  LEVELS,
  TOTAL_LESSONS,
  TOTAL_QUESTIONS,
  TOTAL_TESTS,
  TOTAL_VISUALS,
} from "@/lib/course-levels";
import {
  LESSON_FORMS,
  pluralize,
  TEST_FORMS,
  VISUAL_FORMS,
} from "@/lib/course-stats";

import styles from "./start.module.css";

/**
 * Лендинг бесплатного уровня «Новичок» на /start.
 *
 * Все числа считаются из data/lessons.json и data/course-*.json через
 * lib/course-levels.ts, а названия уроков берутся из самого курса. Поэтому
 * лендинг не может пообещать урок или схему, которых нет в программе.
 *
 * Страница серверная: интерактивность нужна только FAQ, а <details> работает
 * без JavaScript. Цифры попадают в статический HTML, клиентский бандл не тянет
 * данные курсов.
 */

/** Куда ведут все кнопки лендинга. */
const SIGN_UP_HREF = "/auth/sign-up";

/** Бесплатный уровень: его цифры повторяются в hero, программе и сравнении. */
const BASIC_LEVEL = LEVELS[0];

/** Урок бесплатного уровня в том виде, в каком он лежит в data/lessons.json. */
type BasicLesson = {
  lesson_title: string;
  duration: string;
  blocks: { title: string; visual_file?: string | null }[];
};

const BASIC_LESSONS = (
  lessonsData.modules as { lessons: BasicLesson[] }[]
).flatMap((courseModule) => courseModule.lessons);

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
  duration: string;
  visuals: number;
  hasPractice: boolean;
};

/**
 * Подписи к урокам: иконка и одно предложение о содержании.
 *
 * Названия, длительность и число схем здесь не дублируются — они приходят из
 * data/lessons.json. Если урок переименуют или добавят схему, лендинг обновится
 * вместе с курсом и не начнёт обещать лишнего.
 */
const LESSON_COPY: { icon: string; text: string }[] = [
  {
    icon: "🚀",
    text: "Технологии FDM, SLA и SLS, что можно печатать и какие детали принтеру доверять нельзя.",
  },
  {
    icon: "🖥️",
    text: "Рама, кинематика, экструдер, хотэнд и стол: из каких узлов состоит принтер и что ломается чаще всего.",
  },
  {
    icon: "🧲",
    text: "PLA, PETG, ABS, ASA, TPU, PA и PC: свойства, сушка, хранение и выбор пластика под задачу.",
  },
  {
    icon: "🧩",
    text: "Высота слоя, стенки, заполнение, поддержки и предпросмотр — что действительно влияет на деталь.",
  },
  {
    icon: "🧱",
    text: "Зазор сопла, покрытие стола, температура и скорость первого слоя — без «магии» и подбора наугад.",
  },
  {
    icon: "📐",
    text: "Три теста и один профиль: температура, множитель потока, скорость и обдув.",
  },
  {
    icon: "🔍",
    text: "15 дефектов FDM: как выглядит, почему возник и какую настройку менять.",
  },
  {
    icon: "🏆",
    text: "Одна деталь от идеи до замера: подготовка, печать, снятие поддержек и разбор результата.",
  },
];

const LESSONS: Lesson[] = BASIC_LESSONS.map((lesson, index) => ({
  number: String(index + 1).padStart(2, "0"),
  icon: LESSON_COPY[index]?.icon ?? "•",
  title: lesson.lesson_title,
  text: LESSON_COPY[index]?.text ?? "",
  duration: lesson.duration,
  visuals: lesson.blocks.filter((block) => Boolean(block.visual_file)).length,
  hasPractice: lesson.blocks.some((block) => block.title.startsWith("Практика")),
}));

type Review = {
  initials: string;
  name: string;
  role: string;
  /** Что человек уже сделал и чем пользовался — только то, что есть в его тексте. */
  tags: string[];
  text: string;
};

/**
 * Истории учеников, а не агрегированный рейтинг.
 *
 * Оценки и новые отзывы живут в «Центре выпускника» и публикуются после
 * прохождения уровня. Поэтому на лендинге нет выдуманного «4,8 из 5»:
 * доверие здесь держится на конкретных деталях историй и цифрах программы.
 */
const REVIEWS: Review[] = [
  {
    initials: "ДМ",
    name: "Дмитрий",
    role: "новичок",
    tags: ["Ender 3", "3 урока"],
    text: "Купил Ender 3, месяц стоял. Прошёл 3 урока — наконец-то настроил стол и напечатал нормальную вазу!",
  },
  {
    initials: "АС",
    name: "Анна",
    role: "дизайнер",
    tags: ["Схемы", "Без тонны текста"],
    text: "Очень круто, что все схемы нарисованы. Не надо читать тонну текста, просто смотришь и делаешь.",
  },
  {
    initials: "МК",
    name: "Максим",
    role: "инженер",
    tags: ["Ретракт", "Чек-листы"],
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
    answer: `Программа рассчитана на ${BASIC_LEVEL.hours} вместе с практикой — в первом уровне ${BASIC_LEVEL.practiceMinutes} минут практики. Темп можно выбрать свой: уроки короткие, а финальный проект собирает навыки в одну деталь.`,
  },
  {
    question: "Что я получу после курса?",
    answer:
      "Готовую первую деталь, понятный чек-лист настройки печати и сертификат с QR-кодом, который можно показать заказчику или добавить в портфолио.",
  },
];

export default function StartPage() {
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
          <div className={`${styles.glassCard} ${styles.heroPill}`}>
            <span className={styles.heroPillDot} aria-hidden="true" />
            <span>
              Первый уровень — 0 ₽. Доступ сразу после регистрации.
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
            Бесплатный курс из {BASIC_LEVEL.totalLessons} уроков. Без сломанных
            принтеров, слипшегося пластика и непонятных терминов. Практика с
            первого урока.
          </p>

          <div className={styles.ctaGroup}>
            <Link
              href={SIGN_UP_HREF}
              className={`${styles.btnPrimary} ${styles.ctaButton}`}
            >
              Забрать бесплатный уровень
              <span aria-hidden="true">→</span>
            </Link>
            <a href="#program" className={styles.ctaSecondary}>
              Смотреть программу
            </a>
          </div>

          <p className={styles.ctaMicrocopy}>
            {BASIC_LEVEL.totalLessons}{" "}
            {pluralize(BASIC_LEVEL.totalLessons, LESSON_FORMS)},{" "}
            {BASIC_LEVEL.visuals} {pluralize(BASIC_LEVEL.visuals, VISUAL_FORMS)}{" "}
            и {BASIC_LEVEL.tests} {pluralize(BASIC_LEVEL.tests, TEST_FORMS)} — без
            карты.
          </p>

          <div className={styles.heroTrust}>
            <span>
              {BASIC_LEVEL.totalLessons}{" "}
              {pluralize(BASIC_LEVEL.totalLessons, LESSON_FORMS)} ·{" "}
              {BASIC_LEVEL.visuals} {pluralize(BASIC_LEVEL.visuals, VISUAL_FORMS)}
            </span>
            <span>
              {BASIC_LEVEL.tests} {pluralize(BASIC_LEVEL.tests, TEST_FORMS)} ·{" "}
              {BASIC_LEVEL.questions} вопросов
            </span>
            <span>Без карты</span>
            <a href="#reviews">{REVIEWS.length} истории учеников</a>
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
                  <div className={styles.mockupProgressBlock}>
                    <div className={styles.mockupProgressHeader}>
                      <span>Прогресс уровня</span>
                      <span className={styles.mockupProgressPercent}>25%</span>
                    </div>
                    <div className={styles.mockupProgressBar}>
                      <div className={styles.mockupProgressFill}></div>
                    </div>
                  </div>

                  <div className={styles.mockupTaskList}>
                    <div className={styles.mockupTaskDone}>✓ Теория изучена</div>
                    <div className={styles.mockupTaskActive}>→ Практика: настройка слайсера</div>
                    <div className={styles.mockupTaskPending}>○ Скачать G-code</div>
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
          <p className={styles.eyebrow}>
            {BASIC_LEVEL.totalLessons}{" "}
            {pluralize(BASIC_LEVEL.totalLessons, LESSON_FORMS)} ·{" "}
            {BASIC_LEVEL.visuals} схем · практика с первого дня
          </p>
          <h2 className={styles.sectionTitle}>Программа курса</h2>
          <p className={styles.sectionSubtitle}>
            От технологий до первого проекта — по шагам, без лишней теории.
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
                  <div className={styles.lessonMeta}>
                    <span>{lesson.duration}</span>
                    <span>
                      {lesson.visuals}{" "}
                      {pluralize(lesson.visuals, VISUAL_FORMS)}
                    </span>
                    {lesson.hasPractice ? <span>практика</span> : null}
                  </div>
                  <p className={styles.lessonText}>{lesson.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.timelineCta}>
            <div className={styles.timelineCtaText}>
              <strong>В конце уровня — тесты и сертификат</strong>
              <span>
                {BASIC_LEVEL.tests}{" "}
                {pluralize(BASIC_LEVEL.tests, TEST_FORMS)} на{" "}
                {BASIC_LEVEL.questions} вопросов с пояснениями. Сертификат с
                QR-кодом выдаётся после прохождения уровня.
              </span>
            </div>
            <Link
              href={SIGN_UP_HREF}
              className={`${styles.btnPrimary} ${styles.timelineCtaButton}`}
            >
              Начать бесплатно
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} id="reviews">
        <div className={styles.container}>
          <p className={styles.eyebrow}>Истории учеников</p>
          <h2 className={styles.sectionTitle}>Они уже начали печатать</h2>
          <p className={styles.sectionSubtitle}>
            {REVIEWS.length} истории людей, у которых принтер тоже когда-то стоял
            без дела.
          </p>

          <div className={styles.reviewsStats}>
            <div className={styles.reviewsStat}>
              <strong>{REVIEWS.length}</strong>
              <span>истории учеников</span>
            </div>
            <div className={styles.reviewsStat}>
              <strong>{BASIC_LEVEL.visuals}</strong>
              <span>схем в первом уровне</span>
            </div>
            <div className={styles.reviewsStat}>
              <strong>{BASIC_LEVEL.questions}</strong>
              <span>вопросов в тестах</span>
            </div>
          </div>

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
                <div className={styles.reviewTags}>
                  {review.tags.map((tag) => (
                    <span key={tag} className={styles.reviewTag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <p className={styles.reviewText}>«{review.text}»</p>
              </article>
            ))}
          </div>

          <p className={styles.reviewsNote}>
            Оценки и новые отзывы публикуются в «Центре выпускника» после
            прохождения уровня.
          </p>
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
                <strong>{BASIC_LEVEL.totalLessons}</strong>
                <span>уроков в первом уровне</span>
              </div>
              <div className={styles.whyFreeStat}>
                <strong>{BASIC_LEVEL.visuals}</strong>
                <span>схем в первом уровне</span>
              </div>
              <div className={styles.whyFreeStat}>
                <strong>0 ₽</strong>
                <span>за весь первый уровень</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.compareSection}`}
        id="compare"
      >
        <div className={styles.container}>
          <p className={styles.eyebrow}>Сравнение без обещаний</p>
          <h2 className={styles.sectionTitle}>Сам или с курсом</h2>
          <p className={styles.sectionSubtitle}>
            Оба пути начинаются с нуля. Разница — в порядке, проверке и времени,
            которое уходит на поиск.
          </p>

          <div className={styles.compareGrid}>
            <article className={`${styles.glassCard} ${styles.compareCard}`}>
              <h3 className={styles.compareTitle}>Сам</h3>
              <dl className={styles.compareList}>
                <div className={styles.compareRow}>
                  <dt>Маршрут</dt>
                  <dd>
                    Собираешь по форумам, видео и советам из разных источников
                  </dd>
                </div>
                <div className={styles.compareRow}>
                  <dt>Материал</dt>
                  <dd>Выбираешь пластик на глаз</dd>
                </div>
                <div className={styles.compareRow}>
                  <dt>Настройки</dt>
                  <dd>Меняешь параметры наугад</dd>
                </div>
                <div className={styles.compareRow}>
                  <dt>Дефект</dt>
                  <dd>Ищешь причину в интернете и угадываешь</dd>
                </div>
                <div className={styles.compareRow}>
                  <dt>Итог</dt>
                  <dd>Как получится; проверить нечем</dd>
                </div>
                <div className={styles.compareRow}>
                  <dt>Цена</dt>
                  <dd>0 ₽ плюс время на поиски</dd>
                </div>
              </dl>
            </article>

            <article
              className={`${styles.glassCard} ${styles.compareCard} ${styles.compareCardPro}`}
            >
              <span className={styles.compareBadge}>
                Первый уровень — 0 ₽
              </span>
              <h3 className={styles.compareTitle}>С курсом</h3>
              <dl className={styles.compareList}>
                <div className={styles.compareRow}>
                  <dt>Маршрут</dt>
                  <dd>
                    {BASIC_LEVEL.totalLessons} уроков по порядку: технологии →
                    железо → материалы → слайсер → первый слой → настройки →
                    дефекты → проект
                  </dd>
                </div>
                <div className={styles.compareRow}>
                  <dt>Материал</dt>
                  <dd>
                    PLA, PETG, ABS, ASA, TPU, PA и PC: свойства, сушка и
                    хранение
                  </dd>
                </div>
                <div className={styles.compareRow}>
                  <dt>Настройки</dt>
                  <dd>
                    Три теста и один профиль: температура, поток, скорость и
                    обдув
                  </dd>
                </div>
                <div className={styles.compareRow}>
                  <dt>Дефект</dt>
                  <dd>15 проблем: симптом → причина → действие</dd>
                </div>
                <div className={styles.compareRow}>
                  <dt>Итог</dt>
                  <dd>
                    Деталь от идеи до замера, {BASIC_LEVEL.tests}{" "}
                    {pluralize(BASIC_LEVEL.tests, TEST_FORMS)} и сертификат с
                    QR-кодом
                  </dd>
                </div>
                <div className={styles.compareRow}>
                  <dt>Цена</dt>
                  <dd>0 ₽ за первый уровень; принтер и пластик — свои</dd>
                </div>
              </dl>
              <Link href={SIGN_UP_HREF} className={styles.compareCta}>
                Забрать бесплатный уровень
                <span aria-hidden="true">→</span>
              </Link>
            </article>
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
            Первый уровень — бесплатно и без карты. Доступ откроется сразу после
            регистрации.
          </p>
          <Link
            href={SIGN_UP_HREF}
            className={`${styles.btnPrimary} ${styles.ctaButton} ${styles.ctaButtonLarge} ${styles.finalCtaButton}`}
          >
            Зарегистрироваться бесплатно
            <span aria-hidden="true">→</span>
          </Link>
          <div className={styles.subtext}>
            {TOTAL_LESSONS} {pluralize(TOTAL_LESSONS, LESSON_FORMS)},{" "}
            {TOTAL_VISUALS} {pluralize(TOTAL_VISUALS, VISUAL_FORMS)} и{" "}
            {TOTAL_TESTS} {pluralize(TOTAL_TESTS, TEST_FORMS)} на{" "}
            {TOTAL_QUESTIONS} вопросов — во всех уровнях.
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
