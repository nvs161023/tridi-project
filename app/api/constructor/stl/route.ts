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
  CONSTRUCTOR_LIMITS,
  DEFAULT_LITHOPHANE_PARAMS,
  DEFAULT_SIGN_PARAMS,
  DEFAULT_VASE_PARAMS,
  boxStlFileName,
  cipherBoxStlFileName,
  clipsStlFileName,
  coasterStlFileName,
  cupClipStlFileName,
  hasDrawableSvgData,
  isBoxCells,
  isCipherLidText,
  isCipherWord,
  isCoasterPattern,
  isCoasterShape,
  isCustomSvgData,
  isGiftBoxShape,
  isJewelryConfig,
  isLithophaneBrightness,
  isLithophaneMount,
  isLithophanePart,
  isOrnamentShape,
  isPatchShape,
  isPenShape,
  isPlanterShape,
  isSignChannelWidth,
  isSignFont,
  isSignPart,
  isStencilPattern,
  isVasePattern,
  isVaseShape,
  isValidKeychainText,
  isValidSignText,
  isWallHookMount,
  fabricPatchStlFileName,
  giftBoxStlFileName,
  jewelryStandStlFileName,
  keychainStlFileName,
  listSignBlocks,
  lithophaneStlFileName,
  normalizeBoxParams,
  normalizeCipherBoxParams,
  normalizeClipsParams,
  normalizeCoasterParams,
  normalizeCupClipParams,
  normalizeFabricPatchParams,
  normalizeGiftBoxParams,
  normalizeJewelryStandParams,
  normalizeKeychainParams,
  normalizeKeychainShapeAlias,
  normalizeLithophaneParams,
  normalizeOrnamentParams,
  normalizePenHolderParams,
  normalizePlanterParams,
  normalizeSignParams,
  normalizeStandParams,
  normalizeStencilParams,
  normalizeStringLightParams,
  normalizeVaseParams,
  normalizeWallHookParams,
  ornamentStlFileName,
  penHolderStlFileName,
  planterStlFileName,
  signStlFileName,
  standStlFileName,
  stencilStlFileName,
  stringLightStlFileName,
  vaseStlFileName,
  wallHookStlFileName,
  type BoxParams,
  type CipherBoxParams,
  type ClipsParams,
  type CoasterParams,
  type CupClipParams,
  type FabricPatchParams,
  type GiftBoxParams,
  type JewelryStandParams,
  type KeychainParams,
  type LithophaneParams,
  type LithophanePart,
  type OrnamentParams,
  type PenHolderParams,
  type PlanterParams,
  type SignParams,
  type SignPart,
  type StandParams,
  type StencilParams,
  type StringLightParams,
  type VaseParams,
  type WallHookParams,
} from "@/lib/constructor/params";
import { createBoxGeometry } from "@/lib/constructor/box-geometry";
import { createCipherBoxGeometry } from "@/lib/constructor/cipher-box-geometry";
import { createClipsGeometry } from "@/lib/constructor/cable-clips-geometry";
import { createCoasterGeometry } from "@/lib/constructor/coaster-geometry";
import { createCupClipGeometry } from "@/lib/constructor/cup-clip-geometry";
import { createFabricPatchGeometry } from "@/lib/constructor/fabric-patch-geometry";
import { createGiftBoxGeometry } from "@/lib/constructor/gift-box-geometry";
import { createJewelryStandGeometry } from "@/lib/constructor/jewelry-stand-geometry";
import {
  KEYCHAIN_FONT_URL,
  createKeychainGeometry,
} from "@/lib/constructor/keychain-geometry";
import { createLithophaneGeometry } from "@/lib/constructor/lithophane-geometry";
import { createOrnamentGeometry } from "@/lib/constructor/ornament-geometry";
import { createPenHolderGeometry } from "@/lib/constructor/pen-holder-geometry";
import { createPlanterGeometry } from "@/lib/constructor/planter-geometry";
import { createStandGeometry } from "@/lib/constructor/phone-stand-geometry";
import {
  SIGN_FONT_URLS,
  createSignBlockGeometry,
} from "@/lib/constructor/sign-geometry";
import { createStencilGeometry } from "@/lib/constructor/stencil-geometry";
import { createStringLightGeometry } from "@/lib/constructor/string-light-geometry";
import { createVaseGeometry } from "@/lib/constructor/vase-geometry";
import { createVaseProfile } from "@/lib/constructor/vase-profile";
import { createWallHookGeometry } from "@/lib/constructor/wall-hook-geometry";
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
 *      шириной, набор клипс с диаметром кабеля, числом зажимов и шагом, кашпо с
 *      формой, дренажом и стенкой, подставка под кружку с формой, узором и
 *      бортиком, стойка для украшений с набором держателей, органайзер для
 *      ручек с формой, стенкой и отделениями, нашивка с формой, бортиком и
 *      стежками, плафоны гирлянды с раструбом, посадкой на цоколь и числом
 *      штук.
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
 * размеры, — иначе экспорт молча подменил бы узор.
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
  });
}

