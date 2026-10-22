import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
} from "three";

import {
  normalizeClipsParams,
  type ClipsParams,
} from "@/lib/constructor/params";

/**
 * Геометрия клипс для кабелей.
 *
 * Набор — общая планка и ряд C-образных зажимов на ней. Кабель входит в разрез
 * сверху с нажимом и держится дугой в 240°: защёлки нет, поэтому шнур можно
 * вынуть одной рукой. Внутренний диаметр больше кабеля на 0.3 мм на сторону —
 * при таком зазоре шнур не закусывает, а трение всё равно держит.
 *
 * Зажимы стоят на общей планке, поэтому набор печатается одной деталью и не
 * разъезжается по столу. Каждый зажим снизу срезан хордой: он опирается на
 * планку площадкой, а не висит в воздухе. Печатается набор без поддержек —
 * разрез смотрит вверх, поэтому нависающих участков над столом нет.
 *
 * Устройство повторяет коробку: зажимы — отдельные замкнутые тела, которые
 * входят в планку на CLIPS_JOIN_MM. Булевых операций в проекте нет, слайсер
 * объединяет пересекающиеся оболочки при печати, а каждая из них watertight.
 *
 * Деталь построена Z-вверх, как её ждёт слайсер: кабель ложится вдоль X,
 * планка — в плоскости XY, разрез смотрит в +Z. Предпросмотр поворачивает меш
 * так же, как корпус коробки.
 */

/** Толщина планки, мм. */
export const CLIPS_BASE_MM = 3;

/** Ширина зажима вдоль кабеля, мм. */
export const CLIPS_WIDTH_MM = 6;

/** Зазор между кабелем и зажимом на сторону, мм. */
const CLIPS_CLEARANCE_MM = 0.3;

/** Толщина стенки зажима, мм: её держит сопло 0.4 мм тремя периметрами. */
const CLIPS_WALL_MM = 2.6;

/** Плоская площадка под зажимом, мм: на ней зажим стоит на планке. */
const CLIPS_FOOT_MM = 1.2;

/** Насколько центр кольца приподнят над планкой, мм. */
const CLIPS_LIFT_MM = CLIPS_WALL_MM - CLIPS_FOOT_MM;

/** Насколько зажим входит в планку, мм. */
const CLIPS_JOIN_MM = 0.4;

/** Запас планки за боковым краем зажима, мм. */
const CLIPS_BASE_MARGIN_MM = 2;

/** Запас длины планки за крайними зажимами, мм. */
const CLIPS_EDGE_MM = 3;

/** Полный угол разреза, градусы: дуга в 240° держит кабель, 120° — на вход. */
const CLIPS_OPENING_DEG = 120;

/** Число отрезков на полный круг дуг: от него зависит гладкость зажима. */
const CLIPS_ARC_SEGMENTS = 72;

/** Точка профиля: поперёк кабеля и высота над столом, мм. */
type ProfilePoint = readonly [number, number];


/**
 * Добавляет точки дуги от угла `from` до угла `to` включительно.
 *
 * Угол отсчитывается от вертикали вверх и растёт в сторону +u: точка дуги —
 * (r·sin φ, r·cos φ). Концы соседних дуг не дублируются, поэтому в контуре
 * зажима нет совпадающих вершин и вырожденных граней.
 */
function appendArc(
  points: ProfilePoint[],
  radius: number,
  from: number,
  to: number,
): void {
  const span = Math.abs(to - from);
  const steps = Math.max(
    2,
    Math.round((span / (Math.PI * 2)) * CLIPS_ARC_SEGMENTS),
  );

  for (let index = 0; index <= steps; index += 1) {
    const angle = from + ((to - from) * index) / steps;

    points.push([radius * Math.sin(angle), radius * Math.cos(angle)]);
  }
}

/**
 * Контур зажима: центр кольца в нуле, разрез смотрит вверх.
 *
 * Точки идут по внешней дуге, по хорде снизу и обратно по внутренней дуге —
 * контур простой, без самопересечений. Хорда заменяет нижнюю часть дуги: её
 * высота равна площадке, поэтому зажим ложится на планку плоским дном, а не
 * касается её одной точкой.
 */
function clipOutline(inner: number, outer: number): ProfilePoint[] {
  const points: ProfilePoint[] = [];
  const half = ((CLIPS_OPENING_DEG / 2) * Math.PI) / 180;
  const end = Math.PI * 2 - half;
  const chord = Math.acos(-(outer - CLIPS_FOOT_MM) / outer);

  appendArc(points, outer, half, chord);
  appendArc(points, outer, Math.PI * 2 - chord, end);
  appendArc(points, inner, end, half);

  return points;
}

/**
 * Выдавливает замкнутый профиль по длине детали.
 *
 * Профиль строится в плоскости XY и выдавливается по Z: (u, v, w) — поперёк
 * кабеля, высота и длина вдоль кабеля. Для STL нужна высота по Z, поэтому оси
 * переставляются циклом (x, y, z) → (z, x, y): определитель такой
 * перестановки +1, обход граней не переворачивается, а сетка остаётся
 * замкнутой.
 */
function addProfile(
  positions: number[],
  points: readonly ProfilePoint[],
  from: number,
  to: number,
): void {
  const shape = new Shape();

  points.forEach(([u, v], index) => {
    if (index === 0) {
      shape.moveTo(u, v);
    } else {
      shape.lineTo(u, v);
    }
  });

  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
    depth: to - from,
  });
  const position = geometry.getAttribute("position");

  for (let index = 0; index < position.count; index += 1) {
    positions.push(
      position.getZ(index) + from,
      position.getX(index),
      position.getY(index),
    );
  }

  geometry.dispose();
}

/**
 * Собирает планку и ряд зажимов в одну неиндексированную сетку.
 *
 * Центр кольца поднят так, чтобы площадка зажима легла на CLIPS_JOIN_MM ниже
 * верха планки, а нижняя точка кабеля осталась на 1 мм выше планки. Набор
 * центрирован по длине: середина планки лежит в нуле, как у коробки.
 */
export function createClipsGeometry(
  params: Partial<ClipsParams>,
): BufferGeometry {
  const normalized = normalizeClipsParams(params);
  const inner = normalized.cableDiameter / 2 + CLIPS_CLEARANCE_MM;
  const outer = inner + CLIPS_WALL_MM;
  const ringZ = CLIPS_BASE_MM + CLIPS_LIFT_MM - CLIPS_JOIN_MM + inner;
  const baseWidth = (outer + CLIPS_BASE_MARGIN_MM) * 2;
  const baseLength =
    (normalized.clipCount - 1) * normalized.clipSpacing +
    CLIPS_WIDTH_MM +
    CLIPS_EDGE_MM * 2;
  const positions: number[] = [];

  addProfile(
    positions,
    [
      [-baseWidth / 2, 0],
      [baseWidth / 2, 0],
      [baseWidth / 2, CLIPS_BASE_MM],
      [-baseWidth / 2, CLIPS_BASE_MM],
    ],
    -baseLength / 2,
    baseLength / 2,
  );

  const outline = clipOutline(inner, outer).map(
    ([u, v]) => [u, v + ringZ] as const,
  );
  const first = -baseLength / 2 + CLIPS_EDGE_MM + CLIPS_WIDTH_MM / 2;

  for (let index = 0; index < normalized.clipCount; index += 1) {
    const clipX = first + index * normalized.clipSpacing;

    addProfile(
      positions,
      outline,
      clipX - CLIPS_WIDTH_MM / 2,
      clipX + CLIPS_WIDTH_MM / 2,
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
