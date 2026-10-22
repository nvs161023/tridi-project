import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
} from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";

import {
  normalizeCipherBoxParams,
  type CipherBoxParams,
} from "@/lib/constructor/params";
import {
  addArcWall,
  addRingPrism,
  addRotatedBox,
  addSolidPrism,
  circlePolygon,
  roundedRectanglePolygon,
  type Point2,
} from "@/lib/constructor/prism-mesh";

/**
 * Геометрия шкатулки с кодовым замком.
 *
 * Внутри корпуса стоит трубка-ось, на ней — кольца с буквами кода. Кольца надеты
 * с зазором 0.25 мм и печатаются на месте: после печати каждое проворачивается
 * пальцем. Крышка-пластина ложится на кромку корпуса и надевается на трубку, а
 * сверху её держит колпачок: в его юбке по прорези на каждое кольцо, и колпачок
 * снимается только тогда, когда язычки всех колец встали напротив прорезей.
 * Язычки разнесены по кругу, поэтому «код» — это буквы, собравшие язычки в ряд.
 *
 * Как у коробки и кашпо, булевых операций нет: корпус, крышка и колпачок —
 * отдельные замкнутые оболочки, которые печатаются рядом на столе с зазором
 * 12 мм. Деталь построена Z-вверх, как её ждёт слайсер.
 */

/** Толщина стенки и дна корпуса, мм. */
const CIPHER_WALL_MM = 3;

/** Толщина дна, мм. */
const CIPHER_FLOOR_MM = 3;

/** Радиус скругления углов корпуса, мм. */
const CIPHER_CORNER_MM = 8;

/** Высота корпуса как доля габарита и её границы, мм. */
const CIPHER_BODY_RATIO = 0.42;
const CIPHER_MIN_HEIGHT_MM = 34;
const CIPHER_MAX_HEIGHT_MM = 64;

/** Толщина стенки трубки-оси, мм. */
const CIPHER_TUBE_WALL_MM = 3;

/** Радиальный зазор между трубкой и кольцом кода, мм. */
const CIPHER_RING_CLEARANCE_MM = 0.25;

/** Осевой зазор между кольцами, мм: кольца печатаются свободно. */
const CIPHER_RING_GAP_MM = 0.6;

/** Высота кольца кода, мм, и её нижняя граница. */
const CIPHER_RING_HEIGHT_MM = 9;
const CIPHER_RING_MIN_HEIGHT_MM = 5.5;

/** Насколько трубка выступает над кромкой корпуса, мм. */
const CIPHER_TUBE_RISE_MM = 6;

/** Ширина и толщина пада с буквой, мм. */
const CIPHER_PAD_WIDTH_MM = 10;
const CIPHER_PAD_MM = 1.8;

/** Высота рельефа буквы и запас, на который она входит в пад, мм. */
const CIPHER_LETTER_RELIEF_MM = 1;
const CIPHER_LETTER_EMBED_MM = 0.4;

/** Зазор между деталями на столе, мм. */
const CIPHER_PART_GAP_MM = 12;

/** Толщина крышки-пластины и колпачка, мм. */
const CIPHER_LID_MM = 3;

/** Высота юбки колпачка и толщина её стенки, мм. */
const CIPHER_SKIRT_MM = 10;
const CIPHER_SKIRT_WALL_MM = 2.2;

/** Сколько градусов занимает прорезь в юбке колпачка. */
const CIPHER_SLOT_DEGREES = 22;

/** Вылет язычка за кольцо, его ширина и высота, мм. */
const CIPHER_TAB_MM = 5;
const CIPHER_TAB_WIDTH_MM = 8;
const CIPHER_TAB_HEIGHT_MM = 4.4;

/** Толщина перегородок для украшений и их высота как доля корпуса. */
const CIPHER_DIVIDER_MM = 2.4;
const CIPHER_DIVIDER_RATIO = 0.6;

/** Число сторон круглых сечений: 64 отрезка дают гладкое кольцо. */
const CIPHER_ROUND_SIDES = 64;

/** Высота подписи на крышке как доля габарита. */
const CIPHER_LID_TEXT_RATIO = 0.09;

/** Ограничивает значение отрезком: остальные детали считают так же. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Наружный контур корпуса в плане. */
function bodyOutline(size: number): Point2[] {
  return roundedRectanglePolygon(size, size, CIPHER_CORNER_MM);
}

/**
 * Радиус трубки-оси.
 *
 * Трубка занимает пятую часть габарита: на 70 мм корпусе это 14 мм, на 160 мм —
 * 32 мм. Кольцо кода шире трубки на 7 мм, поэтому пад с буквой помещается на
 * любом размере.
 */
