/**
 * Детерминированный шум по сиду: «мятая глина» и микро-вариации силуэта.
 *
 * Задача модуля — сделать так, чтобы одна и та же ваза с одним и тем же сидом
 * собиралась одинаково на клиенте и на сервере, а «Другая ваза» меняла только
 * шум. Поэтому здесь нет `Math.random()`, нет времени и нет зависимости от
 * порядка вызовов: значение шума — чистая функция от координаты и сида.
 *
 * Арифметика целочисленная (`Math.imul`, сдвиги): 32-битные операции в
 * JavaScript детерминированы побитово, поэтому хеш совпадает в браузере, в
 * Node и в серверном роуте. Дробные операции (интерполяция) идут уже поверх
 * целых значений решётки и от платформы не зависят.
 *
 * Шум — value noise: на целочисленной решётке стоят псевдослучайные значения,
 * между ними — сглаженная кубическая интерполяция. Это дешевле градиентного
 * шума и даёт ровные «складки», которые и нужны стенке: у синуса видно период,
 * у гребёнки градиентов — направление, а value noise на двух октавах читается
 * как ручная лепка.
 *
 * Модуль чистый: без three.js, чтобы формулы проверялись отдельно от сборки
 * сетки, как `pattern-waves.ts` и `vase-section.ts`.
 */

/** Полный оборот: шов окружности должен попасть в одну точку решётки. */
const TWO_PI = Math.PI * 2;

/** Максимум 32-битного беззнакового: делитель для значения решётки. */
const UINT32_MAX = 0xffffffff;

/**
 * Вес октав шума.
 *
 * Первая октава — крупные складки через всю вазу, вторая — мелкая рябь поверх.
 * 65/35 даёт крупную форму с читаемой деталью: при равных весах стенка
 * выглядела бы «рябой» без главной волны, при 80/20 вторая октава теряется в
 * сглаживании сетки.
 */
const OCTAVE_WEIGHTS = [0.65, 0.35] as const;

/**
 * Частоты октав по кругу и по высоте.
 *
 * По кругу частоты целые — иначе на шве окружности шум не сошёлся бы, и после
 * сварки по координатам осталась бы ступенька. По высоте дробиться можно:
 * низ и верх вазы не замыкаются друг на друга.
 */
const OCTAVE_U = [2, 5] as const;
const OCTAVE_V = [1.5, 4] as const;

/**
 * Сдвиг сида для второй октавы.
 *
 * Небольшое нечётное число: две октавы должны быть независимыми, иначе их
 * сумма даёт ту же картину, что одна, только в два раза глубже.
 */
const OCTAVE_SEED_STEP = 1013;

/**
 * Контраст суммы октав.
 *
 * Сумма двух независимых шумов почти никогда не приходит в крайние значения:
 * на снимках гейта органика при `amplitude = 1` читалась как лёгкая волнистость,
 * а не как мятая глина. Множитель растягивает сумму к краям, а `clamp` оставляет
 * на пиках плоские площадки — это и есть «примятые» участки, которые видно на
 * глянцевой стенке. Значение подобрано по снимкам: при 1.5 складки читаются, но
 * плато ещё не превращается в грани.
 */
const ORGANIC_CONTRAST = 1.25;

/**
 * Сид → 32-битное целое.
 *
 * mulberry32-подобное перемешивание: соседние сиды (1, 2, 3) дают совершенно
 * разные решётки. Без перемешивания сид 1 и 2 отличались бы одной точкой
 * решётки, и «Другая ваза» показывала бы почти ту же форму.
 */
export function hashSeed(seed: number): number {
  let state = Math.trunc(Number.isFinite(seed) ? seed : 1) >>> 0;

  state = Math.imul(state ^ (state >>> 16), 0x21f0aaad) >>> 0;
  state = Math.imul(state ^ (state >>> 15), 0x735a2d97) >>> 0;

  return (state ^ (state >>> 15)) >>> 0;
}

/** Псевдослучайное значение решётки в узле (ix, iy): 0…1. */
function latticeValue(ix: number, iy: number, seed: number): number {
  let hash =
    Math.imul(ix | 0, 0x27d4eb2d) ^
    Math.imul(iy | 0, 0x85ebca6b) ^
    (seed | 0);

  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  hash = Math.imul(hash ^ (hash >>> 12), 0x297a2d39);
  hash ^= hash >>> 15;

  return (hash >>> 0) / UINT32_MAX;
}

/**
 * Сглаживание доли внутри ячейки: `t² · (3 − 2t)`.
 *
 * Линейная интерполяция оставила бы излом производной на границах ячеек, и на
 * глянцевой стенке он читается как сетка складок. Кубическая ступенька
 * начинается и заканчивается горизонтально.
 */
function smoothShare(share: number): number {
  return share * share * (3 - 2 * share);
}

/** Шум по готовому 32-битному сиду: вызывающий не платит за `hashSeed`. */
function noiseWithBase(x: number, y: number, base: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothShare(x - x0);
  const ty = smoothShare(y - y0);

  const leftTop = latticeValue(x0, y0, base);
  const rightTop = latticeValue(x0 + 1, y0, base);
  const leftBottom = latticeValue(x0, y0 + 1, base);
  const rightBottom = latticeValue(x0 + 1, y0 + 1, base);

  const top = leftTop + (rightTop - leftTop) * tx;
  const bottom = leftBottom + (rightBottom - leftBottom) * tx;

  return (top + (bottom - top) * ty) * 2 - 1;
}

