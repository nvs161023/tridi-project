#!/usr/bin/env node
/**
 * Проверка импортов до сборки.
 *
 * Каждый импорт вида "@/..." и каждый относительный импорт должен указывать на
 * существующий файл — и обязательно с тем же регистром, что на диске.
 *
 * Зачем это нужно: Windows регистр не различает, а Linux (контейнер сборки
 * Amvera) — различает. Импорт "@/lib/Supabase/server" на Windows собирается без
 * ошибок, а на Amvera падает с "Module not found". Здесь это ловится заранее и с
 * понятным текстом: файл, строка, импорт и что реально лежит на диске.
 *
 * Запуск: npm run check:imports (входит в npm run build:amvera).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json"];

function entriesOf(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Существует ли путь ровно с таким регистром имён (как на Linux). */
function existsExact(relPath) {
  let current = root;

  for (const segment of relPath.split("/").filter(Boolean)) {
    const entry = entriesOf(current).find((item) => item.name === segment);
    if (!entry) {
      return false;
    }
    current = path.join(current, entry.name);
  }

  return true;
}

/** Ближайший путь, отличающийся только регистром — подсказка для человека. */
function closestByCase(relPath) {
  let current = root;

  for (const segment of relPath.split("/").filter(Boolean)) {
    const entries = entriesOf(current);
    const exact = entries.find((item) => item.name === segment);
    const loose =
      exact ??
      entries.find((item) => item.name.toLowerCase() === segment.toLowerCase());

    if (!loose) {
      return null;
    }

    current = path.join(current, loose.name);
  }

  return path.relative(root, current).replace(/\\/g, "/");
}

function collectSourceFiles() {
  const files = [];

  const walk = (dir) => {
    for (const entry of entriesOf(dir)) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (["node_modules", ".next", ".git"].includes(entry.name)) {
          continue;
        }
        walk(full);
      } else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) {
        files.push(full);
      }
    }
  };

  for (const dir of ["app", "components", "lib", "scripts"]) {
    walk(path.join(root, dir));
  }

  for (const entry of entriesOf(root)) {
    if (entry.isFile() && /\.(ts|tsx|mjs|js)$/.test(entry.name)) {
      files.push(path.join(root, entry.name));
    }
  }

  return files;
}

const problems = [];
let checkedImports = 0;

for (const file of collectSourceFiles()) {
  const relativeFile = path.relative(root, file).replace(/\\/g, "/");
  const source = fs.readFileSync(file, "utf8");
  const pattern = /(?:from|import)\s+["']([^"']+)["']/g;
  let match;

  while ((match = pattern.exec(source))) {
    const spec = match[1];

    if (!spec.startsWith("@/") && !spec.startsWith(".")) {
      continue;
    }

    checkedImports += 1;

    const base =
      spec.startsWith("@/")
        ? spec.slice(2)
        : path
            .relative(root, path.resolve(path.dirname(file), spec))
            .replace(/\\/g, "/");

    const candidates = [
      base,
      ...EXTENSIONS.map((extension) => `${base}${extension}`),
      ...EXTENSIONS.map((extension) => `${base}/index${extension}`),
    ];

    if (candidates.some((candidate) => existsExact(candidate))) {
      continue;
    }

    const hint = closestByCase(base);
    const line = source.slice(0, match.index).split("\n").length;

    problems.push(
      hint
        ? `${relativeFile}:${line}: импорт "${spec}" — регистр не совпадает, на диске "${hint}"`
        : `${relativeFile}:${line}: импорт "${spec}" — файла нет`,
    );
  }
}

/**
 * Что именно доехало до стадии сборки — по этим строкам сразу видно причину, если
 * что-то не так (например, в контейнере сборки нет tsconfig.json, и тогда алиас
 * "@/*" не работает, хотя файлы на месте).
 */
function printEnvironment() {
  const tsconfigPath = path.join(root, "tsconfig.json");
  let tsconfigState = "НЕТ ФАЙЛА — алиас @/* не работает, сборка упадёт";

  if (fs.existsSync(tsconfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
      tsconfigState = config?.compilerOptions?.paths?.["@/*"]
        ? "есть, алиас @/* настроен"
        : "есть, но алиаса @/* нет — сборка упадёт";
    } catch {
      tsconfigState = "есть, но не читается (битый JSON)";
    }
  }

  console.log("--- Что в дереве сборки ---");
  console.log(`tsconfig.json: ${tsconfigState}`);
  console.log(
    `файлы в корне: ${entriesOf(root)
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort()
      .join(", ")}`,
  );

  const dirs = [
    "lib",
    "lib/supabase",
    "data",
    "components",
    "components/course",
    "components/lesson-visuals",
    "app/actions",
    "scripts",
  ];

  for (const dir of dirs) {
    const names = entriesOf(path.join(root, dir))
      .map((entry) => entry.name)
      .sort()
      .join(", ");
    console.log(`${dir}/: ${names || "— папки нет —"}`);
  }
}

printEnvironment();

console.log(`\nПроверено импортов: ${checkedImports}`);

if (problems.length === 0) {
  console.log("Битых импортов нет.");
  process.exit(0);
}

console.log(`Найдено проблем: ${problems.length}`);
console.log(problems.join("\n"));
process.exit(1);
