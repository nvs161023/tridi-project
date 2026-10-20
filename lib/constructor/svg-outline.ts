/**
 * Разбор SVG-контуров без DOM.
 *
 * Серверный роут STL работает в Node.js, где нет DOMParser и SVGLoader из
 * three.js: он падает уже на импорте. Поэтому здесь живёт маленький разбор
 * подмножества SVG, которого хватает силуэтам брелока и загруженным файлам:
 * path (M, L, H, V, C, S, Q, T, A, Z в абсолютной и относительной форме),
 * polygon, rect, circle и ellipse. Контуры возвращаются в координатах SVG
 * (ось Y вниз), а масштабирование и переворот делает вызывающий код.
 *
 * Трансформации (`transform="..."`) не применяются: силуэты конструктора их
 * не используют, а для пользовательского файла это явное ограничение, которое
 * описано в PROJECT.md. Кривые сглаживаются в полилинию: брелок печатается
 * размером 30–100 мм, поэтому 12–16 отрезков на кривую дают гладкий контур без
 * раздувания STL.
 */

/** Точка контура в координатах SVG. */
export type OutlinePoint = readonly [number, number];

/** Предел точек: защита от файла, который состоит из микроскопических кривых. */
export const MAX_OUTLINE_POINTS = 20000;

/** Сегментов на кривую Безье: на мм брелока больше не нужно. */
const CURVE_STEPS = 14;

/** Сегментов на четверть окружности в прямоугольнике и эллипсе. */
const CORNER_STEPS = 8;

/** Сколько сегментов изображает полную окружность. */
const CIRCLE_STEPS = 48;

/** Совпадение координат, ниже которого точки считаются одинаковыми. */
const POINT_EPSILON = 1e-6;

/** Число из строки атрибута или значение по умолчанию. */
function readNumber(value: string | undefined, fallback = 0): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Убирает повтор первой точки в конце замкнутого контура. */
function normalizeContour(points: OutlinePoint[]): OutlinePoint[] {
  const first = points[0];
  const last = points[points.length - 1];

  if (
    first &&
    last &&
    Math.abs(first[0] - last[0]) < POINT_EPSILON &&
    Math.abs(first[1] - last[1]) < POINT_EPSILON
  ) {
    return points.slice(0, -1);
  }

  return points;
}

/** Общая точка для кривых: текущая, если управляющей точки нет. */
function reflect(
  point: readonly [number, number] | null,
  current: readonly [number, number],
): readonly [number, number] {
  if (!point) {
    return current;
  }

  return [current[0] * 2 - point[0], current[1] * 2 - point[1]];
}

/** Точки кубической кривой без начальной: начальная уже в контуре. */
function sampleCubic(
  start: OutlinePoint,
  control1: OutlinePoint,
  control2: OutlinePoint,
  end: OutlinePoint,
): OutlinePoint[] {
  const points: OutlinePoint[] = [];

  for (let step = 1; step <= CURVE_STEPS; step += 1) {
    const t = step / CURVE_STEPS;
    const mt = 1 - t;
    const x =
      mt * mt * mt * start[0] +
      3 * mt * mt * t * control1[0] +
      3 * mt * t * t * control2[0] +
      t * t * t * end[0];
    const y =
      mt * mt * mt * start[1] +
      3 * mt * mt * t * control1[1] +
      3 * mt * t * t * control2[1] +
      t * t * t * end[1];

    points.push([x, y]);
  }

  return points;
}

/**
 * Точки эллиптической дуги по параметризации из SVG-спецификации.
 *
 * Радиусы исправляются, если дуга не помещается: SVG в этом случае
 * увеличивает их, а не рисует прямую. Флаги большой дуги и направления
 * разворачивают центр, поэтому контур не «выворачивается».
 */
