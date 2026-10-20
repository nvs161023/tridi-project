import { readFile } from "node:fs/promises";
import path from "node:path";

import { Mesh } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import type { Font, FontData } from "three/examples/jsm/loaders/FontLoader.js";

import {
  FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH,
  countConstructorDownloadsThisMonth,
} from "@/lib/constructor/downloads";
import {
  CALIBRATION_VALUE_LIMITS,
  CONSTRUCTOR_LIMITS,
  DEFAULT_LAMP_PARAMS,
  DEFAULT_SIGN_PARAMS,
  DEFAULT_VASE_PARAMS,
  boxStlFileName,
  calibrationStlFileName,
  hasDrawableSvgData,
  isBoxCells,
  isCalibrationType,
  isCustomSvgData,
  isLampBaseShape,
  isLampMount,
  isLampPart,
  isLithophaneBrightness,
  isSignChannelWidth,
  isSignFont,
  isVasePattern,
  isVaseShape,
  isValidKeychainText,
  isValidSignText,
  keychainStlFileName,
  lampStlFileName,
  listSignLetters,
  lithophaneStlFileName,
  normalizeBoxParams,
  normalizeCalibrationParams,
  normalizeKeychainParams,
  normalizeKeychainShapeAlias,
  normalizeLampParams,
  normalizeLithophaneParams,
  normalizeSignParams,
  normalizeVaseParams,
  signStlFileName,
  vaseStlFileName,
  type BoxParams,
  type CalibrationParams,
  type KeychainParams,
  type LampParams,
  type LampPart,
  type LithophaneParams,
  type SignParams,
  type VaseParams,
} from "@/lib/constructor/params";
import { createBoxGeometry } from "@/lib/constructor/box-geometry";
import { createCalibrationGeometry } from "@/lib/constructor/calibration-geometry";
import {
  KEYCHAIN_FONT_URL,
  createKeychainGeometry,
} from "@/lib/constructor/keychain-geometry";
import { createLampGeometry } from "@/lib/constructor/lamp-geometry";
import { createLithophaneGeometry } from "@/lib/constructor/lithophane-geometry";
import {
  SIGN_FONT_URLS,
  createSignGeometry,
  createSignLetterGeometry,
} from "@/lib/constructor/sign-geometry";
import { createVaseGeometry } from "@/lib/constructor/vase-geometry";
import { createVaseProfile } from "@/lib/constructor/vase-profile";
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
 *      узор вазы, брелок с именем и формой заготовки, светильник с узором,
 *      патроном, формой основания и выбранной деталью (основание, абажур или
 *      обе), вывеска с надписью, глубиной, каналом, зазором и номером буквы,
 *      калибровочная башня с диапазоном и числом ступеней, коробка с сеткой и
 *      крышкой либо литофан с размерами, толщинами и сжатым массивом яркости
 *      150 × 150.
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
 * Строгая проверка параметров светильника.
 *
 * Высота, диаметр, стенка и высота основания должны лежать в границах
 * слайдеров. Узор берётся из того же списка, что у вазы, патрон — из известных
 * E27/E14: от него зависит диаметр гнезда, поэтому незнакомое значение
 * отклоняется, а не подменяется E27. Форма основания тоже проверяется по
 * списку — от неё зависят контуры оболочки, — а деталь (`part`) решает, что
 * попадёт в файл: основание, абажур или обе части сразу.
 */
