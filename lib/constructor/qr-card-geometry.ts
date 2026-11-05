import {
  BoxGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import qrcode from "qrcode-generator";

/**
 * QR-визитка: матрица кода, раскладка и геометрия брелока.
 *
 * Брелок-визитка отличается от остальных пресетов тем, что его форму задаёт не
 * силуэт, а содержимое: строка превращается в матрицу QR, матрица — в модули на
 * лицевой стороне. Поэтому размеры здесь не свободные: чем длиннее ссылка, тем
 * больше версия кода и тем мельче модуль. Всё, что связано с этим пересчётом,
 * живёт в одном файле — панель, API и геометрия читают одно и то же число, и
 * обещание «модуль 0.85 мм» не может разойтись с файлом.
 *
 * Печать диктует нижнюю границу модуля: сопло 0.4 мм не воспроизводит выступ
 * уже примерно 0.8 мм, и код перестаёт читаться сканером. Порог проверяется до
 * геометрии, а не после: лучше отказать с понятным текстом, чем выдать STL,
 * который не сканируется.
 *
 * Рельеф строится без CSG. `shape.holes` в three.js прорезает контур на всю
 * толщину, поэтому «вырезать модуль на 0.3 мм» так нельзя. Вместо этого:
 *   raised  — тело с фаской плюс отдельные бруски модулей, утопленные в него на
 *             0.2 мм (пересечение объёмом — тот же приём, что у шипов кирпича);
 *   engraved — плита толщиной 0.3 мм с дырками на месте тёмных модулей, нижняя
 *             грань плиты уходит в тело на 0.1 мм. Глубина гравировки выходит
 *             ровно 0.3 мм, а совпадающих плоскостей между оболочками нет.
 */

/**
 * Байты строки в UTF-8 — без этого кириллица в vCard превращается в мусор.
 *
 * `qrcode-generator` по умолчанию берёт `charCodeAt(i) & 0xff`: для латиницы это
 * совпадает с UTF-8, а «И» (U+0418) стало бы байтом 0x18, и сканер прочитал бы
 * другую строку. В сборке 2.0.4 таблица `stringToBytesFuncs` осталась только в
 * CJS-файле, в ESM её нет, поэтому кодировщик подставляется свой. Подмена
 * глобальная (генератор вызывает `qrcode.stringToBytes` внутри себя), но файл —
 * единственное место в проекте, которое его импортирует.
 */
const UTF8_ENCODER = new TextEncoder();

qrcode.stringToBytes = (text: string): number[] =>
  Array.from(UTF8_ENCODER.encode(text));

/** Два размера визитки: 60 × 40 под карман и 70 × 45 под длинный контент. */
export const QR_CARD_SIZES = {
  compact: { width: 60, height: 40 },
  wide: { width: 70, height: 45 },
} as const;

export const QR_CARD_SIZE_IDS = ["compact", "wide"] as const;

export type QrCardSize = (typeof QR_CARD_SIZE_IDS)[number];

/** Подписи размеров: миллиметры важнее названий, поэтому они в тексте. */
export const QR_CARD_SIZE_LABELS = {
  compact: "Компактная 60 × 40 мм",
  wide: "Широкая 70 × 45 мм",
} as const satisfies Record<QrCardSize, string>;

/**
 * Как брелок цепляется за кольцо.
 *
 * `tab` — проушина Ø11 мм выступает над корпусом на 4 мм, как у билета: габарит
 * по высоте больше выбранного размера на эти 4 мм. `hole` — отверстие Ø5 мм в
 * теле, как у Apple Tag: габарит ровно по размеру, но код приходится опускать.
 */
export const QR_CARD_TABS = ["tab", "hole"] as const;

export type QrCardTab = (typeof QR_CARD_TABS)[number];

export const QR_CARD_TAB_LABELS = {
  tab: "Проушина Ø11 мм сверху",
  hole: "Отверстие Ø5 мм в теле",
} as const satisfies Record<QrCardTab, string>;

/** Рельеф кода на лицевой стороне: модули выступают или утоплены. */
export const QR_MODES = ["raised", "engraved"] as const;

export type QrMode = (typeof QR_MODES)[number];

export const QR_MODE_LABELS = {
  raised: "Выпуклый, 0.4 мм",
  engraved: "Углублённый, 0.3 мм",
} as const satisfies Record<QrMode, string>;

/** Что зашито в код: ссылка, телефон, почта или визитка vCard. */
export const QR_CONTENT_TYPES = ["url", "tel", "email", "vcard"] as const;

export type QrContentType = (typeof QR_CONTENT_TYPES)[number];

export const QR_CONTENT_TYPE_LABELS = {
  url: "Ссылка",
  tel: "Телефон",
  email: "Почта",
  vcard: "Визитка (имя и телефон)",
} as const satisfies Record<QrContentType, string>;

/** Проверка значений из состояния, ссылки и API: только известные варианты. */
export function isQrCardSize(value: unknown): value is QrCardSize {
  return (
    typeof value === "string" &&
    (QR_CARD_SIZE_IDS as readonly string[]).includes(value)
  );
}

export function isQrCardTab(value: unknown): value is QrCardTab {
  return (
    typeof value === "string" &&
    (QR_CARD_TABS as readonly string[]).includes(value)
  );
}

export function isQrMode(value: unknown): value is QrMode {
  return (
    typeof value === "string" && (QR_MODES as readonly string[]).includes(value)
  );
}

export function isQrContentType(value: unknown): value is QrContentType {
  return (
    typeof value === "string" &&
    (QR_CONTENT_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Минимальный модуль, который воспроизводит FDM-печать, мм.
 *
 * Сопло 0.4 мм кладёт линию шириной 0.4–0.5 мм; выступ или канавка уже 0.8 мм
 * сливается с соседним, и сканер перестаёт различать модули. Порог жёсткий: при
 * меньшем значении панель и API блокируют скачивание, потому что такой код
 * заведомо не читается.
 */
export const QR_CARD_MIN_MODULE_MM = 0.8;

/** Высота выпуклого рельефа над лицевой стороной, мм. */
export const QR_RAISED_HEIGHT_MM = 0.4;

/** Глубина углублённого рельефа в тело, мм. */
export const QR_ENGRAVED_DEPTH_MM = 0.3;

/**
 * Поле вокруг кода, модулей.
 *
 * Стандарт QR — 4 модуля с каждой стороны: без него сканер не находит границы
 * матрицы. Поле не выдавливается и не гравируется, оно остаётся плоским, поэтому
 * входит в габарит кода, но не в рельеф.
 */
export const QR_QUIET_ZONE_MODULES = 4;

/** Скругление корпуса визитки, мм: как у Apple Tag, чтобы не резало ладонь. */
const QR_CARD_CORNER_RADIUS_MM = 4;

/** Фаска по контуру: те же 0.4 / 0.2 мм, что у остальных пресетов брелока. */
const QR_CARD_BEVEL_SIZE_MM = 0.4;
const QR_CARD_BEVEL_THICKNESS_MM = 0.2;
const QR_CARD_BEVEL_SEGMENTS = 2;

/** 32 сегмента на дугу: скругления и отверстие выходят гладкими. */
const QR_CARD_CURVE_SEGMENTS = 32;

/**
 * Поле от кромки корпуса до кода, мм.
 *
 * 3 мм — это стенка, которую держит рука, и запас под фаску: код не должен
 * подходить к скруглённой кромке, иначе крайние модули попадут на фаску.
 */
const QR_CARD_EDGE_MARGIN_MM = 3;

/** Проушина: пятак Ø11 мм выступает над корпусом на 4 мм, отверстие Ø5 мм. */
const QR_TAB_DIAMETER_MM = 11;
const QR_TAB_PROTRUSION_MM = 4;

/** Отверстие в теле: Ø5 мм, центр в 6 мм от верхнего края. */
const QR_HOLE_DIAMETER_MM = 5;
const QR_HOLE_INSET_MM = 6;

/**
 * Сколько места сверху занимает крепление, мм.
 *
 * У проушины: центр пятака стоит в 1.5 мм от кромки (4 − 5.5), значит низ пятака
 * на 7 мм ниже кромки, плюс 2 мм зазора до поля кода. У отверстия: центр в 6 мм,
 * низ в 8.5 мм, плюс 0.5 мм — до первого модуля всё равно остаётся 3.7 мм, потому
 * что поле кода (4 модуля) никто не выдавливает. Оба крепления дают одно и то же
 * число, поэтому полоса под код у них общая, и визитка с отверстием влезает
 * ровно так же, как с проушиной.
 */
const QR_CARD_TOP_RESERVE_MM = 9;

/**
 * Утопление выпуклого рельефа в тело, мм.
 *
 * Брусок модуля должен пересекаться с телом объёмом: касание плоскостями дало бы
 * совпадающие треугольники на лицевой грани, и слайсер показал бы
 * самопересечение.
 */
const QR_RELIEF_EMBED_MM = 0.2;

/**
 * Насколько плита гравировки уходит в тело, мм.
 *
 * Глубина гравировки равна толщине плиты (0.3 мм), поэтому низ плиты обязан быть
 * ниже лицевой грани тела на этот зазор — иначе низ плиты и грань тела совпали бы
 * плоскостями.
 */
const QR_PLATE_OVERLAP_MM = 0.1;

/**
 * Перекрытие соседних брусков рельефа, мм.
 *
 * Два тёмных модуля подряд дают два бруска, которые касаются гранями. 0.06 мм
 * заводят их объёмом друг в друга и убирают совпадающие грани. Для печати это
 * ниже разрешения сопла, поэтому код не «слипается».
 */
const QR_MODULE_OVERLAP_MM = 0.06;

/**
 * Длина ссылки, телефона и почты в символах.
 *
 * Ограничение не про качество кода, а про габарит: 120 символов при коррекции M —
 * это версия 6, где модуль на 60 × 40 не влезает. Длинный vCard с почтой и сайтом
 * — отдельный размер 80 × 50, он появится позже.
 */
export const QR_CARD_CONTENT_MAX_LENGTH = 120;

/** Длина имени в визитке, символов. */
export const QR_CARD_NAME_MAX_LENGTH = 40;

/** Всё, что пользователь выбирает для визитки: размер, крепление и содержимое. */
export type QrCardSpec = {
  /** Размер заготовки: 60 × 40 или 70 × 45 мм. */
  size: QrCardSize;
  /** Крепление: проушина сверху или отверстие в теле. */
  tab: QrCardTab;
  /** Рельеф кода: выпуклый или углублённый. */
  mode: QrMode;
  /** Что кодируется: ссылка, телефон, почта или визитка. */
  contentType: QrContentType;
  /** Значение для ссылки, телефона и почты; у визитки не используется. */
  content: string;
  /** Имя для vCard. */
  name: string;
  /** Телефон для vCard. */
  phone: string;
};

/**
 * Значения по умолчанию: короткая ссылка и компактный размер.
 *
 * Ссылка на главную — 16 байт, то есть версия 2 с запасом по модулю: панель
 * открывается на рабочем варианте, а не на красной плашке «не влезает».
 */
export const DEFAULT_QR_CARD_SPEC: QrCardSpec = {
  size: "compact",
  tab: "tab",
  mode: "raised",
  contentType: "url",
  content: "https://tridi.ru",
  name: "",
  phone: "",
};

/** Телефон в том виде, в каком он попадает в код: цифры и ведущий плюс. */
function qrPhoneDigits(value: string): string {
  const kept = value.trim().replace(/[^\d+]/g, "");

  return kept.startsWith("+")
    ? `+${kept.slice(1).replace(/\+/g, "")}`
    : kept.replace(/\+/g, "");
}

/**
 * Строка, которая уйдёт в QR.
 *
 * Схемы `tel:` и `mailto:` добавлены осознанно: без них телефон и почта в коде —
 * просто текст, и сканер не предложит позвонить или написать. Визитка собирается
 * из имени и телефона в формате vCard 3.0 — его понимают и iOS, и Android. Почта и
 * сайт в визитку не попадают: с ними код переходит в версию 5, и на этих размерах
 * модуль выходит мельче 0.8 мм.
 */
export function qrCardContent(spec: QrCardSpec): string {
  switch (spec.contentType) {
    case "url":
      return spec.content.trim();
    case "email":
      return `mailto:${spec.content.trim()}`;
    case "tel":
      return `tel:${qrPhoneDigits(spec.content)}`;
    case "vcard":
      return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${spec.name.trim()}`,
        `TEL:${qrPhoneDigits(spec.phone)}`,
        "END:VCARD",
      ].join("\n");
  }
}

/** Телефон: цифры, пробелы, скобки, дефис и необязательный ведущий плюс. */
const PHONE_PATTERN = /^\+?[\d\s()-]{5,20}$/;

/**
 * Почему содержимое не годится для кода. null — годится.
 *
 * Проверка общая для панели и API: панель гасит кнопку скачивания с тем же
 * текстом, а сервер отвечает 422, поэтому пользователь видит одну причину, а не
 * «в браузере можно, в файле нельзя».
 */
export function qrCardContentError(spec: QrCardSpec): string | null {
  const value = spec.content.trim();

  switch (spec.contentType) {
    case "url":
      if (!/^https?:\/\/\S+$/i.test(value)) {
        return "Ссылка должна начинаться с http:// или https:// — иначе сканер не откроет её.";
      }

      if (value.length > QR_CARD_CONTENT_MAX_LENGTH) {
        return `Ссылка длиннее ${QR_CARD_CONTENT_MAX_LENGTH} символов: код получится слишком плотным.`;
      }

      return null;
    case "email":
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value)) {
        return "Почта должна быть вида name@example.ru.";
      }

      return null;
    case "tel":
      if (!PHONE_PATTERN.test(value)) {
        return "Телефон — цифры, пробелы, скобки и дефис, от 5 до 20 знаков.";
      }

      return null;
    case "vcard":
      if (value) {
        return "URL, телефон и почта кодируются отдельными типами: в визитку входят только имя и телефон, без почты и сайта.";
      }

      if (
        spec.name.trim().length < 1 ||
        spec.name.trim().length > QR_CARD_NAME_MAX_LENGTH
      ) {
        return `Имя для визитки — от 1 до ${QR_CARD_NAME_MAX_LENGTH} символов.`;
      }

      if (!PHONE_PATTERN.test(spec.phone.trim())) {
        return "Телефон для визитки — цифры, пробелы, скобки и дефис.";
      }

      return null;
  }
}

/**
 * Матрица кода: сколько модулей в стороне и что в каждой клетке.
 *
 * Наружу отдаётся функция, а не двумерный массив: генератор держит матрицу у
 * себя, и копия 33 × 33 на каждый рендер панели была бы лишней работой.
 */
export type QrCardMatrix = {
  /** Модулей в стороне: 21 у версии 1, дальше по 4 на версию. */
  moduleCount: number;
  /** Тёмный ли модуль в строке `row` и столбце `col` сверху вниз. */
  isDark: (row: number, col: number) => boolean;
};

/** Уровень коррекции ошибок QR. */
export type QrErrorCorrection = "L" | "M" | "Q" | "H";

/** Кэш матриц: панель пересобирает раскладку на каждое движение слайдера. */
const MATRIX_CACHE = new Map<string, QrCardMatrix>();

/**
 * Сколько матриц держать в кэше.
 *
 * Ввод в поле идёт по символу, то есть по одной матрице на нажатие. Кэш на 24
 * записи покрывает весь набор вариантов открытой панели (четыре типа содержимого
 * на два уровня коррекции) и не растёт при долгом редактировании.
 */
const MATRIX_CACHE_LIMIT = 24;

/**
 * Матрица QR для строки.
 *
 * `typeNumber = 0` — автоматический подбор версии: генератор берёт минимальную, в
 * которую влезает содержимое при заданном уровне коррекции. Поэтому длина ссылки
 * сама превращается в число модулей, и раскладка не может «разойтись» с кодом.
 */
export function buildQrMatrix(
  content: string,
  ec: QrErrorCorrection = "M",
): QrCardMatrix {
  const key = `${ec}\u0000${content}`;
  const cached = MATRIX_CACHE.get(key);

  if (cached) {
    return cached;
  }

  const code = qrcode(0, ec);

  code.addData(content);
  code.make();

  const matrix: QrCardMatrix = {
    moduleCount: code.getModuleCount(),
    isDark: (row, col) => code.isDark(row, col),
  };

  if (MATRIX_CACHE.size >= MATRIX_CACHE_LIMIT) {
    const oldest = MATRIX_CACHE.keys().next();

    if (!oldest.done) {
      MATRIX_CACHE.delete(oldest.value);
    }
  }

  MATRIX_CACHE.set(key, matrix);

  return matrix;
}

/**
 * Раскладка визитки: габариты, размер модуля и место кода на лицевой стороне.
 *
 * Код ставится по центру по X и в свободную полосу под креплением: сверху место
 * занимает проушина или отверстие, снизу остаётся поле 3 мм. Из двух ограничений
 * — ширины полосы и её высоты — берётся меньшее, поэтому сторона кода вместе с
 * полем всегда равна `qrSideMm`.
 *
 * Все координаты — в системе профиля: центр габарита в нуле, X вправо, Y вверх
 * (как у остальных пресетов брелока).
 */
export type QrCardLayout = {
  /** Габарит корпуса, мм. */
  widthMm: number;
  heightMm: number;
  /** Версия QR: 1 — 21 модуль, дальше по 4 модуля на версию. */
  version: number;
  /** Модулей в стороне без поля. */
  moduleCount: number;
  /** Модулей в стороне вместе с полем: `moduleCount + 8`. */
  cellCount: number;
  /** Сторона одного модуля, мм. */
  moduleMm: number;
  /** Сторона кода вместе с полем, мм. */
  qrSideMm: number;
  /** X левого верхнего угла поля, мм. */
  originXMm: number;
  /** Y верхней кромки поля, мм. */
  originYMm: number;
  /** Уровень коррекции, с которым собрана матрица. */
  ec: QrErrorCorrection;
  /** Почему код не влезает; null — влезает. */
  blockedReason: string | null;
};

/**
 * Раскладка по миллиметрам заготовки.
 *
 * Отдельно от `qrCardLayout`, потому что геометрия читает миллиметры из
 * параметров модели, а панель — из реестра размеров: числа обязаны считаться в
 * одном месте, но приходят они из разных источников.
 */
export function qrCardLayoutFor(
  widthMm: number,
  heightMm: number,
  qrModuleCount: number,
  ec: QrErrorCorrection = "M",
): QrCardLayout {
  // Верх свободной полосы — под креплением, низ — на поле от нижней кромки.
  const bandTop = heightMm / 2 - QR_CARD_TOP_RESERVE_MM;
  const bandBottom = -heightMm / 2 + QR_CARD_EDGE_MARGIN_MM;
  const bandHeight = Math.max(bandTop - bandBottom, 0);
  const availableWidth = Math.max(widthMm - QR_CARD_EDGE_MARGIN_MM * 2, 0);
  const cellCount = qrModuleCount + QR_QUIET_ZONE_MODULES * 2;
  // Сторона кода — меньшее из двух ограничений: так модуль получается крупнее
  // всего, что позволяет заготовка.
  const sideMm = Math.min(availableWidth, bandHeight);
  const moduleMm = sideMm / cellCount;
  const qrSideMm = moduleMm * cellCount;
  const version = Math.round((qrModuleCount - 17) / 4);

  return {
    widthMm,
    heightMm,
    version,
    moduleCount: qrModuleCount,
    cellCount,
    moduleMm,
    qrSideMm,
    originXMm: -qrSideMm / 2,
    // Код стоит по центру свободной полосы: сверху остаётся зазор под кольцо,
    // снизу — поле от кромки.
    originYMm: bandTop - (bandHeight - qrSideMm) / 2,
    ec,
    blockedReason:
      moduleMm < QR_CARD_MIN_MODULE_MM
        ? `QR не влезает: модуль ${moduleMm.toFixed(2)} мм — меньше ${QR_CARD_MIN_MODULE_MM} мм. Укоротите ссылку или выберите широкую визитку 70 × 45 мм.`
        : null,
  };
}

/** Раскладка для выбранного размера: габариты берутся из реестра размеров. */
export function qrCardLayout(
  size: QrCardSize,
  qrModuleCount: number,
  ec: QrErrorCorrection = "M",
): QrCardLayout {
  const { width, height } = QR_CARD_SIZES[size];

  return qrCardLayoutFor(width, height, qrModuleCount, ec);
}


/** Готовая связка «что кодируем» — «какая матрица» — «как это ляжет». */
export type QrCardPlan = {
  spec: QrCardSpec;
  /** Строка, которая уходит в код. */
  content: string;
  /** Её длина в байтах UTF-8: именно она определяет версию кода. */
  bytes: number;
  /** Почему содержимое не годится; null — годится. */
  contentError: string | null;
  matrix: QrCardMatrix;
  layout: QrCardLayout;
};

/** Матрица или null, если генератор не смог её собрать. */
function safeMatrix(
  content: string,
  ec: QrErrorCorrection,
): QrCardMatrix | null {
  try {
    return buildQrMatrix(content, ec);
  } catch {
    return null;
  }
}

/**
 * Полный расчёт визитки для панели, API и геометрии.
 *
 * Сначала пробуется коррекция M: она терпимее к загрязнению и потёртостям, а на
 * этих размерах почти всегда влезает. Если модуль вышел меньше 0.8 мм, матрица
 * пересобирается с уровнем L — он даёт меньшую версию и крупный модуль. Если и L
 * не помогает, раскладка возвращается с причиной отказа, и скачивание блокируется.
 *
 * Ошибка содержимого раскладке не мешает: панель показывает и габарит, и причину.
 * Пустая строка кодируется пробелом — иначе генератор бросил бы исключение на
 * середине ввода.
 */
export function qrCardPlan(spec: QrCardSpec = DEFAULT_QR_CARD_SPEC): QrCardPlan {
  const content = qrCardContent(spec);
  const contentError = qrCardContentError(spec);
  const { width, height } = QR_CARD_SIZES[spec.size];
  const text = content.length > 0 ? content : " ";
  const bytes = UTF8_ENCODER.encode(text).length;
  const matrixM = safeMatrix(text, "M");
  const probe = matrixM ?? buildQrMatrix(" ", "M");
  const layoutM = qrCardLayoutFor(
    width,
    height,
    probe.moduleCount,
    "M",
  );

  if (!matrixM) {
    return {
      spec,
      content,
      bytes,
      contentError:
        contentError ??
        "Из этого текста QR не собирается: сократите содержимое.",
      matrix: probe,
      layout: layoutM,
    };
  }

  if (!layoutM.blockedReason) {
    return {
      spec,
      content,
      bytes,
      contentError,
      matrix: matrixM,
      layout: layoutM,
    };
  }

  const matrixL = safeMatrix(text, "L");

  if (matrixL) {
    const layoutL = qrCardLayoutFor(
      width,
      height,
      matrixL.moduleCount,
      "L",
    );

    if (!layoutL.blockedReason) {
      return {
        spec,
        content,
        bytes,
        contentError,
        matrix: matrixL,
        layout: layoutL,
      };
    }
  }

  return {
    spec,
    content,
    bytes,
    contentError,
    matrix: matrixM,
    layout: layoutM,
  };
}

/**
 * Строка для панели: чем именно набит код и какого размера модуль.
 *
 * Числа берутся из раскладки, а не из ожиданий: если содержимое подросло и код
 * перешёл в следующую версию, плашка покажет новый модуль — тот же, что уйдёт в
 * файл.
 */
export function qrCardReport(plan: QrCardPlan): string {
  const { layout } = plan;

  return `QR версии ${layout.version}: ${layout.moduleCount} × ${layout.moduleCount} модулей, коррекция ${layout.ec}, ${plan.bytes} байт; модуль ${layout.moduleMm.toFixed(2)} мм, поле ${QR_QUIET_ZONE_MODULES} модуля.`;
}


/**
 * Контур корпуса: скруглённый прямоугольник плюс крепление.
 *
 * Проушина — не отдельная оболочка, а часть того же контура: дуга пятака
 * подменяет участок верхней кромки, поэтому корпус остаётся одним
 * `ExtrudeGeometry` без слияния и без CSG — тот же приём, что у билета.
 *
 * Контур строится меньше габарита на фаску: three.js расширяет профиль наружу на
 * `bevelSize` у середины толщины, и панель обещает миллиметры заготовки, а не
 * профиля выдавливания.
 */
function qrCardOutline(width: number, height: number, tab: QrCardTab): Shape {
  const bevel = QR_CARD_BEVEL_SIZE_MM;
  const halfWidth = Math.max(width - bevel * 2, 1) / 2;
  const halfHeight = Math.max(height - bevel * 2, 1) / 2;
  const corner = Math.min(QR_CARD_CORNER_RADIUS_MM, halfWidth, halfHeight);
  // Центр кольца: у проушины — центр пятака (4 − 5.5 от кромки), у отверстия в
  // теле — 6 мм от верхнего края.
  const ringY =
    tab === "tab"
      ? height / 2 - (QR_TAB_DIAMETER_MM / 2 - QR_TAB_PROTRUSION_MM)
      : height / 2 - QR_HOLE_INSET_MM;
  const shape = new Shape();

  // Обход против часовой стрелки: нижняя кромка, правая стенка, верх с
  // креплением, левая стенка.
  shape.moveTo(-halfWidth + corner, -halfHeight);
  shape.lineTo(halfWidth - corner, -halfHeight);
  shape.absarc(
    halfWidth - corner,
    -halfHeight + corner,
    corner,
    -Math.PI / 2,
    0,
    false,
  );
  shape.lineTo(halfWidth, halfHeight - corner);
  shape.absarc(
    halfWidth - corner,
    halfHeight - corner,
    corner,
    0,
    Math.PI / 2,
    false,
  );

  if (tab === "tab") {
    const tabRadius = QR_TAB_DIAMETER_MM / 2 - bevel;
    // Насколько центр пятака ниже верхней кромки профиля: 1.5 − 0.4 = 1.1 мм.
    const tabDrop = halfHeight - ringY;
    // Полухорда, по которой дуга пересекает верхнюю кромку: точка старта и
    // возврата контура.
    const tabChord = Math.sqrt(
      Math.max(tabRadius * tabRadius - tabDrop * tabDrop, 0),
    );
    const tabStartAngle = Math.atan2(tabDrop, tabChord);

    shape.lineTo(tabChord, halfHeight);
    shape.absarc(
      0,
      ringY,
      tabRadius,
      tabStartAngle,
      Math.PI - tabStartAngle,
      false,
    );
    shape.lineTo(-halfWidth + corner, halfHeight);
  } else {
    shape.lineTo(-halfWidth + corner, halfHeight);
  }

  shape.absarc(
    -halfWidth + corner,
    halfHeight - corner,
    corner,
    Math.PI / 2,
    Math.PI,
    false,
  );
  shape.lineTo(-halfWidth, -halfHeight + corner);
  shape.absarc(
    -halfWidth + corner,
    -halfHeight + corner,
    corner,
    Math.PI,
    Math.PI * 1.5,
    false,
  );
  shape.closePath();
  shape.holes.push(qrCardRingHolePath(ringY));

  return shape;
}

/**
 * Сквозное отверстие под кольцо.
 *
 * Радиус больше номинального на фаску: у отверстия three.js поджимает стенку на
 * `bevelSize` так же, как расширяет корпус наружу. Центр считается от номинального
 * габарита, а не от контура крышки: панель обещает 6 мм от края заготовки.
 */
function qrCardRingHolePath(centerY: number): Path {
  const hole = new Path();

  hole.absarc(
    0,
    centerY,
    QR_HOLE_DIAMETER_MM / 2 + QR_CARD_BEVEL_SIZE_MM,
    0,
    Math.PI * 2,
    true,
  );

  return hole;
}

/**
 * Выдавливает контур в слой тела с фаской по обеим кромкам, мм.
 *
 * Полная высота слоя равна `height`: выдавливание идёт на
 * `height − 2 × bevelThickness`, а сдвиг ставит нижнюю грань ровно на `startZ` —
 * так два слоя корпуса с карманом под NFC-метку стыкуются без щели.
 */
function extrudeQrCardLayer(
  shape: Shape,
  startZ: number,
  height: number,
): ExtrudeGeometry {
  const depth = Math.max(height - QR_CARD_BEVEL_THICKNESS_MM * 2, 0.05);
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: QR_CARD_BEVEL_SEGMENTS,
    bevelSize: QR_CARD_BEVEL_SIZE_MM,
    bevelThickness: QR_CARD_BEVEL_THICKNESS_MM,
    curveSegments: QR_CARD_CURVE_SEGMENTS,
    depth,
    steps: 1,
  });

  geometry.translate(0, 0, startZ + QR_CARD_BEVEL_THICKNESS_MM);

  return geometry;
}

/**
 * Выдавливает контур в тело с фаской по обеим кромкам.
 *
 * Повторяет `extrudePresetShape` из `keychain-preset-geometry.ts`, а не импортирует
 * его: тот модуль уже импортирует `buildQrCard`, и обратный импорт закрыл бы цикл.
 * Толщина держится ровно по слайдеру — нижняя грань на Z = 0, верхняя на
 * `thickness`.
 */
function extrudeQrCardBody(
  shape: Shape,
  thickness: number,
): ExtrudeGeometry {
  return extrudeQrCardLayer(shape, 0, thickness);
}
/**
 * Корпус с карманом под NFC-метку: два слоя вместо одного.
 *
 * Задний слой (0 … `pauseZ`) несёт круглое отверстие кармана, передний
 * (`depth` … `thickness`) остаётся сплошным — он и есть крышка над меткой.
 * Перекрытие 0.05 мм не даёт слоям разойтись. Контур строится дважды готовой
 * фабрикой: `qrCardOutline` — чистая функция, и копировать дырки вручную не
 * нужно, а карман попадает только в задний слой.
 */
function qrCardPocketBody(
  outline: () => Shape,
  thickness: number,
  pocket: QrCardNfcPocket,
): BufferGeometry {
  const backShape = outline();
  const hole = new Path();

  hole.absarc(0, pocket.pocketY, pocket.radiusMm, 0, Math.PI * 2, true);
  backShape.holes.push(hole);

  const parts: BufferGeometry[] = [
    extrudeQrCardLayer(backShape, 0, pocket.pauseZ),
    extrudeQrCardLayer(outline(), pocket.depthMm, thickness - pocket.depthMm),
  ];
  const body = mergeGeometries(parts);

  for (const part of parts) {
    part.dispose();
  }

  if (!body) {
    throw new Error(
      "Не удалось соединить слои корпуса визитки с карманом под NFC-метку",
    );
  }

  return body;
}



/**
 * Выдавливает плиту без фаски — второй слой гравировки.
 *
 * Фаска здесь запрещена: three.js расширяет ею и контуры дырок, а модуль шириной
 * 0.8 мм с фаской 0.4 мм превратился бы в щель. Плита строится по тому же контуру,
 * что и крышка тела, поэтому её стенка продолжает фаску без уступа.
 */
function extrudeQrCardPlate(
  shape: Shape,
  fromZ: number,
  depth: number,
): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: QR_CARD_CURVE_SEGMENTS,
    depth,
    steps: 1,
  });

  geometry.translate(0, 0, fromZ);

  return geometry;
}

/** Прямоугольная дырка в плите: обход по часовой стрелке, как у `ringHolePath`. */
function qrModuleHolePath(
  left: number,
  top: number,
  width: number,
  height: number,
): Path {
  const hole = new Path();

  hole.moveTo(left, top);
  hole.lineTo(left + width, top);
  hole.lineTo(left + width, top - height);
  hole.lineTo(left, top - height);
  hole.closePath();

  return hole;
}


/** Прямоугольный блок матрицы: одинаковые по цвету модули, слитые в один. */
type QrModuleRect = {
  /** Столбец левого верхнего модуля. */
  col: number;
  /** Строка верхнего модуля. */
  row: number;
  /** Ширина блока в модулях. */
  cols: number;
  /** Высота блока в модулях. */
  rows: number;
};

/**
 * Раскладка матрицы на блоки одного цвета.
 *
 * Модули выдавливают блоками, а не по одному: у версии 4 это экономит сотни
 * оболочек, а грани внутри блока просто не появляются. Обход жадно тянет блок
 * вправо, а потом вниз, пока вся полоса остаётся нужного цвета и незанятой, — так
 * блоки не перекрываются.
 *
 * `dark` выбирает полярность: `true` — тёмные модули (выпуклый рельеф),
 * `false` — светлые (плита гравировки поднимает их до лица).
 *
 * Блоки соседних строк всё равно касаются гранями, поэтому бруски расширяются на
 * `QR_MODULE_OVERLAP_MM`: совпадающих плоскостей в сетке не остаётся.
 */
function qrModuleRects(matrix: QrCardMatrix, dark: boolean): QrModuleRect[] {
  const size = matrix.moduleCount;
  const covered = new Uint8Array(size * size);
  const rects: QrModuleRect[] = [];

  /** Модуль нужного цвета и ещё не занятый: только такие годятся в новый блок. */
  const isFree = (row: number, col: number): boolean =>
    matrix.isDark(row, col) === dark && covered[row * size + col] === 0;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!isFree(row, col)) {
        continue;
      }

      let cols = 1;

      while (col + cols < size && isFree(row, col + cols)) {
        cols += 1;
      }

      // Строка ниже годится, только если вся полоса блока в ней свободна.
      const rowFits = (candidate: number): boolean => {
        for (let offset = 0; offset < cols; offset += 1) {
          if (!isFree(candidate, col + offset)) {
            return false;
          }
        }

        return true;
      };

      let rows = 1;

      while (row + rows < size && rowFits(row + rows)) {
        rows += 1;
      }

      for (let filledRow = 0; filledRow < rows; filledRow += 1) {
        for (let offset = 0; offset < cols; offset += 1) {
          covered[(row + filledRow) * size + col + offset] = 1;
        }
      }

      rects.push({ col, row, cols, rows });
    }
  }

  return rects;
}

/**
 * Бруски рельефа: по одному на блок модулей, от `bottomZ` до `topZ`.
 *
 * Перекрытие расширяет брусок на обе стороны, поэтому блоки не касаются гранями
 * ни по вертикали, ни по горизонтали. `bottomZ` всегда уходит в тело или в плиту,
 * а `topZ` задаёт лицо рельефа: у выпуклого это `thickness + 0.4`, у углублённого
 * — `thickness`, то есть уровень лица.
 */
function qrReliefBoxes(
  plan: QrCardPlan,
  dark: boolean,
  bottomZ: number,
  topZ: number,
): BufferGeometry[] {
  const { moduleMm, originXMm, originYMm } = plan.layout;
  const quiet = QR_QUIET_ZONE_MODULES;
  const depth = topZ - bottomZ;
  const centerZ = (topZ + bottomZ) / 2;
  const boxes: BufferGeometry[] = [];

  for (const rect of qrModuleRects(plan.matrix, dark)) {
    const boxWidth = rect.cols * moduleMm + QR_MODULE_OVERLAP_MM;
    const boxHeight = rect.rows * moduleMm + QR_MODULE_OVERLAP_MM;
    const centerX = originXMm + (quiet + rect.col + rect.cols / 2) * moduleMm;
    const topY = originYMm - (quiet + rect.row) * moduleMm;
    const centerY = topY - (rect.rows * moduleMm) / 2;
    const box = new BoxGeometry(boxWidth, boxHeight, depth);

    box.translate(centerX, centerY, centerZ);
    // mergeGeometries требует одинаковых наборов атрибутов: у корпуса
    // ExtrudeGeometry неиндексированная сетка, поэтому брусок тоже
    // разворачивается в список треугольников.
    boxes.push(box.toNonIndexed());
    box.dispose();
  }

  return boxes;
}

/**
 * Выпуклый рельеф кода: тёмные модули выступают над лицевой стороной.
 *
 * Брусок уходит в тело на `QR_RELIEF_EMBED_MM` и выступает на
 * `QR_RAISED_HEIGHT_MM`: оболочка пересекается с корпусом объёмом, поэтому
 * `mergeGeometries` даёт годную к печати сетку без самопересечений.
 */
function raisedReliefGeometry(
  plan: QrCardPlan,
  thickness: number,
): BufferGeometry | null {
  const boxes = qrReliefBoxes(
    plan,
    true,
    thickness - QR_RELIEF_EMBED_MM,
    thickness + QR_RAISED_HEIGHT_MM,
  );

  if (boxes.length === 0) {
    return null;
  }

  const merged = mergeGeometries(boxes);

  boxes.forEach((box) => box.dispose());

  return merged;
}


/**
 * Углублённый рельеф: тёмные модули остаются на дне, светлые поднимаются до лица.
 *
 * `shape.holes` прорезает контур на всю толщину, поэтому «вырезать 0.3 мм» одним
 * выдавливанием нельзя. Вместо этого лицо карты собирается из двух частей:
 *
 *   плита — контур корпуса с кольцом и одним прямоугольным окном под матрицу кода;
 *           она закрывает всё лицо, кроме самой матрицы, и стоит от
 *           `thickness − 0.4` до `thickness`;
 *   бруски — светлые модули той же высоты, поднятые до `thickness`. Тёмные модули
 *           брусков не получают, их дном остаётся лицо тела на `thickness − 0.3`.
 *
 * Глубина гравировки выходит ровно 0.3 мм, поле вокруг кода (4 модуля) остаётся
 * частью плиты, то есть плоским, а совпадающих плоскостей между оболочками нет:
 * низ плиты и брусков уходит в тело на 0.1 мм.
 *
 * Одно окно вместо сотни дырок — не оптимизация, а требование к сетке: триангулятор
 * three.js теряет часть граней крышки, когда отверстий много и они лежат на общих
 * линиях, а строки матрицы выглядят именно так. С двумя отверстиями (окно и
 * кольцо) он работает чисто.
 */
function engravedReliefGeometry(
  plan: QrCardPlan,
  width: number,
  height: number,
  tab: QrCardTab,
  thickness: number,
): BufferGeometry | null {
  const { moduleMm, moduleCount, originXMm, originYMm } = plan.layout;
  const depth = QR_ENGRAVED_DEPTH_MM + QR_PLATE_OVERLAP_MM;
  const matrixSide = moduleCount * moduleMm;
  const plate = qrCardOutline(width, height, tab);

  // Окно ровно по матрице: поле вокруг кода остаётся частью плиты.
  plate.holes.push(
    qrModuleHolePath(
      originXMm + QR_QUIET_ZONE_MODULES * moduleMm,
      originYMm - QR_QUIET_ZONE_MODULES * moduleMm,
      matrixSide,
      matrixSide,
    ),
  );

  const frame = extrudeQrCardPlate(plate, thickness - depth, depth);
  const boxes = qrReliefBoxes(plan, false, thickness - depth, thickness);

  if (boxes.length === 0) {
    return frame;
  }

  const merged = mergeGeometries([frame, ...boxes]);

  frame.dispose();
  boxes.forEach((box) => box.dispose());

  return merged;
}


/** Габарит и толщина из слайдеров плюс всё, что выбрано для визитки. */
/**
 * Карман под NFC-метку в корпусе визитки.
 *
 * Числа считает `nfcLayout` в `keychain-preset-geometry.ts`: этот модуль не знает
 * ни про метку, ни про стенку — он только вырезает круг в заднем слое.
 */
export type QrCardNfcPocket = {
  /** Центр круга по Y, мм. */
  pocketY: number;
  /** Радиус круга по контуру, мм. */
  radiusMm: number;
  /** Глубина кармана от нижней грани, мм. */
  depthMm: number;
  /** Верх заднего слоя: на нём ставится пауза M600, мм. */
  pauseZ: number;
};

/** Параметры геометрии визитки: габарит, толщина и содержимое кода. */
export type QrCardGeometryParams = {
  /** Ширина заготовки, мм: у пресета равна выбранному размеру. */
  width: number;
  /** Высота заготовки, мм; проушина добавляет к ней 4 мм габарита. */
  height: number;
  /** Толщина основы, мм. */
  thickness: number;
  /** Размер, крепление, рельеф и содержимое кода. */
  qr?: QrCardSpec | null;
  /**
   * Карман под NFC-метку; null — корпус цельный.
   *
   * Приходит готовой раскладкой: глубина, радиус и центр круга.
   */
  nfc?: QrCardNfcPocket | null;
};

/** Одна оболочка или слияние: габарит и сфера нужны сцене и экспорту. */
function finishQrCard(geometry: BufferGeometry): BufferGeometry {
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Геометрия QR-визитки.
 *
 * Пресеты получают только три числа, поэтому содержимое приходит дополнительным
 * блоком `qr`; без него модель собирается по умолчанию — так предпросмотр старого
 * проекта не падает.
 *
 * Если код не влезает или содержимое ещё не годится, возвращается корпус без
 * рельефа. Это не «тихая подмена»: панель и API блокируют скачивание с той же
 * причиной, а сцена остаётся живой и показывает карту целиком — по ней видно
 * проушину и габарит.
 *
 * NFC-карман делит только корпус: рельеф кода остаётся на лице, а пауза
 * печатается на верхе заднего слоя — там же, где у остальных пресетов.
 */
export function buildQrCard(params: QrCardGeometryParams): BufferGeometry {
  const spec = params.qr ?? DEFAULT_QR_CARD_SPEC;
  const plan = qrCardPlan(spec);
  // У гравировки плита ложится поверх тела, поэтому тело ниже на её толщину:
  // сумма остаётся равной слайдеру.
  const bodyThickness =
    spec.mode === "engraved"
      ? Math.max(params.thickness - QR_ENGRAVED_DEPTH_MM, 0.4)
      : params.thickness;
  const outline = () => qrCardOutline(params.width, params.height, spec.tab);
  const body = params.nfc
    ? qrCardPocketBody(outline, bodyThickness, params.nfc)
    : extrudeQrCardBody(outline(), bodyThickness);

  if (plan.layout.blockedReason || plan.contentError) {
    return finishQrCard(body);
  }

  const relief =
    spec.mode === "raised"
      ? raisedReliefGeometry(plan, params.thickness)
      : engravedReliefGeometry(
          plan,
          params.width,
          params.height,
          spec.tab,
          params.thickness,
        );

  if (!relief) {
    return finishQrCard(body);
  }

  const merged = mergeGeometries([body, relief]);

  body.dispose();
  relief.dispose();

  if (!merged) {
    throw new Error("Не удалось объединить корпус визитки и QR-рельеф");
  }

  return finishQrCard(merged);
}

