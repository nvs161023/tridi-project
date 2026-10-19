import { Mesh } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

import {
  CONSTRUCTOR_LIMITS,
  isVaseShape,
  normalizeVaseParams,
  vaseStlFileName,
  type VaseParams,
} from "@/lib/constructor/params";
import { createVaseGeometry } from "@/lib/constructor/vase-geometry";
import { createVaseProfile } from "@/lib/constructor/vase-profile";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

/**
 * Серверный экспорт параметрической вазы в бинарный STL.
 *
 * Проверки идут строго по порядку, как у скачивания профилей:
 *   1. сессия — getUser(), потому что /api/* не покрыт middleware;
 *   2. Pro — hasActiveSubscription() по purchases и subscriptions;
 *   3. параметры — только числа внутри границ слайдеров и известная форма.
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
function errorResponse(status: number, error: string, message: string): Response {
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
function isNumberInRange(value: unknown, min: number, max: number): value is number {
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
 * отклоняем отсутствующие поля, NaN/Infinity, чужие формы и выход за границы,
 * и только потом выравниваем валидные числа по шагу слайдеров.
 */
function parseVaseParams(body: unknown): VaseParams | null {
  if (!isRecord(body)) {
    return null;
  }

  const { height, diameter, wall, shape } = body;

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
    !isVaseShape(shape)
  ) {
    return null;
  }

  return normalizeVaseParams({ height, diameter, wall, shape });
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

  const params = parseVaseParams(body);

  if (!params) {
    return errorResponse(
      422,
      "invalid_params",
      "Проверьте высоту, диаметр, толщину стенки и форму вазы.",
    );
  }

  try {
    const geometry = createVaseGeometry(createVaseProfile(params));

    try {
      const mesh = new Mesh(geometry);
      // Сетка стоит в начале координат; явный вызов защищает от того, что
      // STLExporter возьмёт необновлённую matrixWorld у нового объекта.
      mesh.updateMatrixWorld(true);

      const stl = new STLExporter().parse(mesh, { binary: true });
      const bytes = new Uint8Array(
        stl.buffer,
        stl.byteOffset,
        stl.byteLength,
      );
      const fileName = vaseStlFileName(params);

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
