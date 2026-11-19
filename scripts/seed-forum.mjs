#!/usr/bin/env node
/**
 * Стартовое наполнение форума: пять категорий и пятнадцать тем.
 *
 * Зачем: после `supabase/forum.sql` форум пустой — в миграции нет категорий,
 * а тем нет вообще. Скрипт создаёт стартовые материалы от команды проекта, а
 * не имитацию активности пользователей: автор один, просмотры нулевые,
 * ответов нет.
 *
 * Запуск: npm run seed:forum
 * Требует в `NEXT_PUBLIC_SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` (можно в
 * `.env.local`). Автор выбирается так:
 *   1. `FORUM_SEED_EMAIL`, если задан;
 *   2. служебный аккаунт `team@tridi-print.ru` с профилем «Команда TriDi».
 * `ADMIN_EMAIL` намеренно не используется: это адрес живого администратора, и
 * стартовые темы не должны публиковаться от его лица. Если нужного аккаунта
 * ещё нет, скрипт создаёт именно `team@tridi-print.ru`.
 * Демо-аккаунт мастерской намеренно не используется: middleware уводит
 * demo-сессию с форума, и такой автор выглядел бы странно.
 *
 * Скрипт идемпотентен: категории обновляются по `slug`, темы вставляются с
 * `ignoreDuplicates`, поэтому повторный запуск не плодит дубли.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  FORUM_LEGACY_CATEGORY_SLUGS,
  FORUM_SEED_CATEGORIES,
  FORUM_SEED_TOPICS,
} from "../data/forum-seed-topics.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const TEAM_EMAIL = "team@tridi-print.ru";
const TEAM_NAME = "Команда TriDi";

function loadEnv() {
  try {
    if (fs.existsSync(ENV_FILE)) {
      process.loadEnvFile(ENV_FILE);
    }
  } catch {
    // Ниже будет понятная ошибка, если ключей действительно нет.
  }
}

function readEnvValue(key) {
  if (!fs.existsSync(ENV_FILE)) return "";

  const line = fs
    .readFileSync(ENV_FILE, "utf8")
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(key + "="));

  if (!line) return "";

  return line
    .slice(line.indexOf("=") + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

/** Значение из окружения, а если его нет — из `.env.local`. */
function envValue(key) {
  return (process.env[key] || readEnvValue(key) || "").trim();
}

/** FORUM_SEED_EMAIL допускает несколько адресов через запятую. */
function parseEmails(value) {
  return value
    .split(/[,\s;]+/)
    .map((email) => email.trim())
    .filter((email) => email.includes("@"));
}

const TRANSLITERATION = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/**
 * Стабильный slug: номер фиксирует позицию темы, хвост из заголовка делает
 * адрес читаемым. При повторном запуске тот же заголовок даёт тот же slug.
 */
function buildSeedSlug(index, title) {
  const tail = title
    .toLocaleLowerCase("ru-RU")
    .split("")
    .map((char) => TRANSLITERATION[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return `forum-seed-${String(index + 1).padStart(2, "0")}${tail ? `-${tail}` : ""}`;
}

/** Ищем пользователя по email среди всех страниц `listUsers`. */
async function findUserByEmail(admin, email) {
  const target = email.trim().toLowerCase();

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error("Не удалось прочитать пользователей: " + error.message);
    }

    const found = data.users.find(
      (user) => (user.email || "").toLowerCase() === target,
    );

    if (found) return found;
    if (data.users.length < 1000) return null;
  }

  return null;
}

/**
 * В части баз `forum_authors` осталась таблицей-кэшем имён, в `forum.sql` это
 * представление над `profiles`. Если перед нами таблица, обновляем строку,
 * чтобы форум сразу показал имя; если представление — ничего не делаем,
 * потому что имя и так приходит из профиля.
 */
async function syncForumAuthorName(admin, userId, displayName) {
  const { error: probeError } = await admin
    .from("forum_authors")
    .select("created_at")
    .limit(1);

  if (probeError) {
    // PGRST204/42703 — это представление без служебной колонки created_at:
    // имя в нём и так берётся из profiles. Остальные ошибки не скрываем.
    if (probeError.code === "PGRST204" || probeError.code === "42703") return;

    throw new Error(
      "Не удалось проверить таблицу forum_authors: " + probeError.message,
    );
  }

  const { error } = await admin
    .from("forum_authors")
    .upsert(
      { id: userId, display_name: displayName },
      { onConflict: "id" },
    );

  if (error) {
    throw new Error("Не удалось обновить имя автора: " + error.message);
  }
}

/**
 * Строка profiles нужна представлению forum_authors. У нового аккаунта её
 * ещё нет; у существующего администратора имя не перезаписываем, если оно уже
 * заполнено, — иначе seed молча переименует живого человека.
 */
