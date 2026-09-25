#!/usr/bin/env node
/**
 * Страховка перед сборкой: tsconfig.json должен существовать и содержать алиас "@/*".
 *
 * Без этого файла (или без compilerOptions.paths) сборщик не знает, что "@/..." —
 * это путь от корня проекта, и сборка падает на каждом таком импорте:
 * "Module not found: Can't resolve '@/lib/course-stats'". Ровно так выглядит
 * лог, когда tsconfig.json не доехал до стадии сборки (Amvera собирает код из
 * git clone / загрузки, и конфигурация может потеряться по пути).
 *
 * Скрипт не ломает нормальную работу: если файл на месте и алиас в нём есть — он
 * просто печатает одну строку. Если файла нет или он без paths — громко
 * предупреждает и восстанавливает конфиг (Next.js при сборке сам дописывает в
 * него свои настройки).
 *
 * Запуск: npm run ensure:tsconfig (входит в npm run build и npm run build:amvera).
 */
import fs from "node:fs";

const TSCONFIG = "tsconfig.json";

/** Конфиг как в репозитории: алиас "@/*" указывает на корень проекта. */
const FALLBACK = {
  compilerOptions: {
    target: "ES2017",
    lib: ["dom", "dom.iterable", "esnext"],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: "esnext",
    moduleResolution: "bundler",
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: "preserve",
    incremental: true,
    plugins: [{ name: "next" }],
    paths: { "@/*": ["./*"] },
  },
  include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  exclude: ["node_modules"],
};

function hasAlias(config) {
  return Boolean(config?.compilerOptions?.paths?.["@/*"]);
}

if (fs.existsSync(TSCONFIG)) {
  let config = null;

  try {
    config = JSON.parse(fs.readFileSync(TSCONFIG, "utf8"));
  } catch (error) {
    console.warn(`[ensure-tsconfig] ${TSCONFIG} не читается: ${error.message}`);
  }

  if (hasAlias(config)) {
    console.log("[ensure-tsconfig] tsconfig.json на месте, алиас @/* настроен.");
    process.exit(0);
  }

  console.warn(
    `[ensure-tsconfig] В ${TSCONFIG} нет алиаса @/* — дописываю, иначе сборка упадёт на импортах "@/...".`,
  );

  const patched = {
    ...(config ?? FALLBACK),
    compilerOptions: {
      ...(config?.compilerOptions ?? FALLBACK.compilerOptions),
      paths: { "@/*": ["./*"] },
    },
  };

  fs.writeFileSync(TSCONFIG, `${JSON.stringify(patched, null, 2)}\n`, "utf8");
  process.exit(0);
}

console.warn(
  [
    `[ensure-tsconfig] ${TSCONFIG} НЕ НАЙДЕН в дереве сборки!`,
    "Без него алиас \"@/*\" не работает, и сборка падает с десятками \"Module not found\".",
    "Создаю файл. Проверьте, почему он не доехал до стадии сборки (git clone / загрузка кода).",
  ].join(" "),
);

fs.writeFileSync(TSCONFIG, `${JSON.stringify(FALLBACK, null, 2)}\n`, "utf8");
