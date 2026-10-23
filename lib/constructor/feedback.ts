/**
 * Опрос после скачивания STL в Конструкторе.
 *
 * Окно обратной связи открывается после третьего успешного скачивания, а
 * дальше — каждый десятый файл (3, 13, 23, …). Счётчик лежит в localStorage:
 * сервер уже считает бесплатные генерации, но опрос нужен и Pro, у которого
 * записей о скачиваниях нет. Ошибки хранилища (приватный режим, запрет
 * cookies) не мешают скачиванию — тогда считаем в памяти вкладки.
 */
export const CONSTRUCTOR_DOWNLOADS_STORAGE_KEY = "tridi-constructor-downloads";

/** Первое скачивание, после которого спрашиваем оценку. */
export const FEEDBACK_FIRST_DOWNLOAD = 3;

/** Дальше спрашиваем каждый десятый файл. */
export const FEEDBACK_EVERY_DOWNLOADS = 10;

/** Пауза перед показом: сначала браузер должен начать сохранение файла. */
export const FEEDBACK_OPEN_DELAY_MS = 1500;

/** Резервный счётчик вкладки, если localStorage недоступен. */
let sessionDownloads = 0;

/** Сколько скачиваний уже записано в браузере. */
function readStoredDownloads(): number {
  try {
    const stored = window.localStorage.getItem(CONSTRUCTOR_DOWNLOADS_STORAGE_KEY);
    const parsed = Number.parseInt(stored ?? "", 10);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

/**
 * Отмечает успешное скачивание и возвращает новый счётчик.
 *
 * Вызывается только после ответа API с файлом: неудачная генерация опрос не
 * приближает. Значение хранится строкой, чтобы не зависеть от сериализации
 * объектов.
 */
export function registerConstructorDownload(): number {
  if (typeof window === "undefined") {
    sessionDownloads += 1;

    return sessionDownloads;
  }

  const stored = readStoredDownloads();
  const next = stored + 1;

  try {
    window.localStorage.setItem(
      CONSTRUCTOR_DOWNLOADS_STORAGE_KEY,
      String(next),
    );
    sessionDownloads = next;
  } catch {
    // Хранилище недоступно — вкладка помнит свои скачивания до перезагрузки.
    sessionDownloads = Math.max(sessionDownloads, stored) + 1;

    return sessionDownloads;
  }

  return next;
}

/** Пора ли показать окно: 3-е скачивание, затем каждое десятое. */
export function shouldAskForConstructorFeedback(downloads: number): boolean {
  if (!Number.isFinite(downloads) || downloads < FEEDBACK_FIRST_DOWNLOAD) {
    return false;
  }

  return (
    (downloads - FEEDBACK_FIRST_DOWNLOAD) % FEEDBACK_EVERY_DOWNLOADS === 0
  );
}
