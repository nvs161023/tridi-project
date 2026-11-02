/**
 * Статьи блога: чтение markdown-файлов из папки `content/blog`.
 *
 * Блога в базе нет — статьи лежат в репозитории рядом с кодом. Так текст
 * правится в том же пулл-реквесте, что и вёрстка, и не зависит от Supabase.
 * Файл статьи начинается с frontmatter, дальше идёт markdown:
 *
 *   ---
 *   title: "Заголовок страницы и H1"
 *   seoTitle: "Короткий заголовок для <title>"      # необязательно
 *   description: "Описание для списка и сниппета"
 *   date: "2026-11-01"
 *   updated: "2026-11-15"                            # необязательно
 *   ---
 *
 *   ## Первый раздел
 *   Текст…
 *
 * H1 в файле не пишется: страница статьи выводит его из `title`, поэтому
 * заголовок в списке, в `<title>` и в `<h1>` не может разъехаться.
 */
import fs from "node:fs";
import path from "node:path";

/** Папка со статьями. process.cwd() — корень проекта и при сборке, и в проде. */
const BLOG_DIR = path.join(process.cwd(), "content", "blog");

/** Сколько слов читает человек за минуту: по этому считаем время чтения. */
const WORDS_PER_MINUTE = 180;

/** Плоский frontmatter: только строки «ключ: значение». */
type FrontMatter = Record<string, string>;

/** Обязательные поля файла статьи. Без них страница не собирается. */
const REQUIRED_FIELDS = ["title", "description", "date"] as const;

/** Карточка статьи в списке: всё, кроме текста. */
export type BlogPostSummary = {
  /** Имя файла без `.md` — он же адрес `/blog/<slug>`. */
  slug: string;
  /** Заголовок H1 и подпись карточки. */
  title: string;
  /** Короткий заголовок для `<title>`, если полный слишком длинный. */
  seoTitle?: string;
  /** Описание для карточки, сниппета и OpenGraph. */
  description: string;
  /** Дата публикации, `YYYY-MM-DD`. */
  date: string;
  /** Дата последней правки, `YYYY-MM-DD`; по умолчанию равна дате публикации. */
  updated: string;
  /** Время чтения в минутах, минимум одна. */
  readingMinutes: number;
};

/** Статья целиком: карточка плюс markdown-текст. */
export type BlogPost = BlogPostSummary & {
  content: string;
};


/** Снимает кавычки вокруг значения frontmatter. */
function unquote(value: string): string {
  const trimmed = value.trim();
  const isQuoted =
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")));

  return isQuoted ? trimmed.slice(1, -1) : trimmed;
}

/**
 * Делит файл на frontmatter и markdown-текст.
 *
 * Парсер намеренно простой: в блоге нужны только строковые поля, а тащить
 * YAML-библиотеку ради пяти ключей незачем. Ошибка в формате — исключение с
 * именем файла: сборка падает сразу и понятно, а не отдаёт пустую страницу.
 */
function splitFrontMatter(
  raw: string,
  file: string,
): { data: FrontMatter; content: string } {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);

  if (!match) {
    throw new Error(
      `content/blog/${file}: нет frontmatter. Файл должен начинаться с «---» и блока полей.`,
    );
  }

  const data: FrontMatter = {};

  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf(":");

    if (separator <= 0) {
      throw new Error(
        `content/blog/${file}: строка frontmatter «${trimmed}» не в формате «ключ: значение».`,
      );
    }

    const key = trimmed.slice(0, separator).trim();
    data[key] = unquote(trimmed.slice(separator + 1));
  }

  return { data, content: text.slice(match[0].length).trim() };
}

/** Проверяет обязательные поля и формат дат. */
function requireFields(data: FrontMatter, file: string): void {
  for (const field of REQUIRED_FIELDS) {
    if (!data[field]) {
      throw new Error(
        `content/blog/${file}: заполните обязательное поле «${field}» во frontmatter.`,
      );
    }
  }

  for (const field of ["date", "updated"] as const) {
    const value = data[field];

    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(
        `content/blog/${file}: поле «${field}» должно быть датой в формате ГГГГ-ММ-ДД, сейчас «${value}».`,
      );
    }
  }
}

/** Время чтения в минутах: минимум одна, чтобы у карточки не было «0 мин». */
function readingMinutes(content: string): number {
  const words = content.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;

  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Собирает карточку статьи из frontmatter. */
function toSummary(
  slug: string,
  content: string,
  data: FrontMatter,
  file: string,
): BlogPostSummary {
  requireFields(data, file);

  return {
    slug,
    title: data.title,
    seoTitle: data.seoTitle || undefined,
    description: data.description,
    date: data.date,
    updated: data.updated || data.date,
    readingMinutes: readingMinutes(content),
  };
}

/** Список markdown-файлов блога; пустая или отсутствующая папка допустима. */
function blogFileNames(): string[] {
  try {
    return fs.readdirSync(BLOG_DIR).filter((name) => name.endsWith(".md"));
  } catch {
    return [];
  }
}

/**
 * Все статьи, свежие сверху.
 *
 * Даты в формате `YYYY-MM-DD` сравниваются как строки: результат тот же, что
 * у `Date`, но без часовых поясов и лишних объектов.
 */
export function getAllPosts(): BlogPostSummary[] {
  return blogFileNames()
    .map((file) => {
      const slug = file.slice(0, -".md".length);
      const raw = fs.readFileSync(path.join(BLOG_DIR, file), "utf8");
      const { data, content } = splitFrontMatter(raw, file);

      return toSummary(slug, content, data, file);
    })
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
    );
}

/** Слаг — только латиница, цифры и дефисы: адрес страницы и имя файла совпадают. */
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/** Одна статья по слагу или `null`, если файла нет. */
export function getPost(slug: string): BlogPost | null {
  // Слаг приходит из адреса, поэтому сначала проверяем его формат. Иначе
  // значение вида `../package` прочитало бы файл за пределами content/blog.
  if (!isValidSlug(slug)) {
    return null;
  }

  const file = `${slug}.md`;
  const filePath = path.join(BLOG_DIR, file);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = splitFrontMatter(raw, file);

  return { ...toSummary(slug, content, data, file), content };
}

/** Дата статьи по-русски: «1 ноября 2026». */
export function formatPostDate(date: string): string {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

  // Intl добавляет « г.» после года — в подписи под заголовком он лишний.
  return formatted.replace(/\s*г\.$/, "");
}