function sampleArc(
  start: OutlinePoint,
  rxValue: number,
  ryValue: number,
  rotationDegrees: number,
  largeArc: boolean,
  sweep: boolean,
  end: OutlinePoint,
): OutlinePoint[] {
  const [x1, y1] = start;
  const [x2, y2] = end;

  if (
    Math.abs(x1 - x2) < POINT_EPSILON &&
    Math.abs(y1 - y2) < POINT_EPSILON
  ) {
    return [];
  }

  let rx = Math.abs(rxValue);
  let ry = Math.abs(ryValue);

  if (rx < POINT_EPSILON || ry < POINT_EPSILON) {
    return [[x2, y2]];
  }

  const phi = (rotationDegrees * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);

  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
  }

  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const numerator = Math.max(
    0,
    rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p,
  );
  const denominator = rx2 * y1p * y1p + ry2 * x1p * x1p;
  const coefficient =
    (largeArc === sweep ? -1 : 1) *
    Math.sqrt(denominator < POINT_EPSILON ? 0 : numerator / denominator);
  const cxp = (coefficient * rx * y1p) / ry;
  const cyp = (-coefficient * ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;
  const startAngle = Math.atan2(uy, ux);
  let deltaAngle = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);

  if (!sweep && deltaAngle > 0) {
    deltaAngle -= Math.PI * 2;
  } else if (sweep && deltaAngle < 0) {
    deltaAngle += Math.PI * 2;
  }

  const steps = Math.max(2, Math.ceil(Math.abs(deltaAngle) / (Math.PI / 12)));
  const points: OutlinePoint[] = [];

  for (let step = 1; step <= steps; step += 1) {
    const angle = startAngle + (deltaAngle * step) / steps;
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    const x = cx + cosPhi * rx * cosAngle - sinPhi * ry * sinAngle;
    const y = cy + sinPhi * rx * cosAngle + cosPhi * ry * sinAngle;

    points.push([x, y]);
  }

  // Последняя точка дуги должна совпасть с концом сегмента: округление
  // параметризации иногда оставляет её на сотую долю миллиметра в стороне.
  points[points.length - 1] = [x2, y2];

  return points;
}

/** Точки квадратичной кривой без начальной. */
function sampleQuadratic(
  start: OutlinePoint,
  control: OutlinePoint,
  end: OutlinePoint,
): OutlinePoint[] {
  const points: OutlinePoint[] = [];

  for (let step = 1; step <= CURVE_STEPS; step += 1) {
    const t = step / CURVE_STEPS;
    const mt = 1 - t;
    const x = mt * mt * start[0] + 2 * mt * t * control[0] + t * t * end[0];
    const y = mt * mt * start[1] + 2 * mt * t * control[1] + t * t * end[1];

    points.push([x, y]);
  }

  return points;
}