function tubeRadius(size: number): number {
  return clamp(size * 0.2, 14, 32);
}

/**
 * Высота кольца под заданное число колец.
 *
 * Стекло колец обязано уйти под кромку корпуса: крышка ложится на кромку, и
 * верхнее кольцо не должно её подпирать. Поэтому на маленьком корпусе с тремя
 * кольцами кольца чуть ниже, а на большом остаются в полную высоту.
 */
function ringHeight(bodyHeight: number, count: number): number {
  const available =
    bodyHeight - CIPHER_FLOOR_MM - CIPHER_RING_GAP_MM * (count - 1) - 2;
  const height = available / count;

  return clamp(height, CIPHER_RING_MIN_HEIGHT_MM, CIPHER_RING_HEIGHT_MM);
}

/** Переписывает вершины готовой сетки в общий массив. */
function appendGeometry(positions: number[], source: BufferGeometry): void {
  const attribute = source.getAttribute("position");

  for (let index = 0; index < attribute.count; index += 1) {
    positions.push(
      attribute.getX(index),
      attribute.getY(index),
      attribute.getZ(index),
    );
  }
}

/**
 * Плита с круглым отверстием.
 *
 * Контур и отверстие вырезает `ExtrudeGeometry`, поэтому плита остаётся одной
 * замкнутой деталью. Так строятся крышка шкатулки с окном под трубку и дно
 * подарочной коробки с отверстием под потайной винт.
 */
function addPlateWithHole(
  positions: number[],
  outline: readonly Point2[],
  holeRadius: number,
  holeX: number,
  holeY: number,
  z0: number,
  thickness: number,
): void {
  const shape = new Shape();

  outline.forEach(([x, y], index) => {
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });
  shape.closePath();

  const hole = new Path();

  hole.absarc(holeX, holeY, holeRadius, 0, Math.PI * 2, false);
  shape.holes.push(hole);

  const plate = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 16,
    depth: thickness,
    steps: 1,
  });

  plate.translate(0, 0, z0);
  appendGeometry(positions, plate);
  plate.dispose();
}

/**
 * Глиф нужного кегля, вписанный в площадку.
 *
 * `TextGeometry` строит буквы от базовой линии, а ширина зависит от символа:
 * «Ш» вдвое шире «I». Поэтому сетка измеряется и масштабируется по меньшему из
 * двух ограничений, а центр переносится в начало координат — так буква встаёт на
 * пад кольца или на крышку без ручной подгонки.
 */
function createGlyphGeometry(
  text: string,
  font: Font,
  maxWidth: number,
  maxHeight: number,
  depth: number,
): BufferGeometry | null {
  const geometry = new TextGeometry(text, {
    bevelEnabled: false,
    curveSegments: 6,
    depth,
    font,
    size: Math.max(maxHeight, 1),
  });

  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (!box) {
    geometry.dispose();
    return null;
  }

  const width = box.max.x - box.min.x;
  const height = box.max.y - box.min.y;

  if (!(width > 0) || !(height > 0)) {
    geometry.dispose();
    return null;
  }

  const scale = Math.min(maxWidth / width, maxHeight / height);

  if (!Number.isFinite(scale) || scale <= 0) {
    geometry.dispose();
    return null;
  }

  geometry.scale(scale, scale, 1);
  geometry.computeBoundingBox();

  const scaled = geometry.boundingBox;

  if (!scaled) {
    geometry.dispose();
    return null;
  }

  geometry.translate(
    -(scaled.min.x + scaled.max.x) / 2,
    -(scaled.min.y + scaled.max.y) / 2,
    0,
  );

  return geometry;
}

/**
 * Буква кода на лицевой грани пада.
 *
 * Глиф ставится на вертикальную плоскость: рисунок смотрит в +Y, верх буквы — в
 * +Z. Пара поворотов переводит плоскость текста в плоскость пада, а рельеф
 * уходит наружу на миллиметр и на 0.4 мм входит в пад, чтобы буква не оторвалась
 * от кольца.
 */
function addRingLetter(
  positions: number[],
  char: string,
  font: Font,
  faceY: number,
  centerZ: number,
  maxWidth: number,
  maxHeight: number,
): void {
  const geometry = createGlyphGeometry(
    char,
    font,
    maxWidth,
    maxHeight,
    CIPHER_LETTER_RELIEF_MM + CIPHER_LETTER_EMBED_MM,
  );

  if (!geometry) {
    return;
  }

  geometry.rotateX(Math.PI / 2);
  geometry.rotateZ(Math.PI);
  geometry.translate(0, faceY, centerZ);
  appendGeometry(positions, geometry);
  geometry.dispose();
}

