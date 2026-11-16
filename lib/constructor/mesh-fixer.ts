import { createHash } from "node:crypto";
import { access, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { NodeIO, type Document, type Primitive } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { BufferAttribute, BufferGeometry, Matrix4, Mesh, Vector3 } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Постобработка сгенерированной 3D-модели: GLB → печатный STL.
 *
 * Сети генерации отдают GLB в произвольном масштабе и с избыточной сеткой:
 * Tripo и Meshy считают модель в своих единицах, а 3D-принтер ждёт миллиметры.
 * Поэтому файл проходит «мясорубку»:
 *
 *   1. скачивается по ссылке (только https, кроме локального стенда);
 *   2. читается через `@gltf-transform/core` (NodeIO);
 *   3. вершины свариваются (`weld`) и удаляются дубликаты (`dedup`, `prune`);
 *   4. сетка упрощается до ~100 000 треугольников (`simplify` из
 *      `@gltf-transform/functions`, алгоритм meshoptimizer);
 *   5. геометрия переносится в `three.js`, масштабируется так, чтобы самый
 *      большой габарит был ровно 120 мм;
 *   6. результат пишется бинарным STL через серверный `STLExporter`.
 *
 * STL-файл живёт во временной папке (`<tmp>/tridi-3d`). Имя — SHA-256 от
 * ссылки на GLB, поэтому повторный опрос статуса готовой задачи не запускает
 * постобработку заново. Отдаёт файл роут `/api/generated-stl/[file]`.
 */

/** Самый большой габарит готовой модели для печати, в миллиметрах. */
export const TARGET_MAX_DIMENSION_MM = 120;

/** Потолок подробности сетки: больше печатать смысла нет. */
const MAX_TRIANGLES = 100_000;

/** Предел ошибки упрощения — доля от радиуса сетки (0,1 %). */
const SIMPLIFY_ERROR = 0.001;

/** Скачивание GLB из чужого облака: модель может весить десятки мегабайт. */
const DOWNLOAD_TIMEOUT_MS = 120_000;

/** Предел модели: столько же разрешено скачивать провайдерам генерации. */
const MAX_GLB_BYTES = 50 * 1024 * 1024;

/** Сколько символов ответа сети попадает в сообщение об ошибке. */
const MAX_ERROR_DETAIL = 300;

/** Режим glTF `TRIANGLES`: линии и точки в STL для печати не годятся. */
const GLTF_TRIANGLES = 4;

/** Папка с готовыми STL: временная, общая для процесса Next и роутов отдачи. */
export const GENERATED_STL_DIR = path.join(tmpdir(), "tridi-3d");

/** Имя файла — 40 hex-символов SHA-256 и расширение `.stl`. */
const GENERATED_STL_PATTERN = /^[a-f0-9]{40}\.stl$/;

/**
 * Разрешает имя файла из URL в путь на диске.
 *
 * Возвращает `null` для любого имени вне шаблона: роут отдачи принимает только
 * собственные файлы «мясорубки» и не даёт выйти из временной папки.
 */
export function resolveGeneratedStl(fileName: string): string | null {
  return GENERATED_STL_PATTERN.test(fileName)
    ? path.join(GENERATED_STL_DIR, fileName)
    : null;
}

/** Ошибка постобработки с понятным клиенту текстом. */
export class MeshFixerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeshFixerError";
  }
}

/**
 * Проверяет ссылку на GLB.
 *
 * Боевые сети отдают модель только по https. Исключение для localhost нужно
 * тестам и локальному стенду, где GLB раздаёт временный http-сервер: без него
 * проверить «мясорубку» без платной генерации нельзя.
 */
function assertGlbUrl(value: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new MeshFixerError("Ссылка на модель имеет неверный формат.");
  }

  const host = url.hostname;
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]";

  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new MeshFixerError("Ссылка на модель должна начинаться с https://.");
  }

  return url;
}

/** Имя STL по ссылке на GLB: одинаковый вход — одинаковый файл. */
function stlFileNameFor(glbUrl: string): string {
  const hash = createHash("sha256").update(glbUrl).digest("hex").slice(0, 40);

  return `${hash}.stl`;
}

/** Есть ли файл на диске. Ошибки доступа считаем отсутствием файла. */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Короткий текст причины из ответа сети: JSON, HTML или сырой текст. */
function errorDetail(text: string): string {
  const trimmed = text.trim();

  if (!trimmed) {
    return "ответ без описания";
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const message =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.error === "string"
          ? parsed.error
          : trimmed;

    return message.slice(0, MAX_ERROR_DETAIL);
  } catch {
    return trimmed.slice(0, MAX_ERROR_DETAIL);
  }
}