/**
 * Строгая проверка параметров брелока.
 *
 * Все размеры обязательны и должны лежать в границах слайдеров. Текст — не
 * длиннее 10 символов из набора шрифта; пустая строка допустима. Силуэт
 * проверяется по списку, причём старое `shapeType` ещё принимается, а
 * `rounded` превращается в жетон. Пользовательский SVG обязан быть строкой в
 * пределах 200 КБ, без скриптов и хотя бы с одним контуром: пустой `custom`
 * дал бы файл-заглушку вместо выбранной формы. NFC-флаг — только boolean,
 * иначе строка «false» включала бы карман.
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
    customSvgData = "",
    nfcEnabled = false,
  } = body;
  const shape = normalizeKeychainShapeAlias(keychainShape ?? shapeType);

  if (
    !isNumberInRange(
      length,
      CONSTRUCTOR_LIMITS.length.min,
      CONSTRUCTOR_LIMITS.length.max,
    ) ||
    !isNumberInRange(
      width,
      CONSTRUCTOR_LIMITS.width.min,
      CONSTRUCTOR_LIMITS.width.max,
    ) ||
    !isNumberInRange(
      thickness,
      CONSTRUCTOR_LIMITS.thickness.min,
      CONSTRUCTOR_LIMITS.thickness.max,
    ) ||
    !isValidKeychainText(text) ||
    !shape ||
    !isCustomSvgData(customSvgData) ||
    typeof nfcEnabled !== "boolean" ||
    (shape === "custom" && !hasDrawableSvgData(customSvgData))
  ) {
    return null;
  }

  return normalizeKeychainParams({
    length,
    width,
    thickness,
    text,
    keychainShape: shape,
    shapeType: shape,
    customSvgData,
    nfcEnabled,
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
 * Строгая проверка параметров набора клипс.
 *
 * Диаметр кабеля и шаг зажимов проверяются по границам слайдеров, а число
 * зажимов — ещё и на целое: половинка зажима не печатается, поэтому 2.5
 * отклоняется. Из этих трёх чисел складывается длина планки, и неверное
 * значение дало бы файл с чужими размерами.
 */