/**
 * Подпись на крышке шкатулки.
 *
 * Крышка печатается лицом вверх и так же ставится на корпус, поэтому надпись
 * остаётся видимой. Буквы развёрнуты на 180°: к зрителю, который смотрит на
 * шкатулку спереди, текст повёрнут лицом, а не вверх ногами.
 */
function addLidText(
  positions: number[],
  text: string,
  font: Font,
  maxWidth: number,
  maxHeight: number,
  centerY: number,
): void {
  const trimmed = text.trim();

  if (!trimmed) {
    return;
  }

  const geometry = createGlyphGeometry(
    trimmed,
    font,
    maxWidth,
    maxHeight,
    CIPHER_LETTER_RELIEF_MM + CIPHER_LETTER_EMBED_MM,
  );

  if (!geometry) {
    return;
  }

  geometry.rotateZ(Math.PI);
  geometry.translate(0, centerY, CIPHER_LID_MM - CIPHER_LETTER_EMBED_MM);
  appendGeometry(positions, geometry);
  geometry.dispose();
}

/** Сдвигает готовую деталь по X и дописывает её в общий массив. */
function shiftPositions(
  target: number[],
  source: readonly number[],
  offsetX: number,
): void {
  for (let index = 0; index < source.length; index += 3) {
    target.push(source[index] + offsetX, source[index + 1], source[index + 2]);
  }
}

/**
 * Собирает шкатулку с кодовым замком в одну сетку.
 *
 * `font = null` допустим для предпросмотра, пока JSON шрифта ещё грузится: кольца
 * и пады видны, а буквы появятся после загрузки. Серверный экспорт передаёт
 * шрифт всегда.
 */