/** Скачивает GLB и проверяет, что по ссылке действительно файл модели. */
async function downloadGlb(glbUrl: string): Promise<Uint8Array> {
  const url = assertGlbUrl(glbUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        // Явный `cache` не передаём: под dev-сервером Next патченный fetch с ним
        // может зависнуть на внешнем запросе. Роут-вызыватель и так динамический.
      });
    } catch {
      throw new MeshFixerError(
        controller.signal.aborted
          ? `Скачивание модели заняло больше ${
              DOWNLOAD_TIMEOUT_MS / 1000
            } с.`
          : "Не удалось скачать модель: сеть недоступна.",
      );
    }

    if (!response.ok) {
      throw new MeshFixerError(
        `Не удалось скачать модель (HTTP ${response.status}): ` +
          errorDetail(await response.text()),
      );
    }

    const contentType = response.headers.get("content-type")?.toLowerCase();

    // По ссылке может прийти страница ошибки или JSON с отказом. Называть это
    // моделью нельзя: STL получился бы пустым.
    if (
      contentType?.includes("text/html") ||
      contentType?.includes("application/json")
    ) {
      throw new MeshFixerError(
        `По ссылке пришёл не файл модели (${contentType}).`,
      );
    }

    const declaredLength = Number(response.headers.get("content-length"));

    if (Number.isFinite(declaredLength) && declaredLength > MAX_GLB_BYTES) {
      throw new MeshFixerError(
        `Модель больше ${MAX_GLB_BYTES / 1024 / 1024} МБ.`,
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());

    if (bytes.length === 0) {
      throw new MeshFixerError("Сервис вернул пустой файл модели.");
    }

    if (bytes.length > MAX_GLB_BYTES) {
      throw new MeshFixerError(
        `Модель больше ${MAX_GLB_BYTES / 1024 / 1024} МБ.`,
      );
    }

    return bytes;
  } finally {
    clearTimeout(timer);
  }
}

/** Читает GLB в документ glTF вместе с расширениями Khronos. */
async function readDocument(glb: Uint8Array): Promise<Document> {
  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

  try {
    return await io.readBinary(glb);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "неизвестная ошибка";

    throw new MeshFixerError(`Не удалось разобрать GLB: ${reason}.`);
  }
}

/** Число треугольников во всех примитивах документа. */
function countTriangles(document: Document): number {
  let triangles = 0;

  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute("POSITION");

      if (primitive.getMode() !== GLTF_TRIANGLES || !position) {
        continue;
      }

      const indices = primitive.getIndices();

      triangles += (indices?.getCount() ?? position.getCount()) / 3;
    }
  }

  return Math.floor(triangles);
}

/**
 * Сварка, децимация и удаление дубликатов.
 *
 * Упрощение — самая хрупкая операция (WebAssembly внутри meshoptimizer падает
 * на вырожденных сетках), поэтому её сбой не валит запрос: модель остаётся
 * подробной, но пригодной для печати. А вот отсутствие геометрии — настоящая
 * ошибка, её ловит следующий шаг.
 */
async function prepareMesh(document: Document): Promise<void> {
  // `weld()` в актуальной версии склеивает только побитово совпавшие вершины:
  // режим с допуском убрали, поэтому опция `tolerance` больше не передаётся.
  await document.transform(weld());

  const before = countTriangles(document);

  if (before > MAX_TRIANGLES) {
    // `simplify` считает ratio по индексам, а не по треугольникам, но при
    // равномерной сетке доля совпадает — для потолка «около 100 000» хватает.
    const ratio = MAX_TRIANGLES / before;

    try {
      await document.transform(
        simplify({
          simplifier: MeshoptSimplifier,
          ratio,
          error: SIMPLIFY_ERROR,
        }),
      );
    } catch (error) {
      console.warn(
        "[mesh-fixer] Децимация не удалась, оставляем подробную сетку:",
        error,
      );
    }
  }

  await document.transform(dedup(), prune());

  console.info(
    "[mesh-fixer] Сетка после обработки:",
    before,
    "→",
    countTriangles(document),
    "треугольников",
  );
}

