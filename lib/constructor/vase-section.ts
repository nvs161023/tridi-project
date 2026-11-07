import {
  CONSTRUCTOR_LIMITS,
  DEFAULT_VASE_PARAMS,
  isVaseShape,
  type VaseParams,
  type VaseShape,
} from "@/lib/constructor/params";

/**
 * Сечение вазы в плане: круг или правильный N-угольник.
 *
 * Профиль по высоте задаёт силуэт, а это модуль задаёт форму поперечного
 * сечения — множитель радиуса по углу. Модуль чистый (без three.js), поэтому
 * формулы проверяются отдельно от сборки сетки, как `pattern-waves.ts`.
 *
 * Многоугольник задаётся расстоянием до ближайшей грани: r(φ) = a / cos(δ), где
 * a — радиус вписанной окружности, δ — угол до нормали грани. Функция
 * непрерывна, поэтому LatheGeometry с её кольцами даёт плоские грани и острые
 * углы без отдельной триангуляции. Множитель нормирован так, что в углах он
 * равен единице: габарит не выходит за `diameter`, а грань квадрата получается
 * `diameter / √2`.
 *
 * Множитель зависит только от угла, поэтому все точки одного луча сжимаются
 * одинаково и сечение остаётся звездообразным: кольца не пересекаются, сетка не
 * рвётся.
 */

/**
 * Меньше трёх граней не бывает: два луча дают отрезок, а не сечение. Значения
 * 0…2 у слайдера означают «как в силуэте» — это и есть круг у плавных силуэтов.
 */
export const VASE_SECTION_MIN_SIDES = 3;

/**
 * Сколько граней задаёт сам силуэт.
 *
 * Возвращается 0 для тел вращения: у classic, cone, cylinder, hourglass,
 * teardrop и double_bulb сечение круглое, и слайдер «Грани» только тогда и
 * начинает что-то менять.
 */
export function shapeSectionSides(shape: VaseShape): number {
  switch (shape) {
    case "square":
      return 4;
    case "octagon":
      return 8;
    default:
      return 0;
  }
}

/**
 * Действительное число граней: слайдер важнее силуэта, но только с трёх.
 *
 * Параметр приходит из состояния конструктора и из тела запроса, поэтому здесь
 * же отсекается мусор: не число, дробь и выход за границы. Ноль — «как в
 * силуэте»: у квадрата это четыре грани, у классики — круг. Так старые проекты
 * и старые запросы без поля `sectionSides` дают ровно прежнюю геометрию.
 */
export function resolveSectionSides(
  shape: VaseShape,
  sectionSides?: number,
): number {
  const limit = CONSTRUCTOR_LIMITS.sectionSides;
  const requested = Number.isFinite(sectionSides)
    ? Math.round(sectionSides as number)
    : limit.defaultValue;
  const clamped = Math.min(Math.max(requested, limit.min), limit.max);

  return clamped >= VASE_SECTION_MIN_SIDES
    ? clamped
    : shapeSectionSides(shape);
}

/**
 * Сечение: число граней, сжатие грани и множитель радиуса по углу.
 *
 * `factorAt` равен 1 в углу многоугольника и cos(π/N) на середине грани,
 * `flatShare` — это тот же cos(π/N). Оба нужны: первый масштабирует оболочку,
 * второй переводит отступ по нормали в отступ по лучу (`vase-geometry.ts`
 * строит внутреннюю стенку вписанным многоугольником).
 */
export type VaseSection = {
  /** Число граней; 0 — круг. */
  sides: number;
  /** Отношение радиуса вписанной окружности к радиусу угла — cos(π/N); у круга 1. */
  flatShare: number;
  /** Множитель радиуса для луча: 1 в углу, cos(π/N) на середине грани. */
  factorAt: (angle: number) => number;
};

/** Круг: множитель единица, стенка и обод считаются как раньше. */
const ROUND_SECTION: VaseSection = {
  sides: 0,
  flatShare: 1,
  factorAt: () => 1,
};

/**
 * Сечение по параметрам вазы.
 *
 * Вызывающий получает объект всегда — у круга множитель просто равен единице.
 * Это убирает ветку «а вдруг сечения нет» из цикла по вершинам.
 */
export function createVaseSection(
  params: Partial<Pick<VaseParams, "shape" | "sectionSides">> = {},
): VaseSection {
  const shape = isVaseShape(params.shape) ? params.shape : DEFAULT_VASE_PARAMS.shape;
  const sides = resolveSectionSides(shape, params.sectionSides);

  if (sides < VASE_SECTION_MIN_SIDES) {
    return ROUND_SECTION;
  }

  const sector = (Math.PI * 2) / sides;
  const halfSector = sector / 2;
  const flatShare = Math.cos(halfSector);

  return {
    sides,
    flatShare,
    factorAt: (angle) => {
      const wrapped = ((angle % sector) + sector) % sector;
      const distance = Math.min(wrapped, sector - wrapped);

      return flatShare / Math.cos(distance);
    },
  };
}