async function ensureProfile(admin, user, { name, forceName = false }) {
  const { data: existing, error } = await admin
    .from("profiles")
    .select("id, name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Не удалось прочитать профиль: " + error.message);
  }

  if (!existing) {
    const { error: insertError } = await admin.from("profiles").insert({
      id: user.id,
      email: user.email ?? TEAM_EMAIL,
      name,
    });

    if (insertError) {
      throw new Error("Не удалось создать профиль: " + insertError.message);
    }

    await syncForumAuthorName(admin, user.id, name);

    return name;
  }

  const currentName = existing.name?.trim();

  if (!currentName || (forceName && currentName !== name)) {
    const { error: updateError } = await admin
      .from("profiles")
      .update({ name })
      .eq("id", user.id);

    if (updateError) {
      throw new Error("Не удалось обновить профиль: " + updateError.message);
    }

    await syncForumAuthorName(admin, user.id, name);

    return name;
  }

  await syncForumAuthorName(admin, user.id, currentName);

  return currentName;
}

/**
 * Автор стартовых тем.
 *
 * `FORUM_SEED_EMAIL` позволяет выбрать конкретного существующего автора, но
 * новый аккаунт всегда создаётся как служебный `team@tridi-print.ru` с именем
 * «Команда TriDi»: пароль случайный, вход под ним не предполагается. Адрес из
 * `ADMIN_EMAIL` не используется, чтобы темы не публиковались от лица живого
 * человека.
 */
async function ensureSeedAuthor(admin) {
  const configuredSeedEmails = parseEmails(envValue("FORUM_SEED_EMAIL"));
  const emails =
    configuredSeedEmails.length > 0 ? configuredSeedEmails : [TEAM_EMAIL];

  for (const email of emails) {
    const user = await findUserByEmail(admin, email);

    if (!user) continue;

    const isTeam = email.toLowerCase() === TEAM_EMAIL;
    const displayName = await ensureProfile(admin, user, {
      name: TEAM_NAME,
      forceName: isTeam,
    });

    return {
      id: user.id,
      email: user.email ?? email,
      displayName,
      created: false,
    };
  }

  const existingTeam = await findUserByEmail(admin, TEAM_EMAIL);

  if (existingTeam) {
    const { error } = await admin.auth.admin.updateUserById(existingTeam.id, {
      email_confirm: true,
      user_metadata: {
        name: TEAM_NAME,
        first_name: "Команда",
        last_name: "TriDi",
        is_service: true,
      },
    });

    if (error) {
      throw new Error(
        "Не удалось обновить сервисный аккаунт: " + error.message,
      );
    }

    const displayName = await ensureProfile(admin, existingTeam, {
      name: TEAM_NAME,
      forceName: true,
    });

    return {
      id: existingTeam.id,
      email: TEAM_EMAIL,
      displayName,
      created: false,
    };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: TEAM_EMAIL,
    password: randomBytes(24).toString("hex"),
    email_confirm: true,
    user_metadata: {
      name: TEAM_NAME,
      first_name: "Команда",
      last_name: "TriDi",
      is_service: true,
    },
  });

  if (error || !data.user) {
    throw new Error(
      "Не удалось создать сервисный аккаунт: " + (error?.message || ""),
    );
  }

  const displayName = await ensureProfile(admin, data.user, {
    name: TEAM_NAME,
    forceName: true,
  });

  return {
    id: data.user.id,
    email: TEAM_EMAIL,
    displayName,
    created: true,
  };
}

/**
 * Старый набор разделов заменяется пятью основными. Удаляем только известные
 * легаси-слаги и только пустые категории: если в разделе уже есть тема, он
 * остаётся, а скрипт сообщает об этом. Категории, добавленные вручную, не
 * затрагиваются.
 */
async function cleanupLegacyCategories(admin) {
  const { data: legacy, error } = await admin
    .from("forum_categories")
    .select("id, slug")
    .in("slug", FORUM_LEGACY_CATEGORY_SLUGS);

  if (error) {
    throw new Error(
      "Не удалось прочитать старые категории: " + error.message,
    );
  }

  if (!legacy || legacy.length === 0) {
    return { removed: 0, kept: 0 };
  }

  const legacyIds = legacy.map((category) => category.id);
  const { data: used, error: usedError } = await admin
    .from("forum_threads")
    .select("category_id")
    .in("category_id", legacyIds);

  if (usedError) {
    throw new Error(
      "Не удалось проверить темы старых категорий: " + usedError.message,
    );
  }

  const usedIds = new Set((used ?? []).map((thread) => thread.category_id));
  const removable = legacy.filter((category) => !usedIds.has(category.id));

  if (removable.length === 0) {
    return { removed: 0, kept: legacy.length };
  }

  const { data, error: deleteError } = await admin
    .from("forum_categories")
    .delete()
    .in(
      "id",
      removable.map((category) => category.id),
    )
    .select("id");

  if (deleteError) {
    throw new Error(
      "Не удалось удалить старые категории: " + deleteError.message,
    );
  }

  const removed = (data ?? []).length;

  return { removed, kept: legacy.length - removed };
}

