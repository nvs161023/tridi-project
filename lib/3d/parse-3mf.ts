/**
 * Разбор 3MF: для какого принтера нарезан файл.
 *
 * 3MF — это ZIP-архив. Слайсеры Bambu Studio и Orca (а также FlashPrint с
 * профилями Orca) кладут в него два служебных файла:
 *   - `Metadata/slice_info.config` — XML с `<metadata key="printer_model_id"
 *     value="Bambu Lab A1"/>`;
 *   - `Metadata/project_settings.config` — JSON с полями `printer_model` и
 *     `printer_settings_id`.
 * Значение читаем из первого, второго — резерв: часть слайсеров пишет только
 * проект настроек, а не отчёт о нарезке.
 *
 * ZIP разбирается вручную на `node:zlib`, без сторонней библиотеки: `npm
 * install adm-zip` в этом окружении недоступен (реестр отвечает ECONNRESET), а
 * формат здесь нужен минимальный — найти два файла по имени и распаковать их
 * через `inflateRawSync`. Поддерживаются оба способа хранения: deflate (8) и
 * store (0) — 3MF пишут и так, и так.
 *
 * Функция только читает буфер: файл сначала приходит в
 * `/api/workshop/gcode`, поэтому сервер разбирает уже проверенный архив, а не
 * скачивает ссылку, которую прислал браузер.
 */
import { inflateRawSync } from "node:zlib";

/** Сигнатура конца центрального каталога ZIP. */
const EOCD_SIGNATURE = 0x06054b50;

/** Сигнатура записи центрального каталога. */
const CENTRAL_SIGNATURE = 0x02014b50;

/** Сигнатура локального заголовка файла. */
const LOCAL_SIGNATURE = 0x04034b50;

/** Минимальный EOCD: 22 байта без комментария архива. */
const EOCD_MIN_BYTES = 22;

/** Комментарий ZIP занимает не больше 64 КБ — с него начинаем поиск. */
const EOCD_COMMENT_MAX = 0xffff;

/** Предел колонки `workshop_products.sliced_for_printer`. */
export const SLICED_PRINTER_LIMIT = 120;

/** Отчёт слайсера о нарезке: XML, основной источник модели принтера. */
export const SLICE_INFO_PATH = "Metadata/slice_info.config";

/** Проект настроек слайсера: JSON, резервный источник модели принтера. */
export const PROJECT_SETTINGS_PATH = "Metadata/project_settings.config";

/** Ключи XML и JSON в порядке доверия: сначала модель, потом профиль печати. */
const PRINTER_KEYS = [
  "printer_model",
  "printer_model_id",
  "printer_settings_id",
] as const;

/** Запись ZIP, нужная для чтения одного файла. */
type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
};

/**
 * Название модели принтера в одном виде: без кавычек, лишних пробелов и
 * хвоста про сопло.
 *
 * `printer_settings_id` у Bambu Studio выглядит как «Bambu Lab A1 0.4 nozzle»,
 * а сравнивать его нужно с моделью принтера из парка («A1»). Предел длины
 * совпадает с check в базе.
 */
export function cleanPrinterModel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/^\s*["']|["']\s*$/gu, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:mm)?\s*nozzle\b/giu, " ")
    .replace(/\bnozzle\b/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, SLICED_PRINTER_LIMIT).trim() || null;
}


/**
 * Смещение EOCD: он последний в файле, но за ним может лежать комментарий.
 * Возвращает null, если архив обрезан или это не ZIP.
 */
function findEndOfCentralDirectory(buffer: Buffer): number | null {
  const last = buffer.length - EOCD_MIN_BYTES;
  const first = Math.max(0, last - EOCD_COMMENT_MAX);

  for (let offset = last; offset >= first; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }

  return null;
}

/**
 * Центральный каталог: имена файлов и смещения локальных заголовков.
 *
 * ZIP64 и шифрование не поддерживаются: 3MF пишет обычный слайсер, а файл
 * больше лимита загрузки не пройдёт дальше. В таком случае возвращается null —
 * вызывающий код считает, что модели нет.
 */
function readCentralDirectory(buffer: Buffer): ZipEntry[] | null {
  const eocd = findEndOfCentralDirectory(buffer);

  if (eocd === null) {
    return null;
  }

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);

  if (directoryOffset === 0 || directoryOffset >= buffer.length) {
    return null;
  }

  const entries: ZipEntry[] = [];
  let offset = directoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > buffer.length ||
      buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE
    ) {
      return null;
    }

    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;

    if (nameStart + nameLength > buffer.length) {
      return null;
    }

    entries.push({
      name: buffer.toString("utf8", nameStart, nameStart + nameLength),
      method: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      localOffset: buffer.readUInt32LE(offset + 42),
    });

    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}