function parseLampParams(
  body: Record<string, unknown>,
): { params: LampParams; part: LampPart } | null {
  const {
    lampHeight,
    lampDiameter,
    lampWall,
    lampPattern,
    lampMount,
    lampBaseShape = DEFAULT_LAMP_PARAMS.lampBaseShape,
    lampBaseHeight = DEFAULT_LAMP_PARAMS.lampBaseHeight,
    part = "all",
  } = body;

  if (
    !isNumberInRange(
      lampHeight,
      CONSTRUCTOR_LIMITS.lampHeight.min,
      CONSTRUCTOR_LIMITS.lampHeight.max,
    ) ||
    !isNumberInRange(
      lampDiameter,
      CONSTRUCTOR_LIMITS.lampDiameter.min,
      CONSTRUCTOR_LIMITS.lampDiameter.max,
    ) ||
    !isNumberInRange(
      lampWall,
      CONSTRUCTOR_LIMITS.lampWall.min,
      CONSTRUCTOR_LIMITS.lampWall.max,
    ) ||
    !isVasePattern(lampPattern) ||
    !isLampMount(lampMount) ||
    !isLampBaseShape(lampBaseShape) ||
    !isNumberInRange(
      lampBaseHeight,
      CONSTRUCTOR_LIMITS.lampBaseHeight.min,
      CONSTRUCTOR_LIMITS.lampBaseHeight.max,
    ) ||
    !isLampPart(part)
  ) {
    return null;
  }

  return {
    params: normalizeLampParams({
      lampHeight,
      lampDiameter,
      lampWall,
      lampPattern,
      lampMount,
      lampBaseShape,
      lampBaseHeight,
    }),
    part,
  };
}

/**
 * Строгая проверка параметров вывески.
 *
 * Надпись — до 15 символов из набора шрифта, но не пустая: каждая буква стала
 * отдельной деталью, и из пустой строки собирать нечего. Шрифт выбирается из
 * списка: имя файла подставляется только из SIGN_FONT_URLS, поэтому тело
 * запроса не может прочитать произвольный путь с диска. Кегль, глубина и зазор
 * проверяются по границам, ширина канала — по списку: ленты другой ширины не
 * бывает. Геометрия сама уменьшит буквы, если строка не влезает в 800 мм.
 *
 * `letter` — номер буквы с нуля, по listSignLetters; null или отсутствие
 * означает всю надпись одной сеткой. Номер за границами строки отклоняется,
 * иначе клиент получил бы пустой STL вместо ошибки.
 */
function parseSignParams(
  body: Record<string, unknown>,
): { params: SignParams; letter: number | null } | null {
  const {
    signText,
    signFont = DEFAULT_SIGN_PARAMS.signFont,
    signFontSize,
    signDepth,
    signChannelWidth,
    signLetterGap = DEFAULT_SIGN_PARAMS.signLetterGap,
    letter = null,
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
    )
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
  });
  const letters = listSignLetters(params.signText);

  if (letters.length === 0) {
    return null;
  }

  if (letter !== null) {
    if (
      typeof letter !== "number" ||
      !Number.isInteger(letter) ||
      letter < 0 ||
      letter >= letters.length
    ) {
      return null;
    }
  }

  return { params, letter };
}

/**
 * Строгая проверка параметров калибровочной башни.
 *
 * Диапазон зависит от теста: температура 190–230 °C, ретракт 0–5 мм. Сначала
 * проверяем тип, затем границы именно его — иначе 230 прошло бы как 230 мм
 * ретракта. Число ступеней общее для обоих тестов, от 2 до 10.
 */
