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
  DEFAULT_VASE_PARAMS,
  boxStlFileName,
  calibrationStlFileName,
  isCalibrationType,
  isKeychainShape,
  isLampMount,
  isSignChannelWidth,
  isVasePattern,
  isVaseShape,
  isValidKeychainText,
  isValidSignText,
  keychainStlFileName,
  lampStlFileName,
  normalizeBoxParams,
  normalizeCalibrationParams,
  normalizeKeychainParams,
  normalizeLampParams,
  normalizeSignParams,
  normalizeVaseParams,
  signStlFileName,
  vaseStlFileName,
  type BoxParams,
  type CalibrationParams,
  type KeychainParams,
  type LampParams,
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
import { createSignGeometry } from "@/lib/constructor/sign-geometry";
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
 *      узор вазы, брелок с именем и формой заготовки, абажур с узором и
 *      патроном E27/E14, вывеска с надписью и шириной канала, калибровочная
 *      башня с диапазоном и числом ступеней либо коробка с сеткой и крышкой.
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
 * длиннее 10 символов из набора шрифта; пустая строка допустима. Форму
 * заготовки проверяем по списку, чтобы API не собирал случайный контур.
 */
function parseKeychainParams(
  body: Record<string, unknown>,
): KeychainParams | null {
  const { length, width, thickness, text, shapeType } = body;

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
    !isKeychainShape(shapeType)
  ) {
    return null;
  }

  return normalizeKeychainParams({
    length,
    width,
    thickness,
    text,
    shapeType,
  });
}

/**
 * Строгая проверка параметров светильника.
 *
 * Высота, диаметр и стенка должны лежать в границах слайдеров. Узор берётся
 * из того же списка, что у вазы, а патрон — из известных E27/E14: от него
 * зависит диаметр гнезда, поэтому незнакомое значение отклоняется, а не
 * подменяется E27.
 */
function parseLampParams(body: Record<string, unknown>): LampParams | null {
  const { lampHeight, lampDiameter, lampWall, lampPattern, lampMount } = body;

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
    !isLampMount(lampMount)
  ) {
    return null;
  }

  return normalizeLampParams({
    lampHeight,
    lampDiameter,
    lampWall,
    lampPattern,
    lampMount,
  });
}

/**
 * Строгая проверка параметров вывески.
 *
 * Надпись — до 15 символов из набора шрифта; пустая строка допустима. Кегль,
 * выступ букв и ширина канала проверяются по границам и списку: геометрия
 * сама уменьшит буквы, если строка не влезает в 800 мм, но канал 9 мм
 * отклонится — такой ленты не бывает.
 */
function parseSignParams(body: Record<string, unknown>): SignParams | null {
  const { signText, signFontSize, signDepth, signChannelWidth } = body;

  if (
    !isValidSignText(signText) ||
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
    !isSignChannelWidth(signChannelWidth)
  ) {
    return null;
  }

  return normalizeSignParams({
    signText,
    signFontSize,
    signDepth,
    signChannelWidth,
  });
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
 * Размеры проверяются в своих границах, сетка — целыми числами от 1 до 8,
 * крышка — только настоящим boolean. Если клиент прислал `hasLid: "false"`,
 * это ошибка, а не выключенная крышка: иначе строка включала бы деталь.
 */
function parseBoxParams(body: Record<string, unknown>): BoxParams | null {
  const { boxLength, boxWidth, boxHeight, boxWall, gridX, gridY, hasLid } =
    body;

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
    !isNumberInRange(
      gridX,
      CONSTRUCTOR_LIMITS.boxGrid.min,
      CONSTRUCTOR_LIMITS.boxGrid.max,
    ) ||
    !isNumberInRange(
      gridY,
      CONSTRUCTOR_LIMITS.boxGrid.min,
      CONSTRUCTOR_LIMITS.boxGrid.max,
    ) ||
    !Number.isInteger(gridX) ||
    !Number.isInteger(gridY) ||
    typeof hasLid !== "boolean"
  ) {
    return null;
  }

  return normalizeBoxParams({
    boxLength,
    boxWidth,
    boxHeight,
    boxWall,
    gridX,
    gridY,
    hasLid,
  });
}

/** Разобранный запрос: модель и её проверенные параметры. */
type ParsedConstructorRequest =
  | { model: "vase"; params: VaseParams }
  | { model: "keychain"; params: KeychainParams }
  | { model: "lamp"; params: LampParams }
  | { model: "sign"; params: SignParams }
  | { model: "calibration"; params: CalibrationParams }
  | { model: "box"; params: BoxParams };

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
    const params = parseLampParams(body);

    return params ? { model: "lamp", params } : null;
  }

  if (model === "sign") {
    const params = parseSignParams(body);

    return params ? { model: "sign", params } : null;
  }

  if (model === "calibration") {
    const params = parseCalibrationParams(body);

    return params ? { model: "calibration", params } : null;
  }

  if (model === "box") {
    const params = parseBoxParams(body);

    return params ? { model: "box", params } : null;
  }

  return null;
}

/**
 * Шрифт читается с диска один раз на процесс.
 *
 * Промис кэшируется, поэтому одновременные запросы не парсят 130 КБ JSON
 * каждый раз. При ошибке кэш сбрасывается: следующий запрос попробует снова.
 */
let cyrillicFontPromise: Promise<Font> | null = null;

function loadCyrillicFont(): Promise<Font> {
  if (!cyrillicFontPromise) {
    const file = path.join(
      process.cwd(),
      "public",
      KEYCHAIN_FONT_URL.replace(/^\/+/, ""),
    );

    cyrillicFontPromise = readFile(file, "utf8")
      .then((json) => new FontLoader().parse(JSON.parse(json) as FontData))
      .catch((error: unknown) => {
        cyrillicFontPromise = null;
        throw error;
      });
  }

  return cyrillicFontPromise;
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
      "Проверьте размеры и узор вазы, брелока, абажура, надпись вывески, диапазон калибровки или сетку коробки.",
    );
  }

  try {
    // Шрифт читается брелоку, вывеске и калибровке; ваза, абажур и коробка
    // собираются без него, чтобы не парсить 130 КБ JSON. loadCyrillicFont()
    // кэширует промис, поэтому второй вызов в ветках ниже ничего не стоит.
    const geometry =
      parsed.model === "vase"
        ? createVaseGeometry(createVaseProfile(parsed.params), parsed.params)
        : parsed.model === "lamp"
          ? createLampGeometry(parsed.params)
          : parsed.model === "box"
            ? createBoxGeometry(parsed.params)
            : parsed.model === "keychain"
              ? createKeychainGeometry(parsed.params, await loadCyrillicFont())
              : parsed.model === "sign"
                ? createSignGeometry(parsed.params, await loadCyrillicFont())
                : createCalibrationGeometry(
                    parsed.params,
                    await loadCyrillicFont(),
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
              ? lampStlFileName(parsed.params)
              : parsed.model === "box"
                ? boxStlFileName(parsed.params)
                : parsed.model === "sign"
                  ? signStlFileName(parsed.params)
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