/** Переводит один примитив glTF в геометрию three.js с мировой матрицей. */
function primitiveToGeometry(
  primitive: Primitive,
  world: Matrix4,
): BufferGeometry | null {
  const position = primitive.getAttribute("POSITION");

  if (
    primitive.getMode() !== GLTF_TRIANGLES ||
    !position ||
    position.getElementSize() !== 3
  ) {
    return null;
  }

  const count = position.getCount();

  if (count === 0) {
    return null;
  }

  const positions = new Float32Array(count * 3);
  const element: number[] = [];

  // `getElement` раскодирует нормализованные целочисленные атрибуты, поэтому
  // работает и с квантованными сетками, а не только с float32.
  for (let index = 0; index < count; index += 1) {
    position.getElement(index, element);
    positions[index * 3] = element[0];
    positions[index * 3 + 1] = element[1];
    positions[index * 3 + 2] = element[2];
  }

  const sourceIndices = primitive.getIndices()?.getArray();

  // Индексов в примитиве обычно больше, чем вершин, и STLExporter читает их
  // тройками. Неполный последний треугольник отбрасываем: иначе экспортёр
  // запишет NaN и выйдет за границу буфера.
  const indexCount = sourceIndices
    ? sourceIndices.length - (sourceIndices.length % 3)
    : count - (count % 3);

  if (indexCount === 0) {
    return null;
  }

  const indices = new Uint32Array(indexCount);

  if (sourceIndices) {
    for (let index = 0; index < indexCount; index += 1) {
      indices[index] = sourceIndices[index];
    }
  } else {
    // Без индексов вершины идут подряд: STLExporter читает треугольники
    // тройками, поэтому индексы нужны даже неиндексированному примитиву.
    for (let index = 0; index < indexCount; index += 1) {
      indices[index] = index;
    }
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.applyMatrix4(world);

  return geometry;
}

/** Собирает все примитивы сцены в одну геометрию и приводит её к 120 мм. */
function buildPrintableGeometry(document: Document): BufferGeometry {
  const root = document.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];

  if (!scene) {
    throw new MeshFixerError("В модели нет сцены.");
  }

  const parts: BufferGeometry[] = [];

  scene.traverse((node) => {
    const mesh = node.getMesh();

    if (!mesh) {
      return;
    }

    const world = new Matrix4().fromArray(node.getWorldMatrix());

    for (const primitive of mesh.listPrimitives()) {
      const geometry = primitiveToGeometry(primitive, world);

      if (geometry) {
        parts.push(geometry);
      }
    }
  });

  if (parts.length === 0) {
    throw new MeshFixerError("В модели нет треугольной геометрии.");
  }

  const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);

  if (!merged) {
    throw new MeshFixerError("Не удалось объединить части модели.");
  }

  merged.computeBoundingBox();

  const bounds = merged.boundingBox;

  if (!bounds) {
    throw new MeshFixerError("Не удалось вычислить габариты модели.");
  }

  const size = bounds.getSize(new Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);

  if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
    throw new MeshFixerError("Модель получилась пустой.");
  }

  const scale = TARGET_MAX_DIMENSION_MM / maxDimension;

  merged.scale(scale, scale, scale);
  merged.computeBoundingBox();

  console.info(
    "[mesh-fixer] Масштаб:",
    maxDimension.toFixed(4),
    "→",
    TARGET_MAX_DIMENSION_MM,
    "мм, коэффициент",
    scale.toFixed(6),
  );

  return merged;
}

/** Экспортирует геометрию бинарным STL через серверный STLExporter. */
function exportStl(geometry: BufferGeometry): Uint8Array {
  const mesh = new Mesh(geometry);

  mesh.updateMatrixWorld(true);

  const view = new STLExporter().parse(mesh, { binary: true });

  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

/** Пишет файл атомарно: читатель не увидит наполовину записанный STL. */
async function saveStl(target: string, bytes: Uint8Array): Promise<void> {
  await mkdir(GENERATED_STL_DIR, { recursive: true });

  const partial = `${target}.${process.pid}-${Date.now()}.part`;

  await writeFile(partial, bytes);

  try {
    await rename(partial, target);
  } catch (error) {
    await unlink(partial).catch(() => undefined);

    // Параллельный запрос успел создать тот же файл — это не ошибка.
    if (!(await fileExists(target))) {
      throw error;
    }
  }
}

/**
 * Прогоняет сгенерированный GLB через «мясорубку» и возвращает путь к STL.
 *
 * Повторный вызов с той же ссылкой не пересобирает файл: имя детерминировано,
 * а готовый STL уже лежит во временной папке.
 */
export async function processGeneratedMesh(glbUrl: string): Promise<string> {
  const target = path.join(GENERATED_STL_DIR, stlFileNameFor(glbUrl));

  if (await fileExists(target)) {
    return target;
  }

  const glb = await downloadGlb(glbUrl);
  const document = await readDocument(glb);

  await prepareMesh(document);

  const geometry = buildPrintableGeometry(document);
  const stl = exportStl(geometry);

  await saveStl(target, stl);

  console.info("[mesh-fixer] STL готов:", target, stl.byteLength, "байт");

  return target;
}
