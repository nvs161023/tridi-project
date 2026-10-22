import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
} from "three";

import {
  normalizeGiftBoxParams,
  type GiftBoxParams,
  type GiftBoxShape,
} from "@/lib/constructor/params";
import {
  addArcWall,
  addRingPrism,
  addRotatedBox,
  addSolidPrism,
  circlePolygon,
  offsetPoints,
  polygonAcrossFlats,
  type Point2,
} from "@/lib/constructor/prism-mesh";

/**
 * Геометрия подарочной коробки с потайными замками.
 *
 * Коробка — это дно со стенкой и крышка с юбкой, которая входит в корпус с
 * зазором 0.3 мм. Снаружи она выглядит обычной, а открывается только тем
 * способом, который выбран в параметрах:
 *
 * - винт: в углу корпуса стоит стойка с резьбовым отверстием, а в крышке над ней
 *   сквозное отверстие — крышку держит саморез, и без отвёртки её не снять;
 * - двойное дно: на четырёх полках лежит пластина, под ней тайник. Пластина
 *   снимается за палец через отверстие у края;
 * - лабиринт: в юбке крышки три язычка с проёмами, а на дне — стойка. Крышка
 *   садится только тогда, когда проём встал напротив стойки, а потом
 *   поворачивается до упора.
 *
 * Замки независимы по геометрии, но двойное дно и лабиринт занимают один и тот
 * же объём, поэтому нормализация параметров оставляет включённым только
 * лабиринт: пластина двойного дна перекрыла бы стойку.
 *
 * Булевых операций нет: корпус, крышка и пластина двойного дна — отдельные
 * замкнутые оболочки, которые печатаются рядом на столе. Деталь построена
 * Z-вверх, как её ждёт слайсер.
 */

/** Толщина стенки корпуса и юбки крышки, мм. */
const GIFT_WALL_MM = 2;
const GIFT_SKIRT_WALL_MM = 2;

/** Толщина дна корпуса, мм. */
const GIFT_FLOOR_MM = 2.5;

/** Высота корпуса как доля габарита и её границы, мм. */
const GIFT_BODY_RATIO = 0.45;
const GIFT_MIN_HEIGHT_MM = 30;
const GIFT_MAX_HEIGHT_MM = 80;

/** Толщина крышки и насколько она шире корпуса, мм. */
const GIFT_LID_MM = 3;
const GIFT_LID_EXTRA_MM = 1.5;

/** Высота юбки крышки, мм. */
const GIFT_SKIRT_MM = 8;

/** Зазор между юбкой и стенкой корпуса, мм. */
const GIFT_FIT_CLEARANCE_MM = 0.3;

/** Зазор между деталями на столе, мм. */
const GIFT_PART_GAP_MM = 12;

/** Резьбовая стойка: посадочный диаметр самореза и толщина стойки, мм. */
const GIFT_SCREW_BORE_MM = 1.9;
const GIFT_SCREW_BOSS_MM = 5;
const GIFT_SCREW_HOLE_MM = 2.4;

/** Где стоит стойка под винт: доля внутреннего радиуса и угол. */
const GIFT_SCREW_RADIUS_RATIO = 0.62;

/** Двойное дно: толщина пластины, высота полки и её размеры, мм. */
const GIFT_FALSE_FLOOR_MM = 2;
const GIFT_FALSE_HEIGHT_MM = 16;
const GIFT_FALSE_PICK_MM = 5;
const GIFT_LEDGE_WIDTH_MM = 10;
const GIFT_LEDGE_DEPTH_MM = 5;

/** Лабиринт: два барабана с проёмами и два штыря в крышке, мм. */
const GIFT_MAZE_INNER_COLLAR_MM = 15;
const GIFT_MAZE_OUTER_COLLAR_MM = 20;
const GIFT_MAZE_COLLAR_THICKNESS_MM = 2.8;

/** Ширина проёма в барабане в градусах и углы проёмов. */
const GIFT_MAZE_GAP_DEGREES = 40;
const GIFT_MAZE_INNER_GAPS = [0, 120, 240];
const GIFT_MAZE_OUTER_GAP = 90;

/** Штырь крышки: радиус, длина и углы, под которыми он стоит. */
const GIFT_MAZE_PIN_MM = 2.2;
const GIFT_MAZE_PIN_LENGTH_MM = 11;
const GIFT_MAZE_PIN_ANGLES = [0, 90];

/** Насколько барабаны не доходят до кромки корпуса, мм. */
const GIFT_MAZE_RIM_MM = 1;

/** Число сторон круглого сечения: 64 отрезка дают гладкую стенку. */
const GIFT_ROUND_SIDES = 64;

