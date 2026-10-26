"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./start.module.css";

/**
 * Лендинг бесплатного уровня «Новичок» на /start.
 *
 * Вёрстка и тексты перенесены из отдельного index.html без правок контента:
 * классы из style.css стали локальными классами CSS-модуля, а ссылки на
 * регистрацию — внутренними ссылками next/link.
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
          <div className={styles.logo}>
            <span className={styles.logoIcon}>◈</span> TriDi
          </div>
          <Link href={SIGN_UP_HREF} className={styles.headerBtn}>
            Войти / Регистрация
          </Link>
        </div>
      </header>

      {/* Верхняя полоса с честным таймером */}
      <div className={styles.topBar}>
        <div className={`${styles.container} ${styles.topBarInner}`}>
          <span>🔥 Бесплатный доступ закроется через:</span>
          <div className={styles.timer}>
            <span>{hours}</span>:<span>{minutes}</span>:<span>{seconds}</span>
          </div>
        </div>
      </div>

      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.badge}>🎁 Доступ к первому уровню открыт</div>
          <h1>
            Напечатай свою первую идеальную деталь.{" "}
            <span className={styles.textMuted}>
              Даже если принтер пылится с прошлого года.
            </span>
          </h1>
          <p>
            Бесплатный курс из 8 уроков. Без сломанных принтеров, слипшегося
            пластика и непонятных терминов. Практика с первого урока.
          </p>

          <div className={styles.heroImageWrapper}>
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
                  <div className={`${styles.sidebarItem} ${styles.active}`} />
                  <div className={styles.sidebarItem} />
                  <div className={styles.sidebarItem} />
                </div>
                <div className={styles.mockupContent}>
                  <div className={`${styles.mockupLine} ${styles.w40}`} />
                  <div className={`${styles.mockupLine} ${styles.w90}`} />
                  <div className={`${styles.mockupLine} ${styles.w70}`} />
                  <div className={styles.mockupVideoBox}>
                    <div className={styles.playIcon}>▶</div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.glowCenter} />
          </div>

          <div className={styles.ctaGroup}>
            <Link
              href={SIGN_UP_HREF}
              className={`${styles.btn} ${styles.btnPrimary} ${styles.pulse}`}
            >
              Начать бесплатно →
            </Link>
          </div>
          <div className={styles.subtext}>
            Без привязки карты. Доступ открывается сразу после регистрации.
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Знакомая ситуация?</h2>
          <div className={styles.grid2}>
            <div className={`${styles.card} ${styles.painCard}`}>
              <div className={styles.icon}>🖨️</div>
              <h3>Принтер стоит без дела</h3>
              <p>
                Купил оборудование, а что с ним делать — непонятно. Страшно
                сломать или испортить сопло.
              </p>
            </div>
            <div className={`${styles.card} ${styles.painCard}`}>
              <div className={styles.icon}>🌀</div>
              <h3>Деталь отваливается</h3>
              <p>
                Первый слой не прилипает, модель отклеивается на 10-м слое, а
                почему — непонятно.
              </p>
            </div>
            <div className={`${styles.card} ${styles.painCard}`}>
              <div className={styles.icon}>🧩</div>
              <h3>Сотни настроек</h3>
              <p>
                Открываешь слайсер, а там десятки непонятных параметров. Что
                менять — неизвестно.
              </p>
            </div>
            <div className={`${styles.card} ${styles.painCard}`}>
              <div className={styles.icon}>💸</div>
              <h3>Не знаю себестоимость</h3>
              <p>
                Как посчитать, сколько стоит напечатать деталь и не уйти в
                минус?
              </p>
            </div>
          </div>
          <div className={styles.conclusion}>
            Хватит гуглить разрозненные советы. Мы собрали четкую систему.
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.gridBg}`}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Программа курса</h2>
          <p className={styles.sectionSubtitle}>
            8 уроков, которые превратят вас из новичка в уверенного пользователя
          </p>
          <div className={styles.curriculumList}>
            <div className={styles.curriculumItem}>
              <span>01</span> Первый запуск без страха сломать принтер
            </div>
            <div className={styles.curriculumItem}>
              <span>02</span> Что такое слайсер и как его готовить
            </div>
            <div className={styles.curriculumItem}>
              <span>03</span> Идеальный первый слой (секреты адгезии)
            </div>
            <div className={styles.curriculumItem}>
              <span>04</span> Как избавиться от &quot;соплей&quot; и паутины
            </div>
            <div className={styles.curriculumItem}>
              <span>05</span> Прочность деталей: слои и заполнение
            </div>
            <div className={styles.curriculumItem}>
              <span>06</span> Основы 3D-моделирования для печати
            </div>
            <div className={styles.curriculumItem}>
              <span>07</span> Диагностика дефектов: почему все пошло не так
            </div>
            <div className={styles.curriculumItem}>
              <span>08</span> Финальный проект: печатаем крутую деталь
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Они уже начали печатать</h2>
          <div className={styles.grid3}>
            <div className={`${styles.card} ${styles.reviewCard}`}>
              <div className={styles.stars}>★★★★★</div>
              <p>
                «Купил Ender 3, месяц стоял. Прошел 3 урока — наконец-то
                настроил стол и напечатал нормальную вазу!»
              </p>
              <div className={styles.author}>— Дмитрий, новичок</div>
            </div>
            <div className={`${styles.card} ${styles.reviewCard}`}>
              <div className={styles.stars}>★★★★★</div>
              <p>
                «Очень круто, что все схемы нарисованы. Не надо читать тонну
                текста, просто смотришь и делаешь.»
              </p>
              <div className={styles.author}>— Анна, дизайнер</div>
            </div>
            <div className={`${styles.card} ${styles.reviewCard}`}>
              <div className={styles.stars}>★★★★★</div>
              <p>
                «Наконец-то понял, что такое ретракт. Спасибо за практику и
                понятные чек-листы!»
              </p>
              <div className={styles.author}>— Максим, инженер</div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.whyFree}`}>
        <div className={`${styles.container} ${styles.textCenter}`}>
          <h2 className={styles.sectionTitle}>
            Почему мы отдаем это бесплатно?
          </h2>
          <p className={styles.maxW700}>
            Мы уверены в качестве нашего продукта. Пройдите первый уровень,
            напечатайте деталь и посмотрите, как работает наша платформа. Если
            вам понравится — вы сможете перейти на платные уровни («Уверенный»,
            «Инженер», «Заработок»), где мы учим создавать прочные детали и
            зарабатывать на 3D-печати.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Частые вопросы</h2>
          <div className={styles.faqGrid}>
            <div className={`${styles.card} ${styles.faqCard}`}>
              <h4>Это правда бесплатно?</h4>
              <p>
                Да, первый уровень «Новичок» полностью бесплатен. Мы хотим,
                чтобы вы убедились в качестве нашего продукта перед покупкой
                платных курсов.
              </p>
            </div>
            <div className={`${styles.card} ${styles.faqCard}`}>
              <h4>У меня старый принтер, мне подойдет?</h4>
              <p>
                Да. Курс универсален. Мы учим основам, которые работают на любом
                FDM-принтере (Ender, Anycubic, Prusa и др.).
              </p>
            </div>
            <div className={`${styles.card} ${styles.faqCard}`}>
              <h4>Нужна ли карта для регистрации?</h4>
              <p>
                Нет. Для доступа к бесплатному курсу карта не нужна. Просто
                создайте аккаунт.
              </p>
            </div>
            <div className={`${styles.card} ${styles.faqCard}`}>
              <h4>Сколько времени займет обучение?</h4>
              <p>
                Курс рассчитан на 1-2 вечера. Уроки короткие, с практикой. Вы
                сразу сможете напечатать свою первую деталь.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.finalCta}`}>
        <div className={styles.container}>
          <h2>Начни печатать уже сегодня</h2>
          <p>Регистрация занимает 1 минуту. Первый уровень — бесплатно.</p>
          <Link
            href={SIGN_UP_HREF}
            className={`${styles.btn} ${styles.btnPrimary} ${styles.pulse}`}
          >
            Зарегистрироваться бесплатно
          </Link>
          <div className={`${styles.subtext} ${styles.mt20}`}>
            Более 250 наглядных схем, 38 уроков и доступ к сообществу впереди.
          </div>
        </div>
      </section>

      <footer className={styles.siteFooter}>
        <div className={styles.container}>
          <div className={styles.footerContent}>
            <div className={styles.logo}>
              <span className={styles.logoIcon}>◈</span> TriDi
            </div>
            <p>Образовательная платформа по 3D-печати</p>
            <p>© 2026 TriDi. Все права защищены.</p>
          </div>
        </div>
      </footer>

      {/* Sticky CTA для мобильных */}
      <div className={styles.mobileStickyCta}>
        <div className={styles.stickyText}>Первый уровень — бесплатно</div>
        <Link href={SIGN_UP_HREF} className={`${styles.btn} ${styles.btnPrimary}`}>
          Начать
        </Link>
      </div>
    </div>
  );
}