/** Разбирает атрибут `d` одного path в массив контуров. */
export function parseSvgPath(data: string): OutlinePoint[][] {
  const contours: OutlinePoint[][] = [];
  const segments = data.matchAll(
    /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g,
  );
  let current: OutlinePoint[] | null = null;
  let pointX = 0;
  let pointY = 0;
  let startX = 0;
  let startY = 0;
  let lastControl: readonly [number, number] | null = null;
  let lastCommand = "";
  let totalPoints = 0;

  const pushPoint = (x: number, y: number): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    pointX = x;
    pointY = y;

    if (!current) {
      current = [[x, y]];
      totalPoints += 1;
      return;
    }

    const previous = current[current.length - 1];

    if (
      Math.abs(previous[0] - x) < POINT_EPSILON &&
      Math.abs(previous[1] - y) < POINT_EPSILON
    ) {
      return;
    }

    current.push([x, y]);
    totalPoints += 1;
  };

  const finishContour = (): void => {
    if (!current) {
      return;
    }

    const contour = normalizeContour(current);

    if (contour.length >= 3) {
      contours.push(contour);
    }

    current = null;
  };

  for (const segment of segments) {
    const command = segment[1];
    const args = [
      ...segment[2].matchAll(
        /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g,
      ),
    ].map((match) => Number.parseFloat(match[0]));
    let cursor = 0;

    if (command === "Z" || command === "z") {
      if (current) {
        pushPoint(startX, startY);
        finishContour();
      }

      pointX = startX;
      pointY = startY;
      lastControl = null;
      lastCommand = "Z";

      continue;
    }

    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();

    if (upper === "M") {
      if (args.length < 2) {
        continue;
      }

      finishContour();
      const x = relative ? pointX + args[0] : args[0];
      const y = relative ? pointY + args[1] : args[1];
      pushPoint(x, y);
      startX = x;
      startY = y;
      cursor = 2;
      lastControl = null;
      lastCommand = "M";

      while (cursor + 1 < args.length) {
        const lineX = relative ? pointX + args[cursor] : args[cursor];
        const lineY = relative ? pointY + args[cursor + 1] : args[cursor + 1];
        pushPoint(lineX, lineY);
        cursor += 2;
      }

      continue;
    }

    if (!current) {
      pushPoint(pointX, pointY);
      startX = pointX;
      startY = pointY;
    }

    while (cursor < args.length && totalPoints < MAX_OUTLINE_POINTS) {
      if (upper === "L") {
        if (cursor + 1 >= args.length) {
          break;
        }

        const nextX = relative ? pointX + args[cursor] : args[cursor];
        const nextY = relative ? pointY + args[cursor + 1] : args[cursor + 1];
        pushPoint(nextX, nextY);
        cursor += 2;
        lastControl = null;
        lastCommand = "L";
        continue;
      }

      if (upper === "H" || upper === "V") {
        if (cursor >= args.length) {
          break;
        }

        const value = relative
          ? (upper === "H" ? pointX : pointY) + args[cursor]
          : args[cursor];
        pushPoint(upper === "H" ? value : pointX, upper === "V" ? value : pointY);
        cursor += 1;
        lastControl = null;
        lastCommand = upper;
        continue;
      }


      if (upper === "C") {
        if (cursor + 5 >= args.length) {
          break;
        }

        const start: OutlinePoint = [pointX, pointY];
        const control1: OutlinePoint = [
          relative ? pointX + args[cursor] : args[cursor],
          relative ? pointY + args[cursor + 1] : args[cursor + 1],
        ];
        const control2: OutlinePoint = [
          relative ? pointX + args[cursor + 2] : args[cursor + 2],
          relative ? pointY + args[cursor + 3] : args[cursor + 3],
        ];
        const end: OutlinePoint = [
          relative ? pointX + args[cursor + 4] : args[cursor + 4],
          relative ? pointY + args[cursor + 5] : args[cursor + 5],
        ];

        for (const sample of sampleCubic(start, control1, control2, end)) {
          pushPoint(sample[0], sample[1]);
        }

        lastControl = control2;
        lastCommand = "C";
        cursor += 6;
        continue;
      }

      if (upper === "S") {
        if (cursor + 3 >= args.length) {
          break;
        }

        const start: OutlinePoint = [pointX, pointY];
        const control1 = reflect(
          lastCommand === "C" || lastCommand === "S" ? lastControl : null,
          start,
        );
        const control2: OutlinePoint = [
          relative ? pointX + args[cursor] : args[cursor],
          relative ? pointY + args[cursor + 1] : args[cursor + 1],
        ];
        const end: OutlinePoint = [
          relative ? pointX + args[cursor + 2] : args[cursor + 2],
          relative ? pointY + args[cursor + 3] : args[cursor + 3],
        ];

        for (const sample of sampleCubic(start, control1, control2, end)) {
          pushPoint(sample[0], sample[1]);
        }

        lastControl = control2;
        lastCommand = "S";
        cursor += 4;
        continue;
      }

      if (upper === "Q") {
        if (cursor + 3 >= args.length) {
          break;
        }

        const start: OutlinePoint = [pointX, pointY];
        const control: OutlinePoint = [
          relative ? pointX + args[cursor] : args[cursor],
          relative ? pointY + args[cursor + 1] : args[cursor + 1],
        ];
        const end: OutlinePoint = [
          relative ? pointX + args[cursor + 2] : args[cursor + 2],
          relative ? pointY + args[cursor + 3] : args[cursor + 3],
        ];

        for (const sample of sampleQuadratic(start, control, end)) {
          pushPoint(sample[0], sample[1]);
        }

        lastControl = control;
        lastCommand = "Q";
        cursor += 4;
        continue;
      }


      if (upper === "T") {
        if (cursor + 1 >= args.length) {
          break;
        }

        const start: OutlinePoint = [pointX, pointY];
        const control = reflect(
          lastCommand === "Q" || lastCommand === "T" ? lastControl : null,
          start,
        );
        const end: OutlinePoint = [
          relative ? pointX + args[cursor] : args[cursor],
          relative ? pointY + args[cursor + 1] : args[cursor + 1],
        ];

        for (const sample of sampleQuadratic(start, control, end)) {
          pushPoint(sample[0], sample[1]);
        }

        lastControl = control;
        lastCommand = "T";
        cursor += 2;
        continue;
      }

      if (upper === "A") {
        if (cursor + 6 >= args.length) {
          break;
        }

        const end: OutlinePoint = [
          relative ? pointX + args[cursor + 5] : args[cursor + 5],
          relative ? pointY + args[cursor + 6] : args[cursor + 6],
        ];
        const arc = sampleArc(
          [pointX, pointY],
          args[cursor],
          args[cursor + 1],
          args[cursor + 2],
          args[cursor + 3] !== 0,
          args[cursor + 4] !== 0,
          end,
        );

        for (const sample of arc) {
          pushPoint(sample[0], sample[1]);
        }

        lastControl = null;
        lastCommand = "A";
        cursor += 7;
        continue;
      }

      break;
    }
  }

  finishContour();

  return contours;
}


/** Читает числовой атрибут из строки атрибутов элемента. */
function attribute(attributes: string, name: string): string | undefined {
  const pattern = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "i",
  );
  const match = pattern.exec(attributes);

  return match ? (match[1] ?? match[2]) : undefined;
}

