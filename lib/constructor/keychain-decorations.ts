import type { BufferGeometry } from "three";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  createKeychainImageGeometry,
  keychainImageBuild,
  placeKeychainImage,
  KEYCHAIN_DECORATION_GAP_MM,
  type KeychainImageBuild,
} from "@/lib/constructor/keychain-image";
import {
  buildFaceMask,
  createKeychainTextGeometry,
  measureKeychainTextBlock,
  placeKeychainText,
  stampFaceObstacle,
  type FaceMask,
  type KeychainTextKeepOut,
  type KeychainTextSide,
} from "@/lib/constructor/keychain-text";
import type {
  KeychainDecoration,
  KeychainDecorationKind,
  KeychainDecorationSide,
  KeychainFontId,
  KeychainParams,
} from "@/lib/constructor/params";

/**
 * Декорации на гранях брелока: постановка, конфликты и отчёт.
 *
 * Один конвейер на надпись, картинку и (через силуэт) QR-код. Правила простые и
 * одинаковые для всех видов:
 *
 *   1. Карта грани строится один раз на сторону (`buildFaceMask`) и общая для всех
 *      декораций этой стороны.
 *   2. Декорация ставится по карте: свободная полоса, ручное смещение, обрезка по
 *      кромке, отверстию и карману NFC.
 *   3. Готовый рельеф штампуется обратно в ту же карту с зазором
 *      `KEYCHAIN_DECORATION_GAP_MM` — так вторая декорация обходит первую, а не
 *      наезжает на буквы. Это и есть разрешение конфликтов: не пересечение
 *      объёмов, а вычитание занятых ячеек из свободного места.
 *   4. Не влезло — рельеф не печатается, а в отчёт уходит причина: панель
 *      показывает её вместо зелёной плашки.
 *
 * Порядок постановки — картинка, потом надпись, независимо от порядка в массиве.
 * Картинка крупнее и ужимается хуже (её пол может быть 25% запрошенного), а кегль
 * надписи подбирается по остатку полосы свободно. При обратном порядке логотип
 * ужимался бы до нечитаемой точки.
 */

/** Шрифты, загруженные к моменту сборки: ключ — шрифт из декорации. */
export type KeychainFontMap = Partial<Record<KeychainFontId, Font>>;

/**
 * Почему рельеф не напечатан.
 *
 * `empty` — в надписи нет букв, `font` — шрифт ещё не загрузился, `image` — маска
 * картинки не разобралась, `no_space` — на выбранной стороне нет свободного места,
 * `qr_face` — лицо занято кодом визитки, рельефов у неё нет вовсе.
 */
export type KeychainDecorationSkip =
  | "empty"
  | "font"
  | "image"
  | "no_space"
  | "qr_face";

/** Что вышло из одной декорации при сборке модели. */
export type KeychainDecorationFit = {
  id: string;
  kind: KeychainDecorationKind;
  /** Сторона, на которую встал рельеф; null — рельефа в модели нет. */
  side: KeychainTextSide | null;
  /** Кегль надписи или большая сторона картинки, мм. */
  size: number;
  /** Фактический масштаб запроса: у картинки меньше запрошенного, у текста 1. */
  scale: number;
  /** Запрошенный масштаб: у надписи всегда 1 — его задаёт свободная полоса. */
  requested: number;
  /** Причина отказа; null — рельеф в модели есть. */
  reason: KeychainDecorationSkip | null;
};

/** Отчёт сборки: по строке на декорацию. */
export type KeychainBuildReport = {
  decorations: KeychainDecorationFit[];
};

/** Порядок постановки: крупное и негибкое занимает место первым. */
const PLACEMENT_ORDER: readonly KeychainDecorationKind[] = ["image", "text"];

/** Стороны в порядке предпочтения: `auto` пробует лицо, потом оборот. */
function decorationSides(side: KeychainDecorationSide): KeychainTextSide[] {
  return side === "auto" ? ["front", "back"] : [side];
}

/**
 * Итог постановки: рельеф и строка отчёта либо причина отказа.
 *
 * Отдельный тип вместо `null`: причина нужна панели, иначе «не встало» и «шрифт не
 * загрузился» выглядели бы одинаково, а советы пользователю — противоположными.
 */
type KeychainPlacementOutcome =
  | { fit: KeychainDecorationFit; geometry: BufferGeometry }
  | { reason: KeychainDecorationSkip };

