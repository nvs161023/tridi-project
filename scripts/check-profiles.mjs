/**
 * Проверка библиотеки профилей печати.
 *
 * Запуск: `npm run check:profiles`.
 *
 * Что закрывает проверка:
 *   1. каждый `file` из `data/profiles.json` существует в `profiles/`;
 *   2. JSON-профиль парсится, а INI содержит хотя бы одну секцию `[`;
 *   3. размер файла больше нуля;
 *   4. даты `testedAt` и `importedAt` валидны и не лежат в будущем;
 *   5. если дата импорта есть, указан слайсер (`importedSlicer`);
 *   6. печатается отчёт покрытия: всего / импортировано / проверено печатью.
 *
 * Сеть не нужна: читаются только файлы репозитория.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, "data", "profiles.json");
const PROFILES_DIR = path.join(ROOT, "profiles");

const failures = [];
const warnings = [];

function fail(name, detail) {
  failures.push(`${name}: ${detail}`);
}

function warn(name, detail) {
  warnings.push(`${name}: ${detail}`);
}

/** Дата в ISO-формате и не в будущем. */
function checkDate(profile, field) {
  const value = profile[field];

  if (!value) {
    return;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    fail(profile.id, `${field} — неверная дата «${value}»`);
    return;
  }

  const tomorrow = Date.now() + 24 * 60 * 60 * 1000;

  if (date.getTime() > tomorrow) {
    fail(profile.id, `${field} — дата в будущем (${value})`);
  }
}

if (!existsSync(CATALOG)) {
  console.error("✗ data/profiles.json не найден");
  process.exit(1);
}

if (!existsSync(PROFILES_DIR)) {
  console.error("✗ папка profiles/ не найдена");
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(CATALOG, "utf8"));
const profiles = catalog.categories.flatMap((category) => category.profiles);

let tested = 0;
let imported = 0;

for (const profile of profiles) {
  const file = path.join(PROFILES_DIR, profile.file);

  if (!profile.file || !existsSync(file)) {
    fail(profile.id, `файл «${profile.file}» не найден в profiles/`);
    continue;
  }

  const size = statSync(file).size;

  if (size === 0) {
    fail(profile.id, "файл пустой");
    continue;
  }

  const text = readFileSync(file, "utf8");

  if (profile.format === "JSON") {
    try {
      JSON.parse(text);
    } catch (error) {
      fail(profile.id, `JSON не парсится: ${error.message}`);
    }
  } else if (!/^\s*\[/m.test(text)) {
    fail(profile.id, "в INI нет ни одной секции [..]");
  }

  checkDate(profile, "testedAt");
  checkDate(profile, "importedAt");

  if (profile.testedAt) {
    tested += 1;

    if (!profile.testedNote) {
      warn(profile.id, "есть testedAt, но нет testedNote");
    }
  }

  if (profile.importedAt) {
    imported += 1;

    if (!profile.importedSlicer) {
      warn(profile.id, "есть importedAt, но нет importedSlicer");
    }
  }
}

const total = profiles.length;

console.log("");
console.log(`Профилей в каталоге: ${total}`);
console.log(`Проверено на печати: ${tested}`);
console.log(`Проверено импортом: ${imported}`);
console.log(`Без проверок: ${profiles.filter((p) => !p.testedAt && !p.importedAt).length}`);

for (const category of catalog.categories) {
  const testedInCategory = category.profiles.filter((p) => p.testedAt).length;
  const importedInCategory = category.profiles.filter((p) => p.importedAt).length;
  console.log(
    `  ${category.title}: ${category.profiles.length} файлов, печать ${testedInCategory}, импорт ${importedInCategory}`,
  );
}

for (const warning of warnings) {
  console.warn(`  ⚠ ${warning}`);
}

if (failures.length > 0) {
  console.error(`\ncheck:profiles — ошибок: ${failures.length}`);
  for (const failure of failures) {
    console.error(`  ✗ ${failure}`);
  }
  process.exit(1);
}

console.log("\ncheck:profiles — ок: файлы на месте, даты валидны.");