/**
 * Value noise 2D: значение в диапазоне −1…1.
 *
 * `seed` перемешивается здесь же (`hashSeed`), поэтому вызывающий код может
 * передавать целый сид из параметров как есть. По `x` шум периодичен с
 * периодом 1: этим пользуется `organicOffset`, чтобы шов окружности сошёлся.
 */
export function valueNoise2d(x: number, y: number, seed: number): number {
  return noiseWithBase(x, y, hashSeed(seed));
}

/**
 * Смещение стенки «органикой», мм.
 *
 * `angle` — угол вершины в плане, `heightShare` — доля высоты от дна до кромки,
 * `amplitudeMm` — предел смещения (его считает `vase-deformation.ts` по самому
 * узкому радиусу). Две октавы нормированы так, что результат по модулю не
 * превышает `amplitudeMm`: иначе ограничение по радиусу пришлось бы проверять
 * ещё раз после суммирования.
 *
 * По кругу координата сдвинута на полпериода: угол от −π до π превращается в
 * 0…1 без разрыва на шве. Частоты октав целые, поэтому значение в угле 0 и в
 * угле 2π совпадает — после сварки шов склеивается без ступеньки.
 */
export function organicOffset(
  angle: number,
  heightShare: number,
  seed: number,
  amplitudeMm: number,
): number {
  if (!(amplitudeMm > 0)) {
    return 0;
  }

  const around = angle / TWO_PI + 0.5;
  const base = hashSeed(seed);
  let total = 0;
  let weights = 0;

  for (let index = 0; index < OCTAVE_WEIGHTS.length; index += 1) {
    const weight = OCTAVE_WEIGHTS[index];

    total +=
      weight *
      noiseWithBase(
        around * OCTAVE_U[index],
        heightShare * OCTAVE_V[index],
        (base + index * OCTAVE_SEED_STEP) | 0,
      );
    weights += weight;
  }

  // Контраст растягивает сумму к краям, clamp оставляет плоские площадки на
  // пиках: без первого складки почти не видны, без второго шум выходит за
  // амплитуду и ограничение по радиусу пришлось бы проверять повторно.
  const shaped = Math.min(
    Math.max((total / weights) * ORGANIC_CONTRAST, -1),
    1,
  );

  return shaped * amplitudeMm;
}

/**
 * Доля сжатия силуэта от сида: 0…1.
 *
 * Это не шум на стенке, а микро-вариация самого силуэта: у серии ваз с одним
 * набором параметров разные сиды дают чуть разные пропорции. Вариация только
 * сжимает радиусы (см. `vase-profile.ts`), поэтому заявленный диаметр никогда
 * не превышается — «самая широкая часть» остаётся обещанием слайдера.
 *
 * Зависимость только от доли высоты, а не от числа опорных точек: две вазы с
 * разными пресетами получают одну и ту же кривую вариации по высоте.
 */
export function organicProfileShare(heightShare: number, seed: number): number {
  return (
    0.5 + 0.5 * valueNoise2d(heightShare * 1.5, 0.37, (hashSeed(seed) + 7919) | 0)
  );
}

/**
 * Следующий сид по кнопке «Другая ваза»: целое из 1…max, не равное текущему.
 *
 * Сид берётся хешем предыдущего, а не `Math.random()`: серия ваз тогда
 * воспроизводима. Пользователь нажал кнопку трижды, сохранил проект — и при
 * следующем открытии те же три вазы собираются в том же порядке, а сохранённый
 * сид остаётся последним.
 *
 * Хеш равномерно заполняет 32 бита, поэтому остаток по модулю даёт сиды без
 * «липких» соседних значений: 42 → 631 271, а не 43.
 */
export function nextVaseSeed(seed: number, max: number): number {
  const limit = Math.max(2, Math.trunc(max));
  const current = Math.trunc(Number.isFinite(seed) ? seed : 1);
  const candidate = (hashSeed(current) % (limit - 1)) + 1;

  // Совпадение теоретически возможно: 32-битный хеш не обязан попадать в другой
  // остаток. Тогда сдвигаем на единицу, чтобы кнопка всегда меняла форму.
  return candidate === current ? (candidate % limit) + 1 : candidate;
}

/**
 * Галерея вариантов: `count` сидов подряд, начиная со следующего за текущим.
 *
 * Повторы исключены: две плитки с одним сидом выглядели бы как ошибка рендера.
 * Цепочка ограничена `max` шагами — при крошечном диапазоне функция честно
 * вернёт меньше сидов, чем просили, а не зациклится.
 */
export function vaseSeedSeries(
  seed: number,
  count: number,
  max: number,
): number[] {
  const limit = Math.max(2, Math.trunc(max));
  const series: number[] = [];
  const used = new Set<number>();
  let current = Math.trunc(Number.isFinite(seed) ? seed : 1);

  used.add(current);

  for (let index = 0; index < Math.max(0, Math.trunc(count)); index += 1) {
    let candidate = nextVaseSeed(current, limit);
    let guard = 0;

    while (used.has(candidate) && guard < limit) {
      candidate = nextVaseSeed(candidate, limit);
      guard += 1;
    }

    if (used.has(candidate)) {
      break;
    }

    used.add(candidate);
    series.push(candidate);
    current = candidate;
  }

  return series;
}

