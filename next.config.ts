import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Standalone-сборка для хостинга.
   *
   * Amvera собирает образ из всего каталога проекта, и в архив попадает не только
   * нужное для запуска: .next/cache разрастается до 800+ МБ, маски-исключения
   * (`!.next/cache`) платформа игнорирует — архив оставался 809 МБ.
   *
   * В режиме standalone next build сам складывает в .next/standalone только
   * серверный код, трассированные зависимости и package.json; public/ и
   * .next/static копирует туда скрипт build:amvera. Запускается такой образ
   * командой `node .next/standalone/server.js` — без node_modules проекта.
   */
  output: "standalone",
  /**
   * Проверки типов и линт на сборке выключены.
   *
   * На Amvera `next build` падал с SIGTERM на шаге «Linting and checking validity
   * of types»: это OOM — контейнеру не хватало памяти на второй `tsc` по всему
   * проекту поверх самой сборки. Оба гейта прогоняются локально перед пушем
   * (`npx tsc --noEmit` и `npm run lint`), поэтому в продакшн-сборке они только
   * тратят память и время, а ошибку типов всё равно не пропустят — её видно
   * локально. Когда памяти на хостинге станет достаточно, флаги можно снять.
   */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  /**
   * Алиас "@/*" (корень проекта) прямо в конфиге сборщика.
   *
   * Обычно этот алиас живёт только в tsconfig.json (compilerOptions.paths), но
   * сборочное дерево на Amvera приезжает без tsconfig.json, и тогда сборка падает
   * с десятками "Module not found: Can't resolve '@/lib/...'". Turbopack читает
   * resolveAlias из этого конфига и разрешает "@/..." сам, ещё до типов.
   *
   * Форма значения относительная ("./*"): так же работает webpack resolve.alias.
   * tsconfig.json всё равно нужен — но уже только для проверки типов, и его
   * восстанавливает scripts/ensure-tsconfig.mjs.
   */
  turbopack: {
    resolveAlias: {
      "@/*": "./*",
    },
  },
  /**
   * Файлы профилей читаются с диска в API-роуте, а не импортируются в бандл.
   * Включаем их в трассировку зависимостей, чтобы при деплое на платформу с
   * серверлес-сборкой папка profiles/ попала рядом с приложением.
   */
  outputFileTracingIncludes: {
    "/api/profiles/download": ["./profiles/**/*"],
  },
  /**
   * Короткие адреса документов и регистрации.
   *
   * Юридические документы живут в разделе /legal, а форма регистрации — на
   * /auth/sign-up. Короткие адреса (/terms, /privacy, /register) и вариант
   * написания оферты (/legal/oferta) люди пишут и запоминают, поэтому они ведут
   * на настоящие страницы постоянным редиректом (308), а не отдают 404.
   * Редиректы из конфига срабатывают раньше middleware, поэтому работают и для
   * гостя.
   */
  async redirects() {
    return [
      { source: "/terms", destination: "/legal/terms", permanent: true },
      { source: "/privacy", destination: "/legal/privacy", permanent: true },
      /** Вариант написания адреса оферты: люди ищут её как «/legal/oferta». */
      { source: "/legal/oferta", destination: "/legal/offer", permanent: true },
      { source: "/register", destination: "/auth/sign-up", permanent: true },
      /**
       * Выведенный из платформы продвинутый курс: старые закладки и ссылки
       * ведут на актуальный пакет трёх уровней. Редиректы из конфига
       * срабатывают раньше middleware, поэтому работают и для гостя.
       */
      { source: "/course/pro", destination: "/courses/pro", permanent: true },
      {
        source: "/course/pro/:path*",
        destination: "/courses/pro",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
