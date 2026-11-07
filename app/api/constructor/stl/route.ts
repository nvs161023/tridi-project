import { readFile } from "node:fs/promises";
import path from "node:path";

import { Mesh } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import type { Font, FontData } from "three/examples/jsm/loaders/FontLoader.js";

import { recordConstructorGeneration } from "@/lib/analytics/generations";
import {
  FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH,
  countConstructorDownloadsThisMonth,
} from "@/lib/constructor/downloads";
import {
  HOLE_PLACEMENT_LABELS,
  isHolePlacement,
  isKeychainPresetId,
  keychainPresetById,
} from "@/lib/constructor/keychain-presets";
import {
  isKeychainPresetImplemented,
  nfcLayout,
} from "@/lib/constructor/keychain-preset-geometry";
import { qrCardPlan } from "@/lib/constructor/qr-card-geometry";
import {
  isQrCardSize,
  isQrCardTab,
  isQrContentType,
  isQrMode,
} from "@/lib/constructor/qr-card-geometry";
import {
  CONSTRUCTOR_LIMITS,
  DEFAULT_LITHOPHANE_PARAMS,
  DEFAULT_SIGN_PARAMS,
  DEFAULT_VASE_PARAMS,
  boxStlFileName,
  coasterStlFileName,
  hasDrawableSvgData,
  isBoxCells,
  isCoasterPattern,
  isCoasterShape,
  isCustomSvgData,
  isJewelryConfig,
  isKeychainShape,
  isLithophaneBrightness,
  isLithophaneMount,
  isLithophanePart,
  isPenShape,
  isPlanterShape,
  isSignChannelWidth,
  isSignFont,
  isSignPart,
  isVasePattern,
  isVaseShape,
  isValidKeychainText,
  isValidSignText,
  heatTransferStlFileName,
  jewelryStandStlFileName,
  keychainStlFileName,
  keychainThicknessLimits,
  keychainQrCardSpec,
  listSignBlocks,
  lithophaneStlFileName,
  normalizeBoxParams,
  normalizeCoasterParams,
  normalizeHeatTransferParams,
  normalizeJewelryStandParams,
  normalizeKeychainParams,
  normalizeLithophaneParams,
  normalizePenHolderParams,
  normalizePlanterParams,
  normalizeSignParams,
  normalizeStandParams,
  normalizeVaseParams,
  penHolderStlFileName,
  planterStlFileName,
  signStlFileName,
  standStlFileName,
  vaseStlFileName,
  type BoxParams,
  type CoasterParams,
  type HeatTransferParams,
  type JewelryStandParams,
  type KeychainParams,
  type LithophaneParams,
  type LithophanePart,
  type PenHolderParams,
  type PlanterParams,
  type SignParams,
  type SignPart,
  type StandParams,
  type VaseParams,
} from "@/lib/constructor/params";
import { createBoxGeometry } from "@/lib/constructor/box-geometry";
import { createCoasterGeometry } from "@/lib/constructor/coaster-geometry";
import { createHeatTransferGeometry } from "@/lib/constructor/heat-transfer-geometry";
import { createJewelryStandGeometry } from "@/lib/constructor/jewelry-stand-geometry";
import {
  KEYCHAIN_FONT_URL,
  createKeychainGeometry,
} from "@/lib/constructor/keychain-geometry";
import { createLithophaneGeometry } from "@/lib/constructor/lithophane-geometry";
import { createPenHolderGeometry } from "@/lib/constructor/pen-holder-geometry";
import { createPlanterGeometry } from "@/lib/constructor/planter-geometry";
import { createStandGeometry } from "@/lib/constructor/phone-stand-geometry";
import {
  SIGN_FONT_URLS,
  createSignBlockGeometry,
} from "@/lib/constructor/sign-geometry";
import { createVaseGeometry } from "@/lib/constructor/vase-geometry";
import { createVaseProfile } from "@/lib/constructor/vase-profile";
import { parseSvgOutline } from "@/lib/constructor/svg-outline";
import { hasActiveSubscription } from "@/lib/subscription";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Серверный экспорт параметрической модели в бинарный STL.
 *
 * Проверки идут строго по порядку, как у скачивания профилей:
 *   1. сессия — getUser(), потому что /api/* не покрыт middleware;
 *   2. доступ — Pro проходит сразу, Free получает три скачивания в
 *      календарный месяц по UTC (countConstructorDownloadsThisMonth);
 *   3. параметры — только числа внутри границ слайдеров, известная форма и
 *      узор вазы, брелок с именем и формой заготовки, вывеска с надписью,
 *      глубиной, каналом, зазором, размером блока и деталью блока, коробка с
 *      сеткой и крышкой, литофан с размерами, толщинами и сжатым массивом
 *      яркости 400 × 400, подставка под телефон с наклоном, толщиной телефона и
 *      шириной, кашпо с формой, дренажом и стенкой, подставка под кружку с
 *      формой, узором и бортиком, стойка для украшений с набором держателей,
 *      органайзер для ручек с формой, стенкой и отделениями, логотип, габарит,
 *      слои и зеркало термопринта.
 *
 * Гость получает 401, исчерпанный бесплатный лимит — 403, недоступная
 * проверка лимита — 503, испорченное тело — 422. Запись о бесплатном
 * скачивании появляется только после успешной сборки STL и пишется
 * service-role клиентом: RLS не даёт браузеру подделать счётчик.
 */

/** three.js и STLExporter работают в Node.js, Edge для них не нужен. */
export const runtime = "nodejs";

/** Ответ зависит от cookies пользователя, кэшировать его нельзя. */
export const dynamic = "force-dynamic";