function parseClipsParams(body: Record<string, unknown>): ClipsParams | null {
  const { cableDiameter, clipCount, clipSpacing } = body;

  if (
    !isNumberInRange(
      cableDiameter,
      CONSTRUCTOR_LIMITS.cableDiameter.min,
      CONSTRUCTOR_LIMITS.cableDiameter.max,
    ) ||
    !isNumberInRange(
      clipCount,
      CONSTRUCTOR_LIMITS.clipCount.min,
      CONSTRUCTOR_LIMITS.clipCount.max,
    ) ||
    !Number.isInteger(clipCount) ||
    !isNumberInRange(
      clipSpacing,
      CONSTRUCTOR_LIMITS.clipSpacing.min,
      CONSTRUCTOR_LIMITS.clipSpacing.max,
    )
  ) {
    return null;
  }

  return normalizeClipsParams({ cableDiameter, clipCount, clipSpacing });
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
 * Строгая проверка параметров нашивки.
 *
 * Габарит, толщина и число стежков проверяются в границах, форма — по списку,
 * бортик — только настоящим boolean: строка «false» иначе добавила бы в файл
 * кольцо и строчку против выбора пользователя.
 */
function parseFabricPatchParams(
  body: Record<string, unknown>,
): FabricPatchParams | null {
  const { patchSize, patchThickness, patchShape, patchBorder, patchStitches } =
    body;

  if (
    !isNumberInRange(
      patchSize,
      CONSTRUCTOR_LIMITS.patchSize.min,
      CONSTRUCTOR_LIMITS.patchSize.max,
    ) ||
    !isNumberInRange(
      patchThickness,
      CONSTRUCTOR_LIMITS.patchThickness.min,
      CONSTRUCTOR_LIMITS.patchThickness.max,
    ) ||
    !isPatchShape(patchShape) ||
    typeof patchBorder !== "boolean" ||
    !isNumberInRange(
      patchStitches,
      CONSTRUCTOR_LIMITS.patchStitches.min,
      CONSTRUCTOR_LIMITS.patchStitches.max,
    ) ||
    !Number.isInteger(patchStitches)
  ) {
    return null;
  }

  return normalizeFabricPatchParams({
    patchSize,
    patchThickness,
    patchShape,
    patchBorder,
    patchStitches,
  });
}

/**
 * Строгая проверка параметров плафонов для гирлянды.
 *
 * Все размеры лежат в границах слайдеров, число плафонов — целое. Отдельно
 * проверяется посадка на цоколь: если отверстие шире, чем позволяет конус,
 * верхняя часть вывернулась бы наизнанку. Нормализация такое значение молча
 * подрезает, поэтому API отклоняет запрос целиком — за подрезанный размер
 * пользователь не голосовал.
 */
function parseStringLightParams(
  body: Record<string, unknown>,
): StringLightParams | null {
  const {
    lightDiameter,
    lightHeight,
    lightSocket,
    lightWall,
    lightCount,
  } = body;

  if (
    !isNumberInRange(
      lightDiameter,
      CONSTRUCTOR_LIMITS.lightDiameter.min,
      CONSTRUCTOR_LIMITS.lightDiameter.max,
    ) ||
    !isNumberInRange(
      lightHeight,
      CONSTRUCTOR_LIMITS.lightHeight.min,
      CONSTRUCTOR_LIMITS.lightHeight.max,
    ) ||
    !isNumberInRange(
      lightSocket,
      CONSTRUCTOR_LIMITS.lightSocket.min,
      CONSTRUCTOR_LIMITS.lightSocket.max,
    ) ||
    !isNumberInRange(
      lightWall,
      CONSTRUCTOR_LIMITS.lightWall.min,
      CONSTRUCTOR_LIMITS.lightWall.max,
    ) ||
    !isNumberInRange(
      lightCount,
      CONSTRUCTOR_LIMITS.lightCount.min,
      CONSTRUCTOR_LIMITS.lightCount.max,
    ) ||
    !Number.isInteger(lightCount) ||
    lightSocket > lightDiameter - 4 * lightWall - 2
  ) {
    return null;
  }

  return normalizeStringLightParams({
    lightDiameter,
    lightHeight,
    lightSocket,
    lightWall,
    lightCount,
  });
}

/**
 * Строгая проверка параметров ёлочной игрушки.
 *
 * Диаметр, высота и стенка проверяются в границах слайдеров, силуэт — по
 * списку, кольцо — только настоящим boolean: строка «false» иначе добавила бы
 * в файл петлю против выбора пользователя. Стенка дополнительно ограничена
 * четвертью диаметра: у более толстой стенки профиль сходится сам с собой и
 * полость игрушки исчезает, а молча подрезать размер нельзя.
 */
function parseOrnamentParams(
  body: Record<string, unknown>,
): OrnamentParams | null {
  const {
    ornamentDiameter,
    ornamentHeight,
    ornamentWall,
    ornamentShape,
    ornamentLoop,
  } = body;

  if (
    !isNumberInRange(
      ornamentDiameter,
      CONSTRUCTOR_LIMITS.ornamentDiameter.min,
      CONSTRUCTOR_LIMITS.ornamentDiameter.max,
    ) ||
    !isNumberInRange(
      ornamentHeight,
      CONSTRUCTOR_LIMITS.ornamentHeight.min,
      CONSTRUCTOR_LIMITS.ornamentHeight.max,
    ) ||
    !isNumberInRange(
      ornamentWall,
      CONSTRUCTOR_LIMITS.ornamentWall.min,
      CONSTRUCTOR_LIMITS.ornamentWall.max,
    ) ||
    ornamentWall > ornamentDiameter / 4 ||
    !isOrnamentShape(ornamentShape) ||
    typeof ornamentLoop !== "boolean"
  ) {
    return null;
  }

  return normalizeOrnamentParams({
    ornamentDiameter,
    ornamentHeight,
    ornamentWall,
    ornamentShape,
    ornamentLoop,
  });
}

/**
 * Строгая проверка параметров настенного крючка.
 *
 * Ширина, высота плиты и вынос штыря лежат в границах, крепление — по списку
 * из двух вариантов. Пересечений между полями нет: короткий штырь на высокой
 * плите печатается и держит нагрузку.
 */
function parseWallHookParams(
  body: Record<string, unknown>,
): WallHookParams | null {
  const { hookWidth, hookHeight, hookDepth, hookMount } = body;

  if (
    !isNumberInRange(
      hookWidth,
      CONSTRUCTOR_LIMITS.hookWidth.min,
      CONSTRUCTOR_LIMITS.hookWidth.max,
    ) ||
    !isNumberInRange(
      hookHeight,
      CONSTRUCTOR_LIMITS.hookHeight.min,
      CONSTRUCTOR_LIMITS.hookHeight.max,
    ) ||
    !isNumberInRange(
      hookDepth,
      CONSTRUCTOR_LIMITS.hookDepth.min,
      CONSTRUCTOR_LIMITS.hookDepth.max,
    ) ||
    !isWallHookMount(hookMount)
  ) {
    return null;
  }

  return normalizeWallHookParams({
    hookWidth,
    hookHeight,
    hookDepth,
    hookMount,
  });
}

/**
 * Строгая проверка параметров клипсы для кружки.
 *
 * Толщина борта, ширина клипсы и длина наружной ножки лежат в границах
 * слайдеров, прорезь под нитку — только настоящим boolean. От толщины борта
 * зависит зазор между ножками, поэтому значения с шагом 0.5 мм принимаются как
 * есть и выравниваются по нему же.
 */
function parseCupClipParams(
  body: Record<string, unknown>,
): CupClipParams | null {
  const { cupRim, cupClipWidth, cupClipLength, cupClipHook } = body;

  if (
    !isNumberInRange(
      cupRim,
      CONSTRUCTOR_LIMITS.cupRim.min,
      CONSTRUCTOR_LIMITS.cupRim.max,
    ) ||
    !isNumberInRange(
      cupClipWidth,
      CONSTRUCTOR_LIMITS.cupClipWidth.min,
      CONSTRUCTOR_LIMITS.cupClipWidth.max,
    ) ||
    !isNumberInRange(
      cupClipLength,
      CONSTRUCTOR_LIMITS.cupClipLength.min,
      CONSTRUCTOR_LIMITS.cupClipLength.max,
    ) ||
    typeof cupClipHook !== "boolean"
  ) {
    return null;
  }

  return normalizeCupClipParams({
    cupRim,
    cupClipWidth,
    cupClipLength,
    cupClipHook,
  });
}

/**
 * Строгая проверка параметров трафарета.
 *
 * Ширина, высота и толщина проверяются в границах, узор — по списку трёх
 * вариантов. Шаг прорезей в запрос не входит: он считается от габарита плиты,
 * поэтому одинаковый узор выглядит целым и на открытке, и на половине листа.
 */
function parseStencilParams(
  body: Record<string, unknown>,
): StencilParams | null {
  const { stencilWidth, stencilHeight, stencilThickness, stencilPattern } = body;

  if (
    !isNumberInRange(
      stencilWidth,
      CONSTRUCTOR_LIMITS.stencilWidth.min,
      CONSTRUCTOR_LIMITS.stencilWidth.max,
    ) ||
    !isNumberInRange(
      stencilHeight,
      CONSTRUCTOR_LIMITS.stencilHeight.min,
      CONSTRUCTOR_LIMITS.stencilHeight.max,
    ) ||
    !isNumberInRange(
      stencilThickness,
      CONSTRUCTOR_LIMITS.stencilThickness.min,
      CONSTRUCTOR_LIMITS.stencilThickness.max,
    ) ||
    !isStencilPattern(stencilPattern)
  ) {
    return null;
  }

  return normalizeStencilParams({
    stencilWidth,
    stencilHeight,
    stencilThickness,
    stencilPattern,
  });
}

/**
 * Строгая проверка параметров шкатулки с кодом.
 *
 * Габарит проверяется в границах слайдера, код — только буквами: цифры и знаки
 * отклонили бы запрос, а не превратились в другое кольцо. Надпись на крышке
 * может быть пустой, но символы вне шрифта не принимаются: буквы вырезаются
 * TextGeometry, и неподдерживаемый глиф дал бы дырку в крышке.
 */
function parseCipherBoxParams(
  body: Record<string, unknown>,
): CipherBoxParams | null {
  const { cipherSize, cipherWord, cipherInserts, cipherLidText } = body;

  if (
    !isNumberInRange(
      cipherSize,
      CONSTRUCTOR_LIMITS.cipherSize.min,
      CONSTRUCTOR_LIMITS.cipherSize.max,
    ) ||
    !isCipherWord(cipherWord) ||
    typeof cipherInserts !== "boolean" ||
    !isCipherLidText(cipherLidText)
  ) {
    return null;
  }

  return normalizeCipherBoxParams({
    cipherSize,
    cipherWord,
    cipherInserts,
    cipherLidText,
  });
}

/**
 * Строгая проверка параметров подарочной коробки.
 *
 * Габарит и форма проверяются теми же правилами, что у кашпо, замки — только
 * настоящим boolean. Двойное дно вместе с лабиринтом не отклоняется: они делят
 * один объём, и нормализация выключает пластину — клиент получает ту же
 * коробку, что видел в предпросмотре.
 */
function parseGiftBoxParams(
  body: Record<string, unknown>,
): GiftBoxParams | null {
  const {
    giftSize,
    giftShape,
    giftScrewLock,
    giftFalseBottom,
    giftMazeLock,
  } = body;

  if (
    !isNumberInRange(
      giftSize,
      CONSTRUCTOR_LIMITS.giftSize.min,
      CONSTRUCTOR_LIMITS.giftSize.max,
    ) ||
    !isGiftBoxShape(giftShape) ||
    typeof giftScrewLock !== "boolean" ||
    typeof giftFalseBottom !== "boolean" ||
    typeof giftMazeLock !== "boolean"
  ) {
    return null;
  }

  return normalizeGiftBoxParams({
    giftSize,
    giftShape,
    giftScrewLock,
    giftFalseBottom,
    giftMazeLock,
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
  | { model: "clips"; params: ClipsParams }
  | { model: "planter"; params: PlanterParams }
  | { model: "coaster"; params: CoasterParams }
  | { model: "jewelry_stand"; params: JewelryStandParams }
  | { model: "pen_holder"; params: PenHolderParams }
  | { model: "fabric_patch"; params: FabricPatchParams }
  | { model: "string_light"; params: StringLightParams }
  | { model: "ornament"; params: OrnamentParams }
  | { model: "wall_hook"; params: WallHookParams }
  | { model: "cup_clip"; params: CupClipParams }
  | { model: "stencil"; params: StencilParams }
  | { model: "cipher_box"; params: CipherBoxParams }
  | { model: "gift_box"; params: GiftBoxParams };

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

  if (model === "clips") {
    const params = parseClipsParams(body);

    return params ? { model: "clips", params } : null;
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

  if (model === "fabric_patch") {
    const params = parseFabricPatchParams(body);

    return params ? { model: "fabric_patch", params } : null;
  }

  if (model === "string_light") {
    const params = parseStringLightParams(body);

    return params ? { model: "string_light", params } : null;
  }

  if (model === "ornament") {
    const params = parseOrnamentParams(body);

    return params ? { model: "ornament", params } : null;
  }

  if (model === "wall_hook") {
    const params = parseWallHookParams(body);

    return params ? { model: "wall_hook", params } : null;
  }

  if (model === "cup_clip") {
    const params = parseCupClipParams(body);

    return params ? { model: "cup_clip", params } : null;
  }

  if (model === "stencil") {
    const params = parseStencilParams(body);

    return params ? { model: "stencil", params } : null;
  }

  if (model === "cipher_box") {
    const params = parseCipherBoxParams(body);

    return params ? { model: "cipher_box", params } : null;
  }

  if (model === "gift_box") {
    const params = parseGiftBoxParams(body);

    return params ? { model: "gift_box", params } : null;
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
      "Проверьте размеры и узор вазы, силуэт и SVG брелока, NFC-флаг, надпись вывески (нужна хотя бы одна буква), номер блока и его деталь, ячейки коробки, изображение литофана, наклон и ширину подставки, диаметр кабеля и число зажимов, габарит кашпо, форму и узор подставки под кружку, высоту стойки для украшений, форму и отделения органайзера для ручек, форму и стежки нашивки, размеры и число плафонов гирлянды, габарит и силуэт игрушки, размеры и крепление крючка, толщину борта и размеры клипсы, габарит и узор трафарета, габарит, код и надпись шкатулки, габарит, форму и замки подарочной коробки.",
    );
  }

  try {
    // Шрифт читается брелоку, вывеске и шкатулке с кодом; остальные модели
    // собираются без него, чтобы не парсить 130 КБ JSON.
    // loadFont() кэширует промис по пути, поэтому повторный вызов и смена
    // шрифта вывески ничего не стоят.
    const geometry =
      parsed.model === "vase"
        ? createVaseGeometry(createVaseProfile(parsed.params), parsed.params)
        : parsed.model === "box"
          ? createBoxGeometry(parsed.params)
          : parsed.model === "lithophane"
            ? createLithophaneGeometry(parsed.params, parsed.part)
            : parsed.model === "stand"
              ? createStandGeometry(parsed.params)
              : parsed.model === "clips"
                ? createClipsGeometry(parsed.params)
                : parsed.model === "planter"
                  ? createPlanterGeometry(parsed.params)
                  : parsed.model === "coaster"
                    ? createCoasterGeometry(parsed.params)
                    : parsed.model === "jewelry_stand"
                      ? createJewelryStandGeometry(parsed.params)
                      : parsed.model === "pen_holder"
                        ? createPenHolderGeometry(parsed.params)
                        : parsed.model === "fabric_patch"
                          ? createFabricPatchGeometry(parsed.params)
                          : parsed.model === "string_light"
                            ? createStringLightGeometry(parsed.params)
                            : parsed.model === "ornament"
                              ? createOrnamentGeometry(parsed.params)
                              : parsed.model === "wall_hook"
                                ? createWallHookGeometry(parsed.params)
                                : parsed.model === "cup_clip"
                                  ? createCupClipGeometry(parsed.params)
                                  : parsed.model === "stencil"
                                    ? createStencilGeometry(parsed.params)
                                    : parsed.model === "cipher_box"
                                      ? createCipherBoxGeometry(
                                          parsed.params,
                                          await loadFont(KEYCHAIN_FONT_URL),
                                        )
                                      : parsed.model === "gift_box"
                                        ? createGiftBoxGeometry(parsed.params)
                                        : parsed.model === "keychain"
                                          ? createKeychainGeometry(
                                              parsed.params,
                                              await loadFont(KEYCHAIN_FONT_URL),
                                            )
                                          : createSignBlockGeometry(
                                              parsed.params,
                                              await loadFont(
                                                SIGN_FONT_URLS[
                                                  parsed.params.signFont
                                                ],
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
                  : parsed.model === "clips"
                    ? clipsStlFileName(parsed.params)
                    : parsed.model === "planter"
                      ? planterStlFileName(parsed.params)
                      : parsed.model === "coaster"
                        ? coasterStlFileName(parsed.params)
                        : parsed.model === "jewelry_stand"
                          ? jewelryStandStlFileName(parsed.params)
                          : parsed.model === "pen_holder"
                            ? penHolderStlFileName(parsed.params)
                            : parsed.model === "fabric_patch"
                              ? fabricPatchStlFileName(parsed.params)
                              : parsed.model === "string_light"
                                ? stringLightStlFileName(parsed.params)
                                : parsed.model === "ornament"
                                  ? ornamentStlFileName(parsed.params)
                                  : parsed.model === "wall_hook"
                                    ? wallHookStlFileName(parsed.params)
                                    : parsed.model === "cup_clip"
                                      ? cupClipStlFileName(parsed.params)
                                      : parsed.model === "stencil"
                                        ? stencilStlFileName(parsed.params)
                                        : parsed.model === "cipher_box"
                                          ? cipherBoxStlFileName(parsed.params)
                                          : parsed.model === "gift_box"
                                            ? giftBoxStlFileName(parsed.params)
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