/** Число сторон сечения по форме: квадрат и шестигранник точные. */
const GIFT_SIDES: Record<GiftBoxShape, number> = {
  round: GIFT_ROUND_SIDES,
  square: 4,
  hex: 6,
};

/** Ограничивает значение отрезком: остальные детали считают так же. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Сечение детали в плане.
 *
 * `acrossFlats` — габарит «под ключ»: у круга это диаметр, у квадрата и
 * шестигранника — габарит. Квадрат повёрнут на 45°, чтобы его грани смотрели по
 * осям, как у кашпо и коробки.
 */
function sectionPolygon(shape: GiftBoxShape, acrossFlats: number): Point2[] {
  const sides = GIFT_SIDES[shape];
  const start = shape === "square" ? Math.PI / 4 : 0;

  return polygonAcrossFlats(acrossFlats, sides, start);
}

/**
 * Плита с круглыми отверстиями.
 *
 * Контур и отверстия вырезает `ExtrudeGeometry`, поэтому плита остаётся одной
 * замкнутой деталью. Так строятся крышка с отверстием под винт и пластина
 * двойного дна с пальцевым вырезом.
 */
function addPlateWithHoles(
  positions: number[],
  outline: readonly Point2[],
  holes: readonly { readonly radius: number; readonly x: number; readonly y: number }[],
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

  holes.forEach((hole) => {
    const path = new Path();

    path.absarc(hole.x, hole.y, hole.radius, 0, Math.PI * 2, false);
    shape.holes.push(path);
  });

  const plate = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 16,
    depth: thickness,
    steps: 1,
  });

  plate.translate(0, 0, z0);

  const attribute = plate.getAttribute("position");

  for (let index = 0; index < attribute.count; index += 1) {
    positions.push(
      attribute.getX(index),
      attribute.getY(index),
      attribute.getZ(index),
    );
  }

  plate.dispose();
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
 * Собирает подарочную коробку с потайными замками в одну сетку.
 *
 * Порядок раскладки на столе: пластина двойного дна, корпус, крышка. Пластина
 * печатается только когда выбрано двойное дно.
 */
