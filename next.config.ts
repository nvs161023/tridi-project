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
};

export default nextConfig;
