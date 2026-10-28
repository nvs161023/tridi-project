/**
 * Загрузчик для запуска TypeScript-модулей проекта обычным Node.
 *
 * Next понимает импорты `@/…` по paths из tsconfig.json, а Node — нет. Этот
 * hook повторяет разрешение: `@/x` → `<корень>/x`, затем пробует расширения
 * `.ts`, `.tsx`, `.js` и `index.ts`. Нужен только scripts/test-db.ts; в
 * приложении и сборке не используется.
 *
 * Запуск:
 *   node --import ./scripts/register-alias.mjs scripts/test-db.ts
 */
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

function isFile(candidate) {
  return existsSync(candidate) && statSync(candidate).isFile();
}

/** Ищет файл по пути без расширения или с одним из известных расширений. */
function findFile(base) {
  if (isFile(base)) {
    return base;
  }

  for (const extension of EXTENSIONS) {
    if (isFile(`${base}${extension}`)) {
      return `${base}${extension}`;
    }
  }

  for (const extension of EXTENSIONS) {
    const indexFile = path.join(base, `index${extension}`);

    if (isFile(indexFile)) {
      return indexFile;
    }
  }

  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null;

    if (specifier.startsWith("@/")) {
      base = path.join(ROOT, specifier.slice(2));
    } else if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:")
    ) {
      base = path.resolve(
        path.dirname(fileURLToPath(context.parentURL)),
        specifier,
      );
    }

    if (base) {
      const file = findFile(base);

      if (file) {
        return { url: pathToFileURL(file).href, shortCircuit: true };
      }
    }

    return nextResolve(specifier, context);
  },
});