/** Ошибка в JSON: клиент показывает message, статус остаётся машинным. */
function errorResponse(
  status: number,
  error: string,
  message: string,
): Response {
  return Response.json(
    { error, message },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

/** Тело запроса должно быть JSON-объектом, а не массивом или числом. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Конечное число в границах параметра. */
function isNumberInRange(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

/**
 * Строгая проверка тела запроса.
 *
 * normalizeVaseParams() умеет дополнять и обрезать значения, но для API этого
 * мало: молча подменять height=100000 на максимум нельзя. Поэтому сначала
 * отклоняем отсутствующие размеры, NaN/Infinity, чужие формы и узоры, выход за
 * границы, и только потом выравниваем валидные числа по шагу слайдеров.
 *
 * Поля узора необязательны: старые клиенты без них получают гладкую стенку с
 * амплитудой 0. Если же поле передано, оно проверяется так же строго, как
 * размеры, — иначе экспорт молча подменил бы узор. Цоколь, обод, грани, закрутка
 * и каннелюры устроены так же: ноль по умолчанию, потому что это ровно прежняя
 * форма (круг у плавных силуэтов, 4 и 8 у квадрата и восьмигранника, без
 * закрутки и без жёлобов).
 */
function parseVaseParams(body: unknown): VaseParams | null {
  if (!isRecord(body)) {
    return null;
  }

  const {
    height,
    diameter,
    wall,
    shape,
    pattern = DEFAULT_VASE_PARAMS.pattern,
    patternIntensity = DEFAULT_VASE_PARAMS.patternIntensity,
    patternFrequency = DEFAULT_VASE_PARAMS.patternFrequency,
    footMm = DEFAULT_VASE_PARAMS.footMm,
    rimMm = DEFAULT_VASE_PARAMS.rimMm,
    sectionSides = DEFAULT_VASE_PARAMS.sectionSides,
    twistDeg = DEFAULT_VASE_PARAMS.twistDeg,
    flutes = DEFAULT_VASE_PARAMS.flutes,
    fluteDepthMm = DEFAULT_VASE_PARAMS.fluteDepthMm,
  } = body;

  if (
    !isNumberInRange(
      height,
      CONSTRUCTOR_LIMITS.height.min,
      CONSTRUCTOR_LIMITS.height.max,
    ) ||
    !isNumberInRange(
      diameter,
      CONSTRUCTOR_LIMITS.diameter.min,
      CONSTRUCTOR_LIMITS.diameter.max,
    ) ||
    !isNumberInRange(
      wall,
      CONSTRUCTOR_LIMITS.wall.min,
      CONSTRUCTOR_LIMITS.wall.max,
    ) ||
    !isVaseShape(shape) ||
    !isVasePattern(pattern) ||
    !isNumberInRange(
      patternIntensity,
      CONSTRUCTOR_LIMITS.patternIntensity.min,
      CONSTRUCTOR_LIMITS.patternIntensity.max,
    ) ||
    !isNumberInRange(
      patternFrequency,
      CONSTRUCTOR_LIMITS.patternFrequency.min,
      CONSTRUCTOR_LIMITS.patternFrequency.max,
    ) ||
    !isNumberInRange(
      footMm,
      CONSTRUCTOR_LIMITS.footMm.min,
      CONSTRUCTOR_LIMITS.footMm.max,
    ) ||
    !isNumberInRange(
      rimMm,
      CONSTRUCTOR_LIMITS.rimMm.min,
      CONSTRUCTOR_LIMITS.rimMm.max,
    ) ||
    !isNumberInRange(
      sectionSides,
      CONSTRUCTOR_LIMITS.sectionSides.min,
      CONSTRUCTOR_LIMITS.sectionSides.max,
    ) ||
    !isNumberInRange(
      twistDeg,
      CONSTRUCTOR_LIMITS.twistDeg.min,
      CONSTRUCTOR_LIMITS.twistDeg.max,
    ) ||
    !isNumberInRange(
      flutes,
      CONSTRUCTOR_LIMITS.flutes.min,
      CONSTRUCTOR_LIMITS.flutes.max,
    ) ||
    !isNumberInRange(
      fluteDepthMm,
      CONSTRUCTOR_LIMITS.fluteDepthMm.min,
      CONSTRUCTOR_LIMITS.fluteDepthMm.max,
    )
  ) {
    return null;
  }

  return normalizeVaseParams({
    height,
    diameter,
    wall,
    shape,
    pattern,
    patternIntensity,
    patternFrequency,
    footMm,
    rimMm,
    sectionSides,
    twistDeg,
    flutes,
    fluteDepthMm,
  });
}

/**
 * Строгая проверка параметров брелока.
 *
 * Все размеры обязательны и должны лежать в границах слайдеров. Текст — не
 * длиннее 10 символов из набора шрифта; пустая строка допустима. Форма задаётся
 * либо пресетом из реестра, либо своим контуром: пресет главнее, при нём контур
 * не проверяется вовсе. Четырнадцати встроенных силуэтов больше нет, поэтому
 * `dog_tag`, `hexagon`, `cat` и остальные прежние значения отклоняются — это
 * ошибка ввода, а не повод собрать брелок по чужой форме. Пользовательский SVG
 * обязан быть строкой в пределах 200 КБ, без скриптов и хотя бы с одним контуром:
 * пустой `custom` дал бы файл-заглушку вместо выбранной формы. NFC-флаг — только
 * boolean, иначе строка «false» включала бы карман.
 *
 * У QR-визитки ширина и длина не проверяются: оба её размера (60 × 40 и 70 × 45)
 * выводятся из `qrCardSize` и выше границы слайдера ширины. Вместо них строго
 * проверяются размер, крепление, рельеф и тип содержимого, а толщина — в границах
 * пресета. Смысл самого содержимого (ссылка, телефон, почта, визитка) проверяет
 * `qrCardPlan` уже после нормализации: у него те же правила, что и в панели.
 */
function parseKeychainParams(
  body: Record<string, unknown>,
): KeychainParams | null {
  const {
    length,
    width,
    thickness,
    text,
    keychainShape,
    shapeType,
    keychainPreset,
    customSvgData = "",
    nfcEnabled = false,
    holePlacement = null,
    qrCardSize = null,
    qrCardTab = null,
    qrMode = null,
    qrContentType = null,
    qrContent = "",
    qrName = "",
    qrPhone = "",
  } = body;
  const preset = isKeychainPresetId(keychainPreset) ? keychainPreset : null;
  // Неизвестный идентификатор — ошибка ввода, а не «пресета нет»: иначе запрос
  // с опечаткой молча собрал бы брелок по своему контуру.
  const presetInvalid =
    keychainPreset !== null &&
    keychainPreset !== undefined &&
    preset === null;
  // `shapeType` — прежнее имя того же поля, поэтому принимается вторым. Всё,
  // что не `custom`, — удалённый силуэт или `rounded`: такая форма в проекте
  // больше не существует, и запрос отклоняется.
  const shape = preset
    ? null
    : isKeychainShape(keychainShape)
      ? keychainShape
      : isKeychainShape(shapeType)
        ? shapeType
        : null;
  const isQrCard = preset === "qr-card";
  // Толщина визитки живёт в своих границах: 2.5–3.5 мм вместо общих 2–5.
  const thicknessLimits = keychainThicknessLimits(preset);
  // Габарит визитки выводится из размера кода, поэтому в запросе он не сверяется
  // с границами слайдера ширины: 60 и 70 мм в них не помещаются по определению.
  const sizeInvalid =
    !isQrCard &&
    (!isNumberInRange(
      length,
      CONSTRUCTOR_LIMITS.length.min,
      CONSTRUCTOR_LIMITS.length.max,
    ) ||
      !isNumberInRange(
        width,
        CONSTRUCTOR_LIMITS.width.min,
        CONSTRUCTOR_LIMITS.width.max,
      ));
  const qrInvalid =
    isQrCard &&
    (!isQrCardSize(qrCardSize) ||
      !isQrCardTab(qrCardTab) ||
      !isQrMode(qrMode) ||
      !isQrContentType(qrContentType) ||
      typeof qrContent !== "string" ||
      typeof qrName !== "string" ||
      typeof qrPhone !== "string");

  if (
    sizeInvalid ||
    !isNumberInRange(thickness, thicknessLimits.min, thicknessLimits.max) ||
    !isValidKeychainText(text) ||
    presetInvalid ||
    (!preset && !shape) ||
    !isCustomSvgData(customSvgData) ||
    typeof nfcEnabled !== "boolean" ||
    (holePlacement !== null &&
      holePlacement !== undefined &&
      !isHolePlacement(holePlacement)) ||
    (shape === "custom" && !hasDrawableSvgData(customSvgData)) ||
    qrInvalid
  ) {
    return null;
  }

  return normalizeKeychainParams({
    length: isNumberInRange(
      length,
      CONSTRUCTOR_LIMITS.length.min,
      CONSTRUCTOR_LIMITS.length.max,
    )
      ? length
      : undefined,
    width: isNumberInRange(
      width,
      CONSTRUCTOR_LIMITS.width.min,
      CONSTRUCTOR_LIMITS.width.max,
    )
      ? width
      : undefined,
    thickness: isNumberInRange(
      thickness,
      thicknessLimits.min,
      thicknessLimits.max,
    )
      ? thickness
      : undefined,
    text,
    keychainShape: shape,
    shapeType: shape,
    keychainPreset: preset,
    customSvgData,
    nfcEnabled,
    holePlacement: isHolePlacement(holePlacement) ? holePlacement : undefined,
    qrCardSize: isQrCardSize(qrCardSize) ? qrCardSize : undefined,
    qrCardTab: isQrCardTab(qrCardTab) ? qrCardTab : undefined,
    qrMode: isQrMode(qrMode) ? qrMode : undefined,
    qrContentType: isQrContentType(qrContentType) ? qrContentType : undefined,
    qrContent: typeof qrContent === "string" ? qrContent : undefined,
    qrName: typeof qrName === "string" ? qrName : undefined,
    qrPhone: typeof qrPhone === "string" ? qrPhone : undefined,
  });
}

/**
 * Строгая проверка параметров подставки под телефон.
 *
 * Наклон, толщина телефона и ширина подставки должны лежать в границах
 * слайдеров: от них зависят глубина жёлоба и высота спинки, поэтому выход за
 * границы отклоняется, а не подрезается к ближайшему шагу. Деталь цельная, без
 * выбранной части — в файл всегда попадает вся подставка.
 */
function parseStandParams(body: Record<string, unknown>): StandParams | null {
  const { standAngle, phoneThickness, standWidth } = body;

  if (
    !isNumberInRange(
      standAngle,
      CONSTRUCTOR_LIMITS.standAngle.min,
      CONSTRUCTOR_LIMITS.standAngle.max,
    ) ||
    !isNumberInRange(
      phoneThickness,
      CONSTRUCTOR_LIMITS.phoneThickness.min,
      CONSTRUCTOR_LIMITS.phoneThickness.max,
    ) ||
    !isNumberInRange(
      standWidth,
      CONSTRUCTOR_LIMITS.standWidth.min,
      CONSTRUCTOR_LIMITS.standWidth.max,
    )
  ) {
    return null;
  }

  return normalizeStandParams({ standAngle, phoneThickness, standWidth });
}

/**
 * Строгая проверка параметров вывески.
 *
 * Надпись — до 15 символов из набора шрифта, но не пустая: из пустой строки не
 * собрать ни одного блока. Шрифт выбирается из списка: имя файла подставляется
 * только из SIGN_FONT_URLS, поэтому тело запроса не может прочитать
 * произвольный путь с диска. Кегль, глубина, зазор и размер блока проверяются
 * по границам, ширина канала — по списку: ленты другой ширины не бывает.
 * Геометрия сама уменьшит буквы, если строка не влезает в 800 мм.
 *
 * `blockIndex` и `signPart` обязательны: каждая деталь печатается отдельным
 * файлом — лицо блока или его крышка. Номер блока считается по listSignBlocks,
 * то есть по тем же правилам, что и в интерфейсе; номер вне списка и незнакомая
 * деталь отклоняются, иначе клиент получил бы пустой STL вместо ошибки.
 */
function parseSignParams(
  body: Record<string, unknown>,
): { params: SignParams; block: number; part: SignPart } | null {
  const {
    signText,
    signFont = DEFAULT_SIGN_PARAMS.signFont,
    signFontSize,
    signDepth,
    signChannelWidth,
    signLetterGap = DEFAULT_SIGN_PARAMS.signLetterGap,
    signBlockSize = DEFAULT_SIGN_PARAMS.signBlockSize,
    signBaseMount = DEFAULT_SIGN_PARAMS.signBaseMount,
    blockIndex,
    signPart,
  } = body;

  if (
    !isValidSignText(signText) ||
    !isSignFont(signFont) ||
    !isNumberInRange(
      signFontSize,
      CONSTRUCTOR_LIMITS.signFontSize.min,
      CONSTRUCTOR_LIMITS.signFontSize.max,
    ) ||
    !isNumberInRange(
      signDepth,
      CONSTRUCTOR_LIMITS.signDepth.min,
      CONSTRUCTOR_LIMITS.signDepth.max,
    ) ||
    !isSignChannelWidth(signChannelWidth) ||
    !isNumberInRange(
      signLetterGap,
      CONSTRUCTOR_LIMITS.signLetterGap.min,
      CONSTRUCTOR_LIMITS.signLetterGap.max,
    ) ||
    !isNumberInRange(
      signBlockSize,
      CONSTRUCTOR_LIMITS.signBlockSize.min,
      CONSTRUCTOR_LIMITS.signBlockSize.max,
    ) ||
    !Number.isInteger(signBlockSize) ||
    typeof signBaseMount !== "boolean" ||
    typeof blockIndex !== "number" ||
    !Number.isInteger(blockIndex) ||
    !isSignPart(signPart)
  ) {
    return null;
  }

  const params = normalizeSignParams({
    signText,
    signFont,
    signFontSize,
    signDepth,
    signChannelWidth,
    signLetterGap,
    signBlockSize,
    signBaseMount,
  });
  const blocks = listSignBlocks(params.signText, params.signBlockSize);

  if (blocks.length === 0 || blockIndex < 0 || blockIndex >= blocks.length) {
    return null;
  }

  return { params, block: blockIndex, part: signPart };
}

/**
 * Строгая проверка параметров коробки.
 *
 * Размеры проверяются в своих границах, крышка — только настоящим boolean.
 * Сетка принимается двумя способами: новые массивы `cellsX`/`cellsY` с
 * ширинами ячеек 5–220 мм или старые целые `gridX`/`gridY` от 1 до 8.
 * Если массивы переданы, они главнее старых полей и проверяются поэлементно:
 * клиент отправляет оба набора сразу, но геометрия строится по ячейкам.
 */
function parseBoxParams(body: Record<string, unknown>): BoxParams | null {
  const {
    boxLength,
    boxWidth,
    boxHeight,
    boxWall,
    gridX,
    gridY,
    cellsX,
    cellsY,
    hasLid,
  } = body;
  const hasCells = cellsX !== undefined || cellsY !== undefined;
  const cellsAreValid = isBoxCells(cellsX) && isBoxCells(cellsY);
  const gridsAreValid =
    isNumberInRange(
      gridX,
      CONSTRUCTOR_LIMITS.boxGrid.min,
      CONSTRUCTOR_LIMITS.boxGrid.max,
    ) &&
    isNumberInRange(
      gridY,
      CONSTRUCTOR_LIMITS.boxGrid.min,
      CONSTRUCTOR_LIMITS.boxGrid.max,
    ) &&
    Number.isInteger(gridX) &&
    Number.isInteger(gridY);

  if (
    !isNumberInRange(
      boxLength,
      CONSTRUCTOR_LIMITS.boxLength.min,
      CONSTRUCTOR_LIMITS.boxLength.max,
    ) ||
    !isNumberInRange(
      boxWidth,
      CONSTRUCTOR_LIMITS.boxWidth.min,
      CONSTRUCTOR_LIMITS.boxWidth.max,
    ) ||
    !isNumberInRange(
      boxHeight,
      CONSTRUCTOR_LIMITS.boxHeight.min,
      CONSTRUCTOR_LIMITS.boxHeight.max,
    ) ||
    !isNumberInRange(
      boxWall,
      CONSTRUCTOR_LIMITS.boxWall.min,
      CONSTRUCTOR_LIMITS.boxWall.max,
    ) ||
    typeof hasLid !== "boolean" ||
    (hasCells ? !cellsAreValid : !gridsAreValid)
  ) {
    return null;
  }

  return normalizeBoxParams({
    boxLength,
    boxWidth,
    boxHeight,
    boxWall,
    hasLid,
    ...(cellsAreValid
      ? { cellsX: cellsX as number[], cellsY: cellsY as number[] }
      : { gridX: gridX as number, gridY: gridY as number }),
  });
}

/**
 * Строгая проверка параметров литофана.
 *
 * Размеры и толщины должны лежать в границах слайдеров, причём максимум
 * обязан быть больше минимума до выравнивания по шагу: иначе рельеф стал бы
 * плоским. Массив яркости принимается только целыми числами 0–255 и обязан
 * быть квадратной сеткой со стороной от 2 до LITHOPHANE_MAX_RESOLUTION:
 * браузер присылает 400 × 400, а старый клиент мог прислать 150 × 150.
 * Строка base64 здесь не поддерживается: браузер уже
 * присылает готовую сетку, и серверу не нужно декодировать изображение.
 *
 * Рамка и крепление необязательны: старый клиент их не присылает и получает
 * значения по умолчанию. Крепление проверяется по списку — от него зависит,
 * появятся ли петли на рамке, — а нормализация сама снимает крепление, когда
 * рамка выключена. Деталь (`part`) тоже из списка, причём `frame`, `stand` и
 * `all` без рамки отклоняются: без неё в файле нечего собирать. Подставка
 * отдельным файлом имеет смысл только при своём креплении — иначе клиент просит
 * деталь, которой нет в выбранной сборке.
 */
function parseLithophaneParams(
  body: Record<string, unknown>,
): { params: LithophaneParams; part: LithophanePart } | null {
  const {
    lithophaneWidth,
    lithophaneHeight,
    lithophaneMinThickness,
    lithophaneMaxThickness,
    lithophaneBrightness,
    lithoFrame = DEFAULT_LITHOPHANE_PARAMS.lithoFrame,
    lithoMount = DEFAULT_LITHOPHANE_PARAMS.lithoMount,
    part = "all",
  } = body;

  if (
    !isNumberInRange(
      lithophaneWidth,
      CONSTRUCTOR_LIMITS.lithophaneWidth.min,
      CONSTRUCTOR_LIMITS.lithophaneWidth.max,
    ) ||
    !isNumberInRange(
      lithophaneHeight,
      CONSTRUCTOR_LIMITS.lithophaneHeight.min,
      CONSTRUCTOR_LIMITS.lithophaneHeight.max,
    ) ||
    !isNumberInRange(
      lithophaneMinThickness,
      CONSTRUCTOR_LIMITS.lithophaneMinThickness.min,
      CONSTRUCTOR_LIMITS.lithophaneMinThickness.max,
    ) ||
    !isNumberInRange(
      lithophaneMaxThickness,
      CONSTRUCTOR_LIMITS.lithophaneMaxThickness.min,
      CONSTRUCTOR_LIMITS.lithophaneMaxThickness.max,
    ) ||
    lithophaneMaxThickness <= lithophaneMinThickness ||
    !isLithophaneBrightness(lithophaneBrightness) ||
    typeof lithoFrame !== "boolean" ||
    !isLithophaneMount(lithoMount) ||
    !isLithophanePart(part) ||
    (!lithoFrame && part !== "relief") ||
    (part === "stand" && lithoMount !== "stand")
  ) {
    return null;
  }

  return {
    params: normalizeLithophaneParams({
      lithophaneWidth,
      lithophaneHeight,
      lithophaneMinThickness,
      lithophaneMaxThickness,
      lithophaneBrightness,
      lithoFrame,
      lithoMount,
    }),
    part,
  };
}

/**
 * Строгая проверка параметров кашпо.
 *
 * Габарит «под ключ», высота и стенка проверяются в границах слайдеров, форма —
 * по списку трёх силуэтов, дренаж — только настоящим boolean: строка «false»
 * иначе включила бы отверстия и второй поддон в файле.
 */
function parsePlanterParams(
  body: Record<string, unknown>,
): PlanterParams | null {
  const {
    planterSize,
    planterHeight,
    planterWall,
    planterShape,
    planterDrainage,
  } = body;

  if (
    !isNumberInRange(
      planterSize,
      CONSTRUCTOR_LIMITS.planterSize.min,
      CONSTRUCTOR_LIMITS.planterSize.max,
    ) ||
    !isNumberInRange(
      planterHeight,
      CONSTRUCTOR_LIMITS.planterHeight.min,
      CONSTRUCTOR_LIMITS.planterHeight.max,
    ) ||
    !isNumberInRange(
      planterWall,
      CONSTRUCTOR_LIMITS.planterWall.min,
      CONSTRUCTOR_LIMITS.planterWall.max,
    ) ||
    !isPlanterShape(planterShape) ||
    typeof planterDrainage !== "boolean"
  ) {
    return null;
  }

  return normalizePlanterParams({
    planterSize,
    planterHeight,
    planterWall,
    planterShape,
    planterDrainage,
  });
}

/**
 * Строгая проверка параметров подставки под кружку.
 *
 * Форма и узор выбираются из списков: от них зависит и сечение плиты, и
 * геометрия рельефа. Бортик — только boolean, иначе он появился бы в файле
 * против выбора пользователя.
 */
function parseCoasterParams(
  body: Record<string, unknown>,
): CoasterParams | null {
  const {
    coasterSize,
    coasterThickness,
    coasterShape,
    coasterPattern,
    coasterRim,
  } = body;

  if (
    !isNumberInRange(
      coasterSize,
      CONSTRUCTOR_LIMITS.coasterSize.min,
      CONSTRUCTOR_LIMITS.coasterSize.max,
    ) ||
    !isNumberInRange(
      coasterThickness,
      CONSTRUCTOR_LIMITS.coasterThickness.min,
      CONSTRUCTOR_LIMITS.coasterThickness.max,
    ) ||
    !isCoasterShape(coasterShape) ||
    !isCoasterPattern(coasterPattern) ||
    typeof coasterRim !== "boolean"
  ) {
    return null;
  }

  return normalizeCoasterParams({
    coasterSize,
    coasterThickness,
    coasterShape,
    coasterPattern,
    coasterRim,
  });
}

/**
 * Строгая проверка параметров подставки для украшений.
 *
 * Высота стойки и диаметр основания проверяются в границах, набор держателей —
 * по списку: от него зависит, появятся ли в файле штанга и рожки.
 */
function parseJewelryStandParams(
  body: Record<string, unknown>,
): JewelryStandParams | null {
  const { jewelryHeight, jewelryBase, jewelryConfig } = body;

  if (
    !isNumberInRange(
      jewelryHeight,
      CONSTRUCTOR_LIMITS.jewelryHeight.min,
      CONSTRUCTOR_LIMITS.jewelryHeight.max,
    ) ||
    !isNumberInRange(
      jewelryBase,
      CONSTRUCTOR_LIMITS.jewelryBase.min,
      CONSTRUCTOR_LIMITS.jewelryBase.max,
    ) ||
    !isJewelryConfig(jewelryConfig)
  ) {
    return null;
  }

  return normalizeJewelryStandParams({
    jewelryHeight,
    jewelryBase,
    jewelryConfig,
  });
}

/**
 * Строгая проверка параметров органайзера для ручек.
 *
 * Габарит, высота и стенка проверяются в границах слайдеров, форма — по списку
 * трёх силуэтов, число отделений — целое: половина перегородки не печатается,
 * а дробное значение сдвинуло бы хорду, по которой она подрезана.
 */
function parsePenHolderParams(
  body: Record<string, unknown>,
): PenHolderParams | null {
  const { penSize, penHeight, penWall, penShape, penSections } = body;

  if (
    !isNumberInRange(
      penSize,
      CONSTRUCTOR_LIMITS.penSize.min,
      CONSTRUCTOR_LIMITS.penSize.max,
    ) ||
    !isNumberInRange(
      penHeight,
      CONSTRUCTOR_LIMITS.penHeight.min,
      CONSTRUCTOR_LIMITS.penHeight.max,
    ) ||
    !isNumberInRange(
      penWall,
      CONSTRUCTOR_LIMITS.penWall.min,
      CONSTRUCTOR_LIMITS.penWall.max,
    ) ||
    !isPenShape(penShape) ||
    !isNumberInRange(
      penSections,
      CONSTRUCTOR_LIMITS.penSections.min,
      CONSTRUCTOR_LIMITS.penSections.max,
    ) ||
    !Number.isInteger(penSections)
  ) {
    return null;
  }

  return normalizePenHolderParams({
    penSize,
    penHeight,
    penWall,
    penShape,
    penSections,
  });
}

/**
 * Строгая проверка параметров термопринта.
 *
 * Разметка обязательна: контур — единственный источник формы, и пустая строка
 * дала бы файл-заглушку вместо логотипа. Принимается только целая безопасная
 * SVG-строка с хотя бы одним контуром: обрезанная или со скриптом она не
 * разберётся, а подставлять чужой силуэт нельзя.
 *
 * Габарит проверяется в границах слайдеров, слои — целое число от 1 до 4,
 * зеркало — только boolean: строка «true» иначе перевернула бы принт против
 * выбора пользователя.
 */
function parseHeatTransferParams(
  body: Record<string, unknown>,
): HeatTransferParams | null {
  const {
    heatTransferSvg,
    heatTransferWidth,
    heatTransferHeight,
    heatTransferLayers,
    heatTransferMirror,
  } = body;

  if (
    !isCustomSvgData(heatTransferSvg) ||
    !hasDrawableSvgData(heatTransferSvg) ||
    !isNumberInRange(
      heatTransferWidth,
      CONSTRUCTOR_LIMITS.heatTransferWidth.min,
      CONSTRUCTOR_LIMITS.heatTransferWidth.max,
    ) ||
    !isNumberInRange(
      heatTransferHeight,
      CONSTRUCTOR_LIMITS.heatTransferHeight.min,
      CONSTRUCTOR_LIMITS.heatTransferHeight.max,
    ) ||
    !isNumberInRange(
      heatTransferLayers,
      CONSTRUCTOR_LIMITS.heatTransferLayers.min,
      CONSTRUCTOR_LIMITS.heatTransferLayers.max,
    ) ||
    !Number.isInteger(heatTransferLayers) ||
    typeof heatTransferMirror !== "boolean"
  ) {
    return null;
  }

  return normalizeHeatTransferParams({
    heatTransferSvg,
    heatTransferWidth,
    heatTransferHeight,
    heatTransferLayers,
    heatTransferMirror,
  });
}

/** Разобранный запрос: модель и её проверенные параметры. */
type ParsedConstructorRequest =
  | { model: "vase"; params: VaseParams }
  | { model: "keychain"; params: KeychainParams }
  | { model: "sign"; params: SignParams; block: number; part: SignPart }
  | { model: "box"; params: BoxParams }
  | { model: "lithophane"; params: LithophaneParams; part: LithophanePart }
  | { model: "stand"; params: StandParams }
  | { model: "planter"; params: PlanterParams }
  | { model: "coaster"; params: CoasterParams }
  | { model: "jewelry_stand"; params: JewelryStandParams }
  | { model: "pen_holder"; params: PenHolderParams }
  | { model: "heat_transfer"; params: HeatTransferParams };

/**
 * Выбирает набор параметров по полю model.
 *
 * Старые клиенты его не передают и получают вазу — так экспорт продолжает
 * работать после появления новых моделей. Незнакомая модель отклоняется
 * целиком, а не подменяется вазой: иначе клиент получил бы не тот файл.
 */
function parseConstructorRequest(
  body: unknown,
): ParsedConstructorRequest | null {
  if (!isRecord(body)) {
    return null;
  }

  const { model = "vase" } = body;

  if (model === "vase") {
    const params = parseVaseParams(body);

    return params ? { model: "vase", params } : null;
  }

  if (model === "keychain") {
    const params = parseKeychainParams(body);

    return params ? { model: "keychain", params } : null;
  }

  if (model === "sign") {
    const sign = parseSignParams(body);

    return sign ? { model: "sign", ...sign } : null;
  }

  if (model === "box") {
    const params = parseBoxParams(body);

    return params ? { model: "box", params } : null;
  }

  if (model === "lithophane") {
    const lithophane = parseLithophaneParams(body);

    return lithophane ? { model: "lithophane", ...lithophane } : null;
  }

  if (model === "stand") {
    const params = parseStandParams(body);

    return params ? { model: "stand", params } : null;
  }

  if (model === "planter") {
    const params = parsePlanterParams(body);

    return params ? { model: "planter", params } : null;
  }

  if (model === "coaster") {
    const params = parseCoasterParams(body);

    return params ? { model: "coaster", params } : null;
  }

  if (model === "jewelry_stand") {
    const params = parseJewelryStandParams(body);

    return params ? { model: "jewelry_stand", params } : null;
  }

  if (model === "pen_holder") {
    const params = parsePenHolderParams(body);

    return params ? { model: "pen_holder", params } : null;
  }

  if (model === "heat_transfer") {
    const params = parseHeatTransferParams(body);

    return params ? { model: "heat_transfer", params } : null;
  }

  return null;
}

/**
 * Шрифты читаются с диска один раз на процесс.
 *
 * Ключ кэша — путь к JSON: у вывески три шрифта, и переключение между ними не
 * должно парсить файл заново. Промис кэшируется, поэтому одновременные
 * запросы не парсят 130 КБ JSON каждый раз. При ошибке запись сбрасывается:
 * следующий запрос попробует снова.
 */
const fontPromises = new Map<string, Promise<Font>>();

function loadFont(url: string): Promise<Font> {
  let promise = fontPromises.get(url);

  if (!promise) {
    const file = path.join(process.cwd(), "public", url.replace(/^\/+/, ""));

    promise = readFile(file, "utf8")
      .then((json) => new FontLoader().parse(JSON.parse(json) as FontData))
      .catch((error: unknown) => {
        fontPromises.delete(url);
        throw error;
      });
    fontPromises.set(url, promise);
  }

  return promise;
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      401,
      "unauthorized",
      "Войдите в аккаунт, чтобы скачать STL.",
    );
  }

  const isPro = await hasActiveSubscription(supabase, user.id);

  if (!isPro) {
    const usage = await countConstructorDownloadsThisMonth(
      supabase,
      user.id,
    );

    if (usage.count === null) {
      console.error(
        "Не удалось проверить лимит бесплатных скачиваний:",
        usage.error,
      );

      return errorResponse(
        503,
        "limit_unavailable",
        "Не удалось проверить лимит бесплатных скачиваний. Попробуйте ещё раз.",
      );
    }

    if (usage.count >= FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH) {
      return errorResponse(
        403,
        "free_limit_reached",
        "Лимит бесплатных скачиваний (3 в месяц) исчерпан. Безлимитный экспорт входит в пакет «Всё включено».",
      );
    }
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      422,
      "invalid_params",
      "Не удалось прочитать параметры модели.",
    );
  }

  const parsed = parseConstructorRequest(body);

  if (!parsed) {
    return errorResponse(
      422,
      "invalid_params",
      "Проверьте размеры и узор вазы, силуэт и SVG брелока, NFC-флаг, надпись вывески (нужна хотя бы одна буква), номер блока и его деталь, ячейки коробки, изображение литофана, наклон и ширину подставки, габарит кашпо, форму и узор подставки под кружку, высоту стойки для украшений, форму и отделения органайзера для ручек, логотип, габарит, слои и зеркало термопринта.",
    );
  }

  // Пресет без геометрии не должен уходить в печать правдоподобной заглушкой:
  // панель гасит кнопку, но запрос может прийти и напрямую.
  if (
    parsed.model === "keychain" &&
    parsed.params.keychainPreset &&
    !isKeychainPresetImplemented(parsed.params.keychainPreset)
  ) {
    return errorResponse(
      422,
      "preset_not_implemented",
      "Этот пресет ещё не реализован. Выберите готовый пресет или загрузите свой контур.",
    );
  }

  // Позиция отверстия проверяется по реестру пресета: у Starburst боковой стенки
  // нет, у Brick её ломает шип, а у QR-визитки крепление своё. Запрос мимо набора
  // отклоняется, а не подрезается к центру: иначе пользователь получил бы файл с
  // отверстием не там, где просил, и без единого слова об этом.
  const requestedPlacement = isRecord(body) ? body.holePlacement : undefined;

  if (
    parsed.model === "keychain" &&
    parsed.params.keychainPreset &&
    isHolePlacement(requestedPlacement)
  ) {
    const preset = keychainPresetById(parsed.params.keychainPreset);

    if (
      preset.holePlacements.length > 0 &&
      !preset.holePlacements.includes(requestedPlacement)
    ) {
      const available = preset.holePlacements
        .map((placement) => `«${HOLE_PLACEMENT_LABELS[placement]}»`)
        .join(", ");

      return errorResponse(
        422,
        "hole_placement_unavailable",
        `Позиция отверстия «${HOLE_PLACEMENT_LABELS[requestedPlacement]}» недоступна для пресета ${preset.label}. Доступно: ${available}.`,
      );
    }
  }

  // Содержимое QR-визитки проверяется здесь, а не в parseKeychainParams: текст
  // отказа зависит от матрицы кода, и тот же текст показывается в панели. Так 422
  // объясняет причину — «укоротите ссылку» или «в визитку входят только имя и
  // телефон», — вместо общего «проверьте параметры».
  if (parsed.model === "keychain" && parsed.params.keychainPreset === "qr-card") {
    const qrPlan = qrCardPlan(keychainQrCardSpec(parsed.params));

    if (qrPlan.contentError) {
      return errorResponse(422, "qr_content_invalid", qrPlan.contentError);
    }

    if (qrPlan.layout.blockedReason) {
      return errorResponse(422, "qr_too_dense", qrPlan.layout.blockedReason);
    }
  }

  // Карман под NFC-метку у пресета: глубина и толщина проверяются той же
  // `nfcLayout`, что и в панели. Флаг на тонкой основе иначе ушёл бы в печать
  // моделью без полости — а панель в этом случае гасит кнопку.
  if (
    parsed.model === "keychain" &&
    parsed.params.keychainPreset &&
    parsed.params.nfcEnabled
  ) {
    const nfc = nfcLayout(parsed.params.keychainPreset, {
      width: parsed.params.width,
      height: parsed.params.length,
      thickness: parsed.params.thickness,
      nfcEnabled: parsed.params.nfcEnabled,
      // Та же позиция, что уйдёт в геометрию: пересечение с полостью считается по
      // фактическим центрам, а не по «обычно по центру».
      holePlacement: parsed.params.holePlacement,
      qr:
        parsed.params.keychainPreset === "qr-card"
          ? keychainQrCardSpec(parsed.params)
          : null,
    });

    if (nfc.blockedReason) {
      return errorResponse(422, "nfc_pocket_unavailable", nfc.blockedReason);
    }
  }

  // Контур — единственный источник формы термопринта: разметка без замкнутых
  // путей дала бы пустой файл, а не принт. Проверка идёт до сборки, чтобы
  // пользователь получил 422 с причиной, а бесплатное скачивание не списалось.
  if (
    parsed.model === "heat_transfer" &&
    parseSvgOutline(parsed.params.heatTransferSvg).length === 0
  ) {
    return errorResponse(
      422,
      "contour_invalid",
      "Из логотипа не получилось контуров. Загрузите PNG с прозрачным фоном или SVG с замкнутыми путями.",
    );
  }

  try {
    // Шрифт читается брелоку и вывеске; остальные модели собираются без него,
    // чтобы не парсить 130 КБ JSON. loadFont() кэширует промис по пути, поэтому
    // повторный вызов и смена шрифта вывески ничего не стоят.
    const geometry =
      parsed.model === "vase"
        ? // STL собирается с бюджетом 400 000: файл скачивают один раз, а
          // рельеф высокой частоты требует больше сегментов, чем экран.
          createVaseGeometry(createVaseProfile(parsed.params), parsed.params, {
            budget: "export",
          })
        : parsed.model === "box"
          ? createBoxGeometry(parsed.params)
          : parsed.model === "lithophane"
            ? createLithophaneGeometry(parsed.params, parsed.part)
            : parsed.model === "stand"
              ? createStandGeometry(parsed.params)
              : parsed.model === "planter"
                ? createPlanterGeometry(parsed.params)
                : parsed.model === "coaster"
                  ? createCoasterGeometry(parsed.params)
                  : parsed.model === "jewelry_stand"
                    ? createJewelryStandGeometry(parsed.params)
                    : parsed.model === "pen_holder"
                      ? createPenHolderGeometry(parsed.params)
                      : parsed.model === "heat_transfer"
                        ? createHeatTransferGeometry(parsed.params)
                        : parsed.model === "keychain"
                          ? createKeychainGeometry(
                              parsed.params,
                              await loadFont(KEYCHAIN_FONT_URL),
                            )
                          : createSignBlockGeometry(
                              parsed.params,
                              await loadFont(
                                SIGN_FONT_URLS[parsed.params.signFont],
                              ),
                              parsed.block,
                              parsed.part,
                            );

    try {
      const mesh = new Mesh(geometry);
      // Сетка стоит в начале координат; явный вызов защищает от того, что
      // STLExporter возьмёт необновлённую matrixWorld у нового объекта.
      mesh.updateMatrixWorld(true);

      const stl = new STLExporter().parse(mesh, { binary: true });
      const bytes = new Uint8Array(stl.buffer, stl.byteOffset, stl.byteLength);
      const fileName =
        parsed.model === "vase"
          ? vaseStlFileName(parsed.params)
          : parsed.model === "keychain"
            ? keychainStlFileName(parsed.params)
            : parsed.model === "box"
              ? boxStlFileName(parsed.params)
              : parsed.model === "lithophane"
                ? lithophaneStlFileName(parsed.params, parsed.part)
                : parsed.model === "stand"
                  ? standStlFileName(parsed.params)
                  : parsed.model === "planter"
                    ? planterStlFileName(parsed.params)
                    : parsed.model === "coaster"
                      ? coasterStlFileName(parsed.params)
                      : parsed.model === "jewelry_stand"
                        ? jewelryStandStlFileName(parsed.params)
                        : parsed.model === "pen_holder"
                          ? penHolderStlFileName(parsed.params)
                          : parsed.model === "heat_transfer"
                            ? heatTransferStlFileName(parsed.params)
                            : signStlFileName(
                                parsed.params,
                                parsed.block,
                                parsed.part,
                              );

      // Запись появляется после успешной генерации: упавшая сборка не должна
      // списывать бесплатную попытку. Если запись не удалась, файл не отдаём —
      // иначе счётчик можно было бы обойти, отключив таблицу.
      if (!isPro) {
        try {
          const admin = createAdminClient();
          const { error: insertError } = await admin
            .from("constructor_downloads")
            .insert({ user_id: user.id });

          if (insertError) {
            throw insertError;
          }
        } catch (error) {
          console.error(
            "Не удалось записать бесплатное скачивание:",
            error,
          );

          return errorResponse(
            500,
            "download_not_recorded",
            "Не удалось учесть скачивание. Попробуйте ещё раз.",
          );
        }
      }

      // Журнал для ежедневного отчёта: тип модели и время. Это не лимит, а
      // аналитика, поэтому пишем и Free, и Pro, а ошибку записи не превращаем
      // в отказ: файл уже собран и должен уйти пользователю.
      await recordConstructorGeneration(user.id, parsed.model);

      return new Response(bytes, {
        status: 200,
        headers: {
          "content-type": "model/stl",
          "content-disposition": `attachment; filename="${fileName}"`,
          "content-length": String(bytes.byteLength),
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    } finally {
      geometry.dispose();
    }
  } catch (error) {
    console.error("Не удалось собрать STL:", error);

    return errorResponse(
      500,
      "export_failed",
      "Не удалось собрать STL. Попробуйте ещё раз.",
    );
  }
}