function parseCalibrationParams(
  body: Record<string, unknown>,
): CalibrationParams | null {
  const { calibrationType, startValue, endValue, steps } = body;

  if (!isCalibrationType(calibrationType)) {
    return null;
  }

  const limit = CALIBRATION_VALUE_LIMITS[calibrationType];

  if (
    !isNumberInRange(startValue, limit.min, limit.max) ||
    !isNumberInRange(endValue, limit.min, limit.max) ||
    !isNumberInRange(
      steps,
      CONSTRUCTOR_LIMITS.calibrationSteps.min,
      CONSTRUCTOR_LIMITS.calibrationSteps.max,
    )
  ) {
    return null;
  }

  return normalizeCalibrationParams({
    calibrationType,
    startValue,
    endValue,
    steps,
  });
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
 * плоским. Массив яркости принимается только целыми числами 0–255 ровно на
 * 150 × 150 пикселей. Строка base64 здесь не поддерживается: браузер уже
 * присылает готовую сетку, и серверу не нужно декодировать изображение.
 */
function parseLithophaneParams(
  body: Record<string, unknown>,
): LithophaneParams | null {
  const {
    lithophaneWidth,
    lithophaneHeight,
    lithophaneMinThickness,
    lithophaneMaxThickness,
    lithophaneBrightness,
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
    !isLithophaneBrightness(lithophaneBrightness)
  ) {
    return null;
  }

  return normalizeLithophaneParams({
    lithophaneWidth,
    lithophaneHeight,
    lithophaneMinThickness,
    lithophaneMaxThickness,
    lithophaneBrightness,
  });
}

/** Разобранный запрос: модель и её проверенные параметры. */
type ParsedConstructorRequest =
  | { model: "vase"; params: VaseParams }
  | { model: "keychain"; params: KeychainParams }
  | { model: "lamp"; params: LampParams; part: LampPart }
  | { model: "sign"; params: SignParams; letter: number | null }
  | { model: "calibration"; params: CalibrationParams }
  | { model: "box"; params: BoxParams }
  | { model: "lithophane"; params: LithophaneParams };

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

  if (model === "lamp") {
    const lamp = parseLampParams(body);

    return lamp ? { model: "lamp", ...lamp } : null;
  }

  if (model === "sign") {
    const sign = parseSignParams(body);

    return sign ? { model: "sign", ...sign } : null;
  }

  if (model === "calibration") {
    const params = parseCalibrationParams(body);

    return params ? { model: "calibration", params } : null;
  }

  if (model === "box") {
    const params = parseBoxParams(body);

    return params ? { model: "box", params } : null;
  }

  if (model === "lithophane") {
    const params = parseLithophaneParams(body);

    return params ? { model: "lithophane", params } : null;
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
        "Лимит бесплатных скачиваний (3 в месяц) исчерпан. Оформите подписку Pro для безлимитного доступа.",
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
      "Проверьте размеры и узор вазы, силуэт и SVG брелока, NFC-флаг, детали и форму основания светильника, надпись вывески (нужна хотя бы одна буква), диапазон калибровки, ячейки коробки или изображение литофана.",
    );
  }

  try {
    // Шрифт читается брелоку, вывеске и калибровке; ваза, абажур, коробка и
    // литофан собираются без него, чтобы не парсить 130 КБ JSON.
    // loadFont() кэширует промис по пути, поэтому повторный вызов и смена
    // шрифта вывески ничего не стоят.
    const geometry =
      parsed.model === "vase"
        ? createVaseGeometry(createVaseProfile(parsed.params), parsed.params)
        : parsed.model === "lamp"
          ? createLampGeometry(parsed.params, parsed.part)
          : parsed.model === "box"
            ? createBoxGeometry(parsed.params)
            : parsed.model === "lithophane"
              ? createLithophaneGeometry(parsed.params)
              : parsed.model === "keychain"
                ? createKeychainGeometry(parsed.params, await loadFont(KEYCHAIN_FONT_URL))
                : parsed.model === "sign"
                  ? parsed.letter === null
                    ? createSignGeometry(
                        parsed.params,
                        await loadFont(SIGN_FONT_URLS[parsed.params.signFont]),
                      )
                    : createSignLetterGeometry(
                        parsed.params,
                        await loadFont(SIGN_FONT_URLS[parsed.params.signFont]),
                        parsed.letter,
                      )
                  : createCalibrationGeometry(
                      parsed.params,
                      await loadFont(KEYCHAIN_FONT_URL),
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
            : parsed.model === "lamp"
              ? lampStlFileName(parsed.params, parsed.part)
              : parsed.model === "box"
                ? boxStlFileName(parsed.params)
                : parsed.model === "lithophane"
                  ? lithophaneStlFileName(parsed.params)
                  : parsed.model === "sign"
                    ? signStlFileName(parsed.params, parsed.letter)
                    : calibrationStlFileName(parsed.params);

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
