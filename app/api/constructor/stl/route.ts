import { readFile } from "node:fs/promises";
import path from "node:path";

import { Mesh } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import type { Font, FontData } from "three/examples/jsm/loaders/FontLoader.js";

import {
  CONSTRUCTOR_LIMITS,
  DEFAULT_VASE_PARAMS,
  isKeychainShape,
  isVasePattern,
  isVaseShape,
  isValidKeychainText,
  keychainStlFileName,
  normalizeKeychainParams,
  normalizeVaseParams,
  vaseStlFileName,
  type KeychainParams,
  type VaseParams,
} from "@/lib/constructor/params";
import {
  KEYCHAIN_FONT_URL,
  createKeychainGeometry,
} from "@/lib/constructor/keychain-geometry";
import { createVaseGeometry } from "@/lib/constructor/vase-geometry";
import { createVaseProfile } from "@/lib/constructor/vase-profile";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

/**
 * Серверный экспорт параметрической модели в бинарный STL.
 *
 * Проверки идут строго по порядку, как у скачивания профилей:
 *   1. сессия — getUser(), потому что /api/* не покрыт middleware;
 *   2. Pro — hasActiveSubscription() по purchases и subscriptions;
 *   3. параметры — только числа внутри границ слайдеров, известная форма и
 *      узор вазы либо известная форма и имя брелока.
 *
 * Гость получает 401, вошедший без подписки — 403, испорченное тело — 422.
 * Проверка в интерфейсе нужна только для удобства: адрес API можно вызвать
 * руками, поэтому без подписки файл отсюда не уйдёт.
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

/** Разобранный запрос: модель и её проверенные параметры. */
type ParsedConstructorRequest =
  | { model: "vase"; params: VaseParams }
  | { model: "keychain"; params: KeychainParams };

/**
 * Выбирает набор параметров по полю model.
 *
 * Старые клиенты его не передают и получают вазу — так экспорт продолжает
 * работать после появления брелока. Незнакомая модель отклоняется целиком,
 * а не подменяется вазой: иначе клиент получил бы не тот файл.
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

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return errorResponse(
      403,
      "pro_required",
      "Экспорт доступен только по подписке Pro",
    );
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
      "Проверьте размеры и узор вазы или длину, ширину, толщину, имя и форму брелока.",
    );
  }

  try {
    const geometry =
      parsed.model === "keychain"
        ? createKeychainGeometry(parsed.params, await loadCyrillicFont())
        : createVaseGeometry(createVaseProfile(parsed.params), parsed.params);

    try {
      const mesh = new Mesh(geometry);
      // Сетка стоит в начале координат; явный вызов защищает от того, что
      // STLExporter возьмёт необновлённую matrixWorld у нового объекта.
      mesh.updateMatrixWorld(true);

      const stl = new STLExporter().parse(mesh, { binary: true });
      const bytes = new Uint8Array(stl.buffer, stl.byteOffset, stl.byteLength);
      const fileName =
        parsed.model === "keychain"
          ? keychainStlFileName(parsed.params)
          : vaseStlFileName(parsed.params);

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