/** Карта стороны, построенная один раз на всю сборку. */
type SideMaskLookup = (side: KeychainTextSide) => FaceMask | null;

/**
 * Надпись на грань: свободная полоса, кегль, поворот и рельеф.
 *
 * Кегль выбирается по полосе, поэтому «не поместилось» бывает только когда полосы
 * нет вовсе (узкая шестерня, кирпич с шипами на обеих сторонах). Всё остальное
 * решается уменьшением кегля, а не ошибкой.
 */
function placeTextDecoration(
  body: BufferGeometry,
  params: KeychainParams,
  decoration: Extract<KeychainDecoration, { kind: "text" }>,
  fonts: KeychainFontMap | null,
  sideMask: SideMaskLookup,
): KeychainPlacementOutcome {
  const font = fonts?.[decoration.font] ?? null;

  if (!font) {
    return { reason: "font" };
  }

  const metrics = measureKeychainTextBlock({
    align: decoration.align,
    font,
    lineHeight: decoration.lineHeight,
    text: decoration.content,
  });

  if (!metrics) {
    return { reason: "empty" };
  }

  // Габарит проверки — габарит букв: рельеф выпуклый, плиты вокруг нет.
  for (const side of decorationSides(decoration.side)) {
    const mask = sideMask(side);

    if (!mask) {
      continue;
    }

    const placement = placeKeychainText(body, {
      mask,
      metrics,
      offsetX: decoration.offsetX,
      offsetY: decoration.offsetY,
      rotation: decoration.rotation,
      side,
    });

    const geometry = placement
      ? createTextRelief({
          centerX: placement.centerX,
          centerY: placement.centerY,
          decoration,
          font,
          side,
          size: placement.size,
          thickness: params.thickness,
        })
      : null;

    if (!placement || !geometry) {
      continue;
    }

    stampFaceObstacle(
      mask.blocked,
      mask.grid,
      geometry,
      KEYCHAIN_DECORATION_GAP_MM,
    );

    return {
      fit: {
        id: decoration.id,
        kind: decoration.kind,
        reason: null,
        requested: 1,
        scale: 1,
        side,
        size: placement.size,
      },
      geometry,
    };
  }

  return { reason: "no_space" };
}

/**
 * Картинка на грань: полоса, масштаб, поворот и рельеф.
 *
 * Запрошенный масштаб остаётся просьбой: при нехватке места логотип ужимается
 * шагом 5% до четверти базового размера, и в отчёт уходит фактическое значение.
 * Если и этого мало — рельеф не печатается, а причина уходит в панель.
 */
function placeImageDecoration(
  body: BufferGeometry,
  params: KeychainParams,
  decoration: Extract<KeychainDecoration, { kind: "image" }>,
  sideMask: SideMaskLookup,
): KeychainPlacementOutcome {
  const build = keychainImageBuild(
    decoration.imageData,
    decoration.imageThreshold,
  );

  if (!build) {
    return { reason: "image" };
  }

  for (const side of decorationSides(decoration.side)) {
    const mask = sideMask(side);

    if (!mask) {
      continue;
    }

    const placement = placeKeychainImage(body, {
      build,
      mask,
      offsetX: decoration.offsetX,
      offsetY: decoration.offsetY,
      rotation: decoration.rotation,
      scale: decoration.imageScale,
      side,
    });
    const geometry = placement
      ? createImageRelief({
          build,
          centerX: placement.centerX,
          centerY: placement.centerY,
          decoration,
          side,
          size: placement.size,
          thickness: params.thickness,
        })
      : null;

    if (!placement || !geometry) {
      continue;
    }

    stampFaceObstacle(
      mask.blocked,
      mask.grid,
      geometry,
      KEYCHAIN_DECORATION_GAP_MM,
    );

    return {
      fit: {
        id: decoration.id,
        kind: decoration.kind,
        reason: null,
        requested: placement.requested,
        scale: placement.actual,
        side,
        size: placement.size,
      },
      geometry,
    };
  }

  return { reason: "no_space" };
}

/** Строка отчёта для рельефа, которого в модели нет. */
function skippedFit(
  decoration: KeychainDecoration,
  reason: KeychainDecorationSkip,
): KeychainDecorationFit {
  return {
    id: decoration.id,
    kind: decoration.kind,
    reason,
    requested: decoration.kind === "image" ? decoration.imageScale : 1,
    scale: 0,
    side: null,
    size: 0,
  };
}