/** Прямоугольник, при необходимости со скруглёнными углами. */
function rectangleContour(
  x: number,
  y: number,
  width: number,
  height: number,
  radiusX: number,
  radiusY: number,
): OutlinePoint[] {
  const rx = Math.min(Math.max(radiusX, 0), width / 2);
  const ry = Math.min(Math.max(radiusY, 0), height / 2);

  if (rx < POINT_EPSILON || ry < POINT_EPSILON) {
    return [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ];
  }

  const points: OutlinePoint[] = [];
  const corners: readonly [number, number, number][] = [
    [x + width - rx, y + ry, -Math.PI / 2],
    [x + width - rx, y + height - ry, 0],
    [x + rx, y + height - ry, Math.PI / 2],
    [x + rx, y + ry, Math.PI],
  ];

  for (const [centerX, centerY, startAngle] of corners) {
    for (let step = 0; step <= CORNER_STEPS; step += 1) {
      const angle = startAngle + (step / CORNER_STEPS) * (Math.PI / 2);
      points.push([
        centerX + Math.cos(angle) * rx,
        centerY + Math.sin(angle) * ry,
      ]);
    }
  }

  return points;
}

/** Эллипс, вписанный в прямоугольник. */
function ellipseContour(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
): OutlinePoint[] {
  const points: OutlinePoint[] = [];

  for (let step = 0; step < CIRCLE_STEPS; step += 1) {
    const angle = (step / CIRCLE_STEPS) * Math.PI * 2;
    points.push([
      centerX + Math.cos(angle) * radiusX,
      centerY + Math.sin(angle) * radiusY,
    ]);
  }

  return points;
}


/**
 * Извлекает все контуры из SVG-разметки.
 *
 * Поддерживаются path, polygon, rect, circle и ellipse. Повторяющиеся вершины
 * и контуры короче треугольника отбрасываются: они не дают площади и только
 * путают триангуляцию.
 */
export function parseSvgOutline(markup: string): OutlinePoint[][] {
  const contours: OutlinePoint[][] = [];
  const elements = markup.matchAll(
    /<(path|polygon|rect|circle|ellipse)\b([^>]*)>/gi,
  );

  for (const element of elements) {
    const tag = element[1].toLowerCase();
    const attributes = element[2];

    if (tag === "path") {
      const data = attribute(attributes, "d");

      if (data) {
        contours.push(...parseSvgPath(data));
      }

      continue;
    }

    if (tag === "polygon") {
      const raw = attribute(attributes, "points");

      if (!raw) {
        continue;
      }

      const numbers = [
        ...raw.matchAll(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g),
      ].map((match) => Number.parseFloat(match[0]));
      const points: OutlinePoint[] = [];

      for (let index = 0; index + 1 < numbers.length; index += 2) {
        points.push([numbers[index], numbers[index + 1]]);
      }

      if (points.length >= 3) {
        contours.push(points);
      }

      continue;
    }

    if (tag === "rect") {
      const width = readNumber(attribute(attributes, "width"));
      const height = readNumber(attribute(attributes, "height"));
      const radius = readNumber(attribute(attributes, "rx"));

      if (width <= 0 || height <= 0) {
        continue;
      }

      contours.push(
        rectangleContour(
          readNumber(attribute(attributes, "x")),
          readNumber(attribute(attributes, "y")),
          width,
          height,
          radius,
          readNumber(attribute(attributes, "ry"), radius),
        ),
      );

      continue;
    }

    if (tag === "circle") {
      const radius = readNumber(attribute(attributes, "r"));

      if (radius > 0) {
        contours.push(
          ellipseContour(
            readNumber(attribute(attributes, "cx")),
            readNumber(attribute(attributes, "cy")),
            radius,
            radius,
          ),
        );
      }

      continue;
    }

    const radiusX = readNumber(attribute(attributes, "rx"));
    const radiusY = readNumber(attribute(attributes, "ry"));

    if (radiusX > 0 && radiusY > 0) {
      contours.push(
        ellipseContour(
          readNumber(attribute(attributes, "cx")),
          readNumber(attribute(attributes, "cy")),
          radiusX,
          radiusY,
        ),
      );
    }
  }

  return contours;
}

/** Знаковая площадь контура: знак показывает направление обхода. */
export function outlineArea(points: readonly OutlinePoint[]): number {
  let area = 0;

  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];

    area += x1 * y2 - x2 * y1;
  }

  return area / 2;
}

/**
 * Точка внутри замкнутого набора контуров по правилу чётности.
 *
 * Правило совпадает с SVG `fill-rule="evenodd"`: вложенный контур становится
 * отверстием. Для силуэтов без отверстий результат такой же, как у простого
 * попадания в многоугольник.
 */
export function isPointInsideOutline(
  point: OutlinePoint,
  contours: readonly (readonly OutlinePoint[])[],
): boolean {
  let inside = false;

  for (const contour of contours) {
    for (
      let index = 0, previous = contour.length - 1;
      index < contour.length;
      previous = index, index += 1
    ) {
      const [x1, y1] = contour[index];
      const [x2, y2] = contour[previous];
      const intersects =
        y1 > point[1] !== y2 > point[1] &&
        point[0] < ((x2 - x1) * (point[1] - y1)) / (y2 - y1) + x1;

      if (intersects) {
        inside = !inside;
      }
    }
  }

  return inside;
}

