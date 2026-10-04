import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
   * Короткие адреса документов и регистрации.
   *
   * Юридические документы живут в разделе /legal, а форма регистрации — на
   * /auth/sign-up. Короткие адреса (/terms, /privacy, /register) люди пишут и
   * запоминают, поэтому они ведут на настоящие страницы постоянным редиректом
   * (308), а не отдают 404. Редиректы из конфига срабатывают раньше middleware,
   * поэтому работают и для гостя.
   */
  async redirects() {
    return [
      { source: "/terms", destination: "/legal/terms", permanent: true },
      { source: "/privacy", destination: "/legal/privacy", permanent: true },
      { source: "/register", destination: "/auth/sign-up", permanent: true },
    ];
  },
};

export default nextConfig;