/**
 * Рельеф надписи: выпуклые буквы по контурам блока.
 *
 * Функция осталась обёрткой над `createKeychainTextGeometry`, потому что ставит
 * её конвейер: габарит, поворот и толщина приходят из постановки, а не из
 * параметров декорации.
 */
function createTextRelief(options: {
  centerX: number;
  centerY: number;
  decoration: Extract<KeychainDecoration, { kind: "text" }>;
  font: Font;
  side: KeychainTextSide;
  size: number;
  thickness: number;
}): BufferGeometry | null {
  const { decoration, font } = options;

  return createKeychainTextGeometry({
    align: decoration.align,
    centerX: options.centerX,
    centerY: options.centerY,
    depth: decoration.depth,
    font,
    lineHeight: decoration.lineHeight,
    rotation: decoration.rotation,
    side: options.side,
    size: options.size,
    text: decoration.content,
    thickness: options.thickness,
  });
}

/**
 * Рельеф картинки: выпуклая маска по контурам.
 *
 * Порог детализации уже применён при сборке маски (`keychainImageBuild`), здесь
 * остаются только размер и место.
 */
function createImageRelief(options: {
  build: KeychainImageBuild;
  centerX: number;
  centerY: number;
  decoration: Extract<KeychainDecoration, { kind: "image" }>;
  side: KeychainTextSide;
  size: number;
  thickness: number;
}): BufferGeometry | null {
  const { build, decoration } = options;

  return createKeychainImageGeometry({
    build,
    centerX: options.centerX,
    centerY: options.centerY,
    depth: decoration.depth,
    rotation: decoration.rotation,
    side: options.side,
    size: options.size,
    thickness: options.thickness,
  });
}

/**
 * Ставит все декорации на грани и приклеивает рельефы к телу.
 *
 * Карта стороны общая: каждый поставленный рельеф штампуется в неё с зазором, и
 * следующая декорация ищет место уже с учётом соседа. Поэтому буквы и картинка не
 * пересекаются ни на одной стороне, даже если пользователь сдвинул обе к центру.
 *
 * У визитки рельефов нет: её лицо занято кодом. Надпись и картинка остаются в
 * параметрах (при смене силуэта туда и обратно они возвращаются), но в модель не
 * попадают — отчёт говорит об этом причиной `qr_face`.
 *
 * `fonts` может быть неполным: пока JSON шрифта грузится, сцена показывает брелок
 * без букв, а отчёт помечает причину `font`. Серверный экспорт передаёт шрифты
 * всегда, поэтому файл и предпросмотр расходятся только на время загрузки.
 */
export function attachKeychainDecorations(
  body: BufferGeometry,
  params: KeychainParams,
  keepOut: readonly KeychainTextKeepOut[],
  fonts: KeychainFontMap | null,
  report?: KeychainBuildReport,
): BufferGeometry {
  const fits: KeychainDecorationFit[] = [];
  const parts: BufferGeometry[] = [];
  const masks = new Map<KeychainTextSide, FaceMask | null>();
  const sideMask = (side: KeychainTextSide): FaceMask | null => {
    if (!masks.has(side)) {
      masks.set(side, buildFaceMask(body, side, keepOut));
    }

    return masks.get(side) ?? null;
  };
  const isQrCard = params.keychainPreset === "qr-card";
  const ordered = [...params.decorations].sort(
    (first, second) =>
      PLACEMENT_ORDER.indexOf(first.kind) -
      PLACEMENT_ORDER.indexOf(second.kind),
  );

  for (const decoration of ordered) {
    // QR-код печатает силуэт визитки: у общего конвейера для него нет рельефа.
    if (decoration.kind === "qr") {
      continue;
    }

    if (isQrCard) {
      fits.push(skippedFit(decoration, "qr_face"));

      continue;
    }

    const outcome =
      decoration.kind === "image"
        ? placeImageDecoration(body, params, decoration, sideMask)
        : placeTextDecoration(body, params, decoration, fonts, sideMask);

    if ("reason" in outcome) {
      fits.push(skippedFit(decoration, outcome.reason));

      continue;
    }

    parts.push(outcome.geometry);
    fits.push(outcome.fit);
  }

  if (report) {
    report.decorations = fits;
  }

  if (parts.length === 0) {
    return body;
  }

  const merged = mergeGeometries([body, ...parts]);

  parts.forEach((part) => part.dispose());

  if (!merged) {
    throw new Error("Не удалось объединить брелок и его декорации");
  }

  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  body.dispose();

  return merged;
}