export function createGiftBoxGeometry(
  params: Partial<GiftBoxParams>,
): BufferGeometry {
  const normalized = normalizeGiftBoxParams(params);
  const size = normalized.giftSize;
  const shape = normalized.giftShape;
  const innerSize = size - GIFT_WALL_MM * 2;
  const innerHalf = innerSize / 2;
  const bodyHeight = clamp(
    size * GIFT_BODY_RATIO,
    GIFT_MIN_HEIGHT_MM,
    GIFT_MAX_HEIGHT_MM,
  );
  const positions: number[] = [];

  // Корпус: дно-плита и стенка-кольцо, которая входит в дно на полмиллиметра.
  addSolidPrism(positions, sectionPolygon(shape, size), 0, GIFT_FLOOR_MM);
  addRingPrism(
    positions,
    sectionPolygon(shape, size),
    sectionPolygon(shape, innerSize),
    GIFT_FLOOR_MM - 0.5,
    bodyHeight,
  );

  // Стойка под саморез: во всю высоту корпуса, иначе винт до неё не достанет.
  const screwRadius = innerHalf * GIFT_SCREW_RADIUS_RATIO;
  const screwX = screwRadius * Math.cos(Math.PI / 4);
  const screwY = screwRadius * Math.sin(Math.PI / 4);

  if (normalized.giftScrewLock) {
    addRingPrism(
      positions,
      offsetPoints(circlePolygon(GIFT_SCREW_BOSS_MM, 32), screwX, screwY),
      offsetPoints(circlePolygon(GIFT_SCREW_BORE_MM, 32), screwX, screwY),
      GIFT_FLOOR_MM - 0.5,
      bodyHeight,
    );
  }

  // Барабаны лабиринта: две стенки с проёмами. Проёмы разнесены по углам так,
  // что штыри крышки попадают в них одновременно только в одном положении:
  // внутренний барабан пускает через каждый из трёх проёмов, внешний — только
  // через один, и вместе они задают единственную посадку.
  if (normalized.giftMazeLock) {
    const gap = (GIFT_MAZE_GAP_DEGREES * Math.PI) / 180;
    const collars: readonly {
      readonly radius: number;
      readonly gaps: readonly number[];
    }[] = [
      { gaps: GIFT_MAZE_INNER_GAPS, radius: GIFT_MAZE_INNER_COLLAR_MM },
      { gaps: [GIFT_MAZE_OUTER_GAP], radius: GIFT_MAZE_OUTER_COLLAR_MM },
    ];

    collars.forEach(({ gaps, radius }) => {
      const step = (Math.PI * 2) / gaps.length;

      gaps.forEach((degrees) => {
        const center = (degrees * Math.PI) / 180;
        const start = center + gap / 2;
        const end = center + step - gap / 2;

        if (end <= start) {
          return;
        }

        addArcWall(
          positions,
          0,
          0,
          radius,
          radius + GIFT_MAZE_COLLAR_THICKNESS_MM,
          start,
          end,
          GIFT_FLOOR_MM - 0.5,
          bodyHeight - GIFT_MAZE_RIM_MM,
          Math.max(Math.round(((end - start) / (Math.PI * 2)) * 48), 2),
        );
      });
    });
  }

  // Полки двойного дна: четыре выступа у стенки, на них лежит пластина.
  const falseZ = GIFT_FLOOR_MM + GIFT_FALSE_HEIGHT_MM;

  if (normalized.giftFalseBottom) {
    const ledgeRadius = innerHalf - GIFT_LEDGE_DEPTH_MM / 2 + 0.5;
    const ledgeHalfDepth = GIFT_LEDGE_DEPTH_MM / 2 + 0.5;

    for (let index = 0; index < 4; index += 1) {
      const angle = (Math.PI / 2) * index;

      addRotatedBox(
        positions,
        ledgeRadius * Math.cos(angle),
        ledgeRadius * Math.sin(angle),
        angle,
        GIFT_LEDGE_WIDTH_MM / 2,
        ledgeHalfDepth,
        falseZ - 2.5,
        falseZ + 0.5,
      );
    }
  }

  // Деталь 2: пластина двойного дна. Печатается рядом с корпусом.
  const falseOffset = -(size + GIFT_PART_GAP_MM);
  const falsePlate: number[] = [];

  if (normalized.giftFalseBottom) {
    const holes: {
      readonly radius: number;
      readonly x: number;
      readonly y: number;
    }[] = [
      {
        radius: GIFT_FALSE_PICK_MM,
        x: 0,
        y: -innerHalf * 0.55,
      },
    ];

    if (normalized.giftScrewLock) {
      holes.push({
        radius: GIFT_SCREW_BOSS_MM + 0.4,
        x: screwX,
        y: screwY,
      });
    }

    addPlateWithHoles(
      falsePlate,
      sectionPolygon(shape, innerSize + 2),
      holes,
      0,
      GIFT_FALSE_FLOOR_MM,
    );
  }

  // Деталь 3: крышка — плита с юбкой и штырями лабиринта.
  const lidOffset = size + GIFT_PART_GAP_MM;
  const lid: number[] = [];
  const lidOutline = sectionPolygon(shape, size + GIFT_LID_EXTRA_MM);

  if (normalized.giftScrewLock) {
    addPlateWithHoles(
      lid,
      lidOutline,
      [{ radius: GIFT_SCREW_HOLE_MM, x: screwX, y: screwY }],
      0,
      GIFT_LID_MM,
    );
  } else {
    addSolidPrism(lid, lidOutline, 0, GIFT_LID_MM);
  }

  // Юбка входит внутрь корпуса с зазором и держит крышку от сдвига.
  const skirtOuter = innerSize - GIFT_FIT_CLEARANCE_MM;

  addRingPrism(
    lid,
    sectionPolygon(shape, skirtOuter),
    sectionPolygon(shape, skirtOuter - GIFT_SKIRT_WALL_MM * 2),
    GIFT_LID_MM - 1,
    GIFT_LID_MM - 1 + GIFT_SKIRT_MM,
  );

  // Штыри лабиринта стоят на внутренней стороне крышки: при посадке они входят
  // в барабаны и держат крышку, пока проёмы не совпадут.
  if (normalized.giftMazeLock) {
    GIFT_MAZE_PIN_ANGLES.forEach((degrees, index) => {
      const angle = (degrees * Math.PI) / 180;
      const radius =
        (index === 0 ? GIFT_MAZE_INNER_COLLAR_MM : GIFT_MAZE_OUTER_COLLAR_MM) +
        GIFT_MAZE_COLLAR_THICKNESS_MM / 2;

      addSolidPrism(
        lid,
        offsetPoints(
          circlePolygon(GIFT_MAZE_PIN_MM, 24),
          radius * Math.cos(angle),
          radius * Math.sin(angle),
        ),
        GIFT_LID_MM - 0.6,
        GIFT_LID_MM - 0.6 + GIFT_MAZE_PIN_LENGTH_MM,
      );
    });
  }

  shiftPositions(positions, falsePlate, falseOffset);
  shiftPositions(positions, lid, lidOffset);

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