/** Обновляем категории по slug и возвращаем карту slug → id. */
async function upsertCategories(admin) {
  const { data: existing, error: existingError } = await admin
    .from("forum_categories")
    .select("slug");

  if (existingError) {
    throw new Error(
      "Не удалось прочитать категории: " + existingError.message,
    );
  }

  const existingSlugs = new Set((existing ?? []).map((row) => row.slug));

  const { data, error } = await admin
    .from("forum_categories")
    .upsert(FORUM_SEED_CATEGORIES, { onConflict: "slug" })
    .select("id, slug, title");

  if (error) {
    throw new Error("Не удалось обновить категории: " + error.message);
  }

  const categoryIds = new Map(
    (data ?? []).map((category) => [category.slug, category.id]),
  );

  for (const category of FORUM_SEED_CATEGORIES) {
    if (!categoryIds.has(category.slug)) {
      throw new Error(
        `Категория «${category.slug}» не вернулась после upsert.`,
      );
    }
  }

  const added = FORUM_SEED_CATEGORIES.filter(
    (category) => !existingSlugs.has(category.slug),
  ).length;

  return {
    categoryIds,
    added,
    updated: FORUM_SEED_CATEGORIES.length - added,
  };
}

/**
 * Вставляем темы с детерминированными slug. `ignoreDuplicates` превращает
 * повторный запуск в no-op: существующие строки не перезаписываются, поэтому
 * живые просмотры и будущие правки не теряются.
 */
async function seedTopics(admin, categoryIds, authorId) {
  const rows = FORUM_SEED_TOPICS.map((topic, index) => {
    const categoryId = categoryIds.get(topic.categorySlug);

    if (!categoryId) {
      throw new Error(
        `Для темы «${topic.title}» не найдена категория «${topic.categorySlug}».`,
      );
    }

    return {
      category_id: categoryId,
      slug: buildSeedSlug(index, topic.title),
      title: topic.title,
      content: topic.content,
      author_id: authorId,
      views: 0,
      status: "approved",
    };
  });

  const { data: existing, error: existingError } = await admin
    .from("forum_threads")
    .select("slug")
    .in(
      "slug",
      rows.map((row) => row.slug),
    );

  if (existingError) {
    throw new Error("Не удалось прочитать темы: " + existingError.message);
  }

  const existingSlugs = new Set((existing ?? []).map((row) => row.slug));
  const pending = rows.filter((row) => !existingSlugs.has(row.slug));
  let inserted = 0;

  if (pending.length > 0) {
    const { data, error } = await admin
      .from("forum_threads")
      .upsert(pending, { onConflict: "slug", ignoreDuplicates: true })
      .select("slug");

    if (error) {
      throw new Error("Не удалось вставить темы: " + error.message);
    }

    inserted = (data ?? []).length;
  }

  return {
    inserted,
    skipped: rows.length - inserted,
    total: rows.length,
  };
}

async function main() {
  loadEnv();

  const supabaseUrl = envValue("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = envValue("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в окружении или .env.local.",
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log("Форум: стартовое наполнение");
  console.log(`Supabase: ${supabaseUrl}`);

  const author = await ensureSeedAuthor(admin);

  console.log(
    `Автор: ${author.displayName} <${author.email}>${
      author.created ? " — аккаунт создан" : ""
    }`,
  );

  const cleanup = await cleanupLegacyCategories(admin);

  if (cleanup.removed > 0 || cleanup.kept > 0) {
    console.log(
      `Старые категории: удалено ${cleanup.removed}${
        cleanup.kept > 0
          ? `, оставлено ${cleanup.kept} — в них уже есть темы`
          : ""
      }.`,
    );
  }

  const categories = await upsertCategories(admin);

  console.log(
    `Категории: добавлено ${categories.added}, обновлено ${categories.updated}, всего в наборе ${FORUM_SEED_CATEGORIES.length}.`,
  );

  const topics = await seedTopics(
    admin,
    categories.categoryIds,
    author.id,
  );

  console.log(
    `Темы: вставлено ${topics.inserted}, пропущено ${topics.skipped}, всего в наборе ${topics.total}.`,
  );
  console.log(
    `Проверка: откройте /forum — стартовые темы видны гостю, автор — ${author.displayName}.`,
  );
}

main().catch((error) => {
  console.error(
    "Не удалось засеять форум:",
    error instanceof Error ? error.message : error,
  );
  console.error(
    "Проверьте, что supabase/forum.sql и supabase/forum_categories.sql применены, а ключ service_role актуален.",
  );
  process.exitCode = 1;
});