export function createCipherBoxGeometry(
  params: Partial<CipherBoxParams>,
  font: Font | null = null,
): BufferGeometry {
  const normalized = normalizeCipherBoxParams(params);
  const size = normalized.cipherSize;
  const half = size / 2;
  const bodyHeight = clamp(
    size * CIPHER_BODY_RATIO,
    CIPHER_MIN_HEIGHT_MM,
    CIPHER_MAX_HEIGHT_MM,
  );
  const innerHalf = half - CIPHER_WALL_MM;
  const tube = tubeRadius(size);
  const tubeBore = tube - CIPHER_TUBE_WALL_MM;
  const ringOuter = tube + 7;
  const ringInner = tube + CIPHER_RING_CLEARANCE_MM;
  const letters = Array.from(normalized.cipherWord);
  const height = ringHeight(bodyHeight, letters.length);
  const positions: number[] = [];

  // Корпус: дно и стенка. Дно — сплошная плита, стенка — кольцо-призма, которое
  // входит в дно на полмиллиметра: оболочки замкнуты по отдельности.
  addSolidPrism(positions, bodyOutline(size), 0, CIPHER_FLOOR_MM);
  addRingPrism(
    positions,
    bodyOutline(size),
    bodyOutline(size - CIPHER_WALL_MM * 2),
    CIPHER_FLOOR_MM - 0.5,
    bodyHeight,
  );

  // Трубка-ось: открыта сверху, снизу закрыта дном корпуса.
  addRingPrism(
    positions,
    circlePolygon(tube, CIPHER_ROUND_SIDES),
    circlePolygon(tubeBore, CIPHER_ROUND_SIDES),
    CIPHER_FLOOR_MM - 0.5,
    bodyHeight + CIPHER_TUBE_RISE_MM,
  );

  // Перегородки для украшений: четыре радиальные стенки вокруг трубки.
  if (normalized.cipherInserts) {
    const dividerInner = ringOuter + 6;
    const dividerOuter = innerHalf - 3;
    const dividerDepth = (dividerOuter - dividerInner) / 2;
    const dividerTop =
      CIPHER_FLOOR_MM + (bodyHeight - CIPHER_FLOOR_MM) * CIPHER_DIVIDER_RATIO;

    if (dividerDepth > 1) {
      for (let index = 0; index < 4; index += 1) {
        const angle = Math.PI / 4 + (Math.PI / 2) * index;
        const radius = dividerInner + dividerDepth;

        addRotatedBox(
          positions,
          radius * Math.cos(angle),
          radius * Math.sin(angle),
          angle,
          CIPHER_DIVIDER_MM / 2,
          dividerDepth,
          CIPHER_FLOOR_MM - 0.5,
          dividerTop,
        );
      }
    }
  }

  // Кольца кода: каждое висит на трубке с зазором и ни с чем не сплавлено.
  const ringCount = letters.length;
  const ringBottom = CIPHER_FLOOR_MM - 0.4;
  const padHalf = CIPHER_PAD_MM / 2 + 0.4;
  const padCenterY = ringOuter + CIPHER_PAD_MM / 2;
  const padFace = padCenterY + padHalf;
  const tabHalf = CIPHER_TAB_MM / 2 + 0.5;
  const tabRadius = ringOuter + CIPHER_TAB_MM / 2 - 0.5;

  for (let index = 0; index < ringCount; index += 1) {
    const z0 = ringBottom + index * (height + CIPHER_RING_GAP_MM);
    const z1 = z0 + height;
    const centerZ = (z0 + z1) / 2;
    // Язычки соседних колец разнесены на равный шаг и сдвинуты от пада на
    // половину шага: собранные в один ряд, они открывают прорези колпачка.
    const tabAngle =
      Math.PI / 2 + Math.PI / ringCount + (Math.PI * 2 * index) / ringCount;

    addRingPrism(
      positions,
      circlePolygon(ringOuter, CIPHER_ROUND_SIDES),
      circlePolygon(ringInner, CIPHER_ROUND_SIDES),
      z0,
      z1,
    );

    // Пад с буквой на лицевой стороне: он защищает рельеф от стирания.
    addRotatedBox(
      positions,
      0,
      padCenterY,
      Math.PI,
      CIPHER_PAD_WIDTH_MM / 2,
      padHalf,
      z0 + 0.6,
      z1 - 0.6,
    );

    if (font) {
      addRingLetter(
        positions,
        letters[index],
        font,
        padFace - CIPHER_LETTER_EMBED_MM,
        centerZ,
        CIPHER_PAD_WIDTH_MM - 2,
        height - 1.6,
      );
    }

    // Язычок не выходит за верх кольца, иначе задевал бы соседнее кольцо.
    addRotatedBox(
      positions,
      tabRadius * Math.cos(tabAngle),
      tabRadius * Math.sin(tabAngle),
      tabAngle,
      CIPHER_TAB_WIDTH_MM / 2,
      tabHalf,
      z1 - CIPHER_TAB_HEIGHT_MM,
      z1,
    );
  }

  // Деталь 2: крышка-пластина с окном под трубку, рядом с корпусом.
  const lidOffset = size + CIPHER_PART_GAP_MM;
  const lidHole = ringOuter + 2.4;
  const lid: number[] = [];

  addPlateWithHole(lid, bodyOutline(size), lidHole, 0, 0, 0, CIPHER_LID_MM);

  if (font) {
    const textBottom = lidHole + CIPHER_LETTER_EMBED_MM + 1.1;
    const textTop = half - 2.5;
    const textHeight = Math.min(
      textTop - textBottom,
      size * CIPHER_LID_TEXT_RATIO,
    );

    if (textHeight > 2) {
      addLidText(
        lid,
        normalized.cipherLidText,
        font,
        size - 10,
        textHeight,
        (textBottom + textTop) / 2,
      );
    }
  }

  // Деталь 3: колпачок — пластина, юбка с прорезями и шип в трубку.
  const capRadius = ringOuter + 7;
  const capOffset = size * 2 + CIPHER_PART_GAP_MM * 2;
  const cap: number[] = [];

  addSolidPrism(
    cap,
    circlePolygon(capRadius, CIPHER_ROUND_SIDES),
    0,
    CIPHER_LID_MM,
  );
  addSolidPrism(
    cap,
    circlePolygon(tubeBore - 0.4, CIPHER_ROUND_SIDES),
    CIPHER_LID_MM - 0.6,
    CIPHER_LID_MM + 8,
  );

  const skirtInner = ringOuter + 0.3;
  const skirtOuter = skirtInner + CIPHER_SKIRT_WALL_MM;
  const slot = (CIPHER_SLOT_DEGREES * Math.PI) / 180;

  for (let index = 0; index < ringCount; index += 1) {
    const slotAngle =
      Math.PI / 2 + Math.PI / ringCount + (Math.PI * 2 * index) / ringCount;
    const start = slotAngle + slot / 2;
    const end = slotAngle + (Math.PI * 2) / ringCount - slot / 2;

    if (end <= start) {
      continue;
    }

    addArcWall(
      cap,
      0,
      0,
      skirtInner,
      skirtOuter,
      start,
      end,
      CIPHER_LID_MM - 1,
      CIPHER_LID_MM - 1 + CIPHER_SKIRT_MM,
      Math.max(Math.round(((end - start) / (Math.PI * 2)) * 48), 2),
    );
  }

  // Раскладка на столе: корпус, крышка справа, колпачок ещё правее.
  shiftPositions(positions, lid, lidOffset);
  shiftPositions(positions, cap, capOffset);

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
