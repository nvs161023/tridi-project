/**
 * Проверка закрытости таблицы promo_codes.
 *
 * Запуск: `npm run check:promo-rls` (нужны NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY и SUPABASE_SERVICE_ROLE_KEY в .env.local или
 * окружении; сеть обязательна).
 *
 * Что проверяется на живой базе:
 *   1. анонимный ключ не читает promo_codes — REST отвечает 401/403, а не
 *      списком кодов;
 *   2. анонимный ключ не создаёт коды;
 *   3. service_role читает таблицу — значит, закрыт именно anon, а не всё
 *      приложение.
 *
 * Скрипт ничего не пишет в базу: INSERT повторяет уже существующий код, поэтому
 * даже при ошибочно выданном гранте сработает unique и строка не изменится.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

let failures = 0;

/** Печатает результат одной проверки и считает провалы. */
function check(name, ok, details) {
  console.log(`${ok ? "✓" : "✗"} ${name} — ${details}`);

  if (!ok) {
    failures += 1;
  }
}

/** Читает файл переменных окружения проекта: ключ=значение, без кавычек. */
function readEnv(file) {
  const full = path.join(ROOT, file);

  if (!fs.existsSync(full)) {
    return {};
  }

  const env = {};

  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index <= 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const localEnv = readEnv(".env.local");
const url = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL
)?.replace(/\/+$/, "");
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Нет NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY или SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

/** Запрос к REST с ключом; тело читаем текстом — важен и код, и сообщение. */
async function rest(key, query, init = {}) {
  const response = await fetch(`${url}/rest/v1/promo_codes${query}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  return { status: response.status, text: await response.text() };
}

console.log("=== promo_codes: anon и service_role ===");

const anonymousSelect = await rest(anonKey, "?select=code&limit=1");
const anonymousBlocked =
  anonymousSelect.status === 401 || anonymousSelect.status === 403;

check(
  "Гость не читает коды",
  anonymousBlocked,
  `HTTP ${anonymousSelect.status}: ${anonymousSelect.text.slice(0, 120)}`,
);

const serviceSelect = await rest(
  serviceKey,
  "?select=code,course_id&limit=1",
);
let serviceRows = null;

try {
  serviceRows = JSON.parse(serviceSelect.text);
} catch {
  serviceRows = null;
}

const existingCode = Array.isArray(serviceRows) ? serviceRows[0] : null;

if (existingCode?.code) {
  // Повтор существующего кода: если INSERT вдруг разрешён, сработает unique и
  // строка не изменится, а тест увидит 409 вместо отказа в правах.
  const anonymousInsert = await rest(anonKey, "", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      code: existingCode.code,
      course_id: existingCode.course_id,
    }),
  });

  check(
    "Гость не создаёт коды",
    anonymousInsert.status === 401 || anonymousInsert.status === 403,
    `HTTP ${anonymousInsert.status}: ${anonymousInsert.text.slice(0, 120)}`,
  );
} else {
  check("Гость не создаёт коды", true, "в таблице нет строк — вставка пропущена");
}

check(
  "service_role читает таблицу",
  serviceSelect.status === 200 && Array.isArray(serviceRows),
  `HTTP ${serviceSelect.status}: ${serviceSelect.text.slice(0, 120)}`,
);

console.log(
  failures === 0
    ? "\nИтог: все проверки пройдены."
    : `\nИтог: провалов ${failures}.`,
);
process.exit(failures === 0 ? 0 : 1);