/** Имя файла в архиве без учёта регистра и обратных слэшей. */
function normalizeEntryName(name: string): string {
  return name.replace(/\\/gu, "/").toLocaleLowerCase("en-US");
}

/** Запись по пути внутри архива; null — файла нет. */
function findEntry(entries: ZipEntry[], path: string): ZipEntry | null {
  const wanted = normalizeEntryName(path);

  return (
    entries.find((entry) => normalizeEntryName(entry.name) === wanted) ?? null
  );
}

/** Текст файла из архива: распаковка deflate или чтение store. */
function readEntryText(buffer: Buffer, entry: ZipEntry): string | null {
  const local = entry.localOffset;

  if (
    local + 30 > buffer.length ||
    buffer.readUInt32LE(local) !== LOCAL_SIGNATURE
  ) {
    return null;
  }

  const nameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const dataStart = local + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;

  if (dataEnd > buffer.length) {
    return null;
  }

  const data = buffer.subarray(dataStart, dataEnd);

  try {
    if (entry.method === 0) {
      return data.toString("utf8");
    }

    if (entry.method === 8) {
      return inflateRawSync(data).toString("utf8");
    }
  } catch {
    return null;
  }

  return null;
}

/** Значение атрибута в теге XML: кавычки одинарные и двойные. */
function readXmlAttribute(tag: string, attribute: string): string | null {
  const pattern = new RegExp(
    `\\b${attribute}\\s*=\\s*("([^"]*)"|'([^']*)')`,
    "iu",
  );
  const match = pattern.exec(tag);

  if (!match) {
    return null;
  }

  return match[2] ?? match[3] ?? null;
}

/**
 * Модель принтера из `slice_info.config`.
 *
 * Bambu Studio и Orca пишут её метаданными пластины:
 * `<metadata key="printer_model_id" value="Bambu Lab A1"/>`. Некоторые версии
 * выгружают обычный тег `<printer_model>` — читаем и его.
 */
export function extractPrinterModelFromSliceInfo(xml: string): string | null {
  const values = new Map<string, string>();
  const metadataTags = xml.match(/<metadata\b[^>]*>/giu) ?? [];

  for (const tag of metadataTags) {
    const key = readXmlAttribute(tag, "key")?.trim().toLocaleLowerCase("en-US");
    const value = readXmlAttribute(tag, "value");

    if (key && value && !values.has(key)) {
      values.set(key, value);
    }
  }

  for (const key of PRINTER_KEYS) {
    const model = cleanPrinterModel(values.get(key));

    if (model) {
      return model;
    }
  }

  for (const key of PRINTER_KEYS) {
    const tag = new RegExp(`<${key}\\b[^>]*>([^<]+)</${key}>`, "iu").exec(xml);
    const model = cleanPrinterModel(tag?.[1]);

    if (model) {
      return model;
    }
  }

  return null;
}

/**
 * Модель принтера из `project_settings.config`.
 *
 * Файл — JSON проекта слайсера. Битый или неожиданный JSON не ошибка загрузки:
 * просто нет подсказки, для какого принтера нарезан файл.
 */
export function extractPrinterModelFromProjectSettings(
  json: string,
): string | null {
  let settings: unknown;

  try {
    settings = JSON.parse(json);
  } catch {
    return null;
  }

  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return null;
  }

  const record = settings as Record<string, unknown>;

  for (const key of PRINTER_KEYS) {
    const model = cleanPrinterModel(record[key]);

    if (model) {
      return model;
    }
  }

  return null;
}

/**
 * Модель принтера из 3MF.
 *
 * Порядок источников повторяет доверие к данным: отчёт слайсера точнее проекта
 * настроек. Если архив не читается или в нём нет обоих файлов, возвращается
 * null — файл всё равно можно приложить, просто без подсказки о принтере.
 */
export function extractPrinterModelFrom3mf(buffer: Buffer): string | null {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }

  const entries = readCentralDirectory(buffer);

  if (!entries || entries.length === 0) {
    return null;
  }

  const sliceInfo = findEntry(entries, SLICE_INFO_PATH);

  if (sliceInfo) {
    const xml = readEntryText(buffer, sliceInfo);
    const model = xml ? extractPrinterModelFromSliceInfo(xml) : null;

    if (model) {
      return model;
    }
  }

  const projectSettings = findEntry(entries, PROJECT_SETTINGS_PATH);

  if (projectSettings) {
    const json = readEntryText(buffer, projectSettings);

    return json ? extractPrinterModelFromProjectSettings(json) : null;
  }

  return null;
}
