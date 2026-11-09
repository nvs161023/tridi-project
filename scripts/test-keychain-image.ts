/**
 * Тест маски картинки брелока: краска, порог, дилатация, упаковка, обводка.
 *
 * Правила, которые здесь закреплены, выведены из двух жалоб владельца. Первая:
 * «логотип в рельефе не читается». Вторая: «коробка читается, а `tridi-print.ru` и
 * мелкий текст разваливаются на осколки». Отсюда четыре правила.
 *
 * Доля краски в непрозрачной картинке — это `1 − min(R,G,B)/255`, а не яркость:
 * прежняя формула по светлоте давала синему 0.59, светло-синему 0.34 и жёлтому
 * 0.09, поэтому при пороге 50 % цветные части логотипа пропадали.
 *
 * Дилатация — ровный проход по четырём соседям, без «ядра» и без срезания хвостов:
 * у подписи ядра нет вовсе, поэтому прежняя логика расширяла буквы неравномерно, а
 * срезание одиночных ячеек отрезало у них куски. Прибавка в одну ячейку сетки
 * 400 — это 0.065 мм, меньше сопла, и на глаз не видна.
 *
 * Упрощение контура — 0.4 ячейки, а не 1.5: полтора допуска схлопывали мелкие
 * контуры в точку, и буквы до геометрии не доходили.
 *
 * Габарит маски лежит в заголовке двумя uint16 (сетка 400 в байт не влезает), а
 * прежние маски с двумя байтами читаются по-прежнему.
 *
 * Что проверяется:
 *   1. цвет даёт краску: синий и жёлтый логотипы проходят порог 50 %, а пастельный
 *      фон — нет, поэтому белый лист не печатается;
 *   2. пустая картинка возвращает `empty`, а не пустую маску;
 *   3. порог режет по ступеням: 13 проходит при 50 %, 6 нет, при 60 % проходит 6, а
 *      белый фон остаётся фоном даже при 100 %;
 *   4. дилатация меряется ячейками: линия в одну ячейку становится тремя, полоса в
 *      пять — семью, одиночная точка — крестом из пяти;
 *   5. инверсия меняет пластик и фон местами;
 *   6. маска переживает упаковку в строку `imageData` без потерь и влезает в предел
 *      `params_json`; заголовок нового образца хранит габарит двумя uint16, а строка
 *      прежнего образца с двумя байтами читается;
 *   7. тонкий мостик держит фигуру целиком, а просвет между двумя штрихами не
 *      зарастает: упрощение не рвёт буквы и не сливает их в пятно;
 *   8. обводка совпадает с маской: заливка контуров обратно в сетку даёт не больше
 *      4 % расхождения, инверсия даёт другую маску, а мягкий край отзывается на
 *      порог — кеш сборки различает параметры;
 *   9. рельеф входит в тело на 0.35 мм, а у сетки есть нормали: `ExtrudeGeometry`
 *      не остаётся без них, потому что материал брелока не включает `flatShading`.
 *
 * Запуск: `npm run check:keychain`.
 */
import {
  KEYCHAIN_IMAGE_FIELD_LEVELS,
  KEYCHAIN_IMAGE_GRID,
  createKeychainImageGeometry,
  keychainImageBuild,
  keychainImageErrorText,
  keychainImageField,
  keychainImageFromPixels,
  keychainImageMask,
  keychainImageReliefMm,
  type KeychainImageField,
} from "../lib/constructor/keychain-image";
import {
  KEYCHAIN_IMAGE_FIELD_PREFIX,
  KEYCHAIN_IMAGE_MAX_LENGTH,
} from "../lib/constructor/params";

/** Сколько проверок упало: из этого складывается код выхода. */
let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);

  if (isEqual) {
    console.log(`  ok   ${name}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${name}`);
  console.log(`       ожидалось: ${JSON.stringify(expected)}`);
  console.log(`       получено:  ${JSON.stringify(actual)}`);
}

/** Поле покрытия из готовых ступеней: удобно для проверок самой маски. */
function fieldOf(
  levels: readonly number[],
  width: number,
  height: number,
): KeychainImageField {
  return { cells: Uint8Array.from(levels), height, width };
}

/** Пиксели картинки: фон `background` и прямоугольник `ink` в центре. */
function pixelsOf(
  width: number,
  height: number,
  ink: readonly [number, number, number],
  background: readonly [number, number, number] = [255, 255, 255],
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    const column = index % width;
    const row = Math.floor(index / width);
    const inside =
      column >= Math.floor(width / 4) &&
      column < Math.ceil((width * 3) / 4) &&
      row >= Math.floor(height / 4) &&
      row < Math.ceil((height * 3) / 4);
    const color = inside ? ink : background;

    pixels[index * 4] = color[0];
    pixels[index * 4 + 1] = color[1];
    pixels[index * 4 + 2] = color[2];
    pixels[index * 4 + 3] = 255;
  }

  return pixels;
}

function countBits(bits: Uint8Array): number {
  let total = 0;

  for (const bit of bits) {
    total += bit;
  }

  return total;
}

/**
 * Строка `imageData` из поля покрытия: маркер 0, два uint16 и полубайты.
 *
 * Упаковка повторена здесь намеренно: тест собирает строку сам, а не через
 * `packField`, поэтому формат проверяется снаружи — так же, как его прочитает
 * проект из базы.
 */
function fieldImageData(field: KeychainImageField): string {
  const { cells, height, width } = field;
  const bytes = [
    0,
    (width >> 8) & 0xff,
    width & 0xff,
    (height >> 8) & 0xff,
    height & 0xff,
  ];

  for (let index = 0; index < cells.length; index += 2) {
    bytes.push(
      (cells[index] & 0x0f) | (((cells[index + 1] ?? 0) & 0x0f) << 4),
    );
  }

  return `${KEYCHAIN_IMAGE_FIELD_PREFIX}${btoa(String.fromCharCode(...bytes))}`;
}

/**
 * Пиксели со сглаженным краем: как у логотипа, уменьшенного из большого файла.
 *
 * Жёсткий прямоугольник даёт только ступени 0 и 15, а порог на нём ничего не
 * меняет. Здесь край размыт окном 3×3, поэтому между фоном и краской появляются
 * промежуточные ступени — на них и видно работу порога.
 */
function pixelsOfSoft(
  side: number,
  ink: readonly [number, number, number],
): Uint8ClampedArray {
  const hard = new Float32Array(side * side);
  const low = Math.floor(side / 4);
  const high = Math.ceil((side * 3) / 4);

  for (let row = 0; row < side; row += 1) {
    for (let column = 0; column < side; column += 1) {
      const inside = column >= low && column < high && row >= low && row < high;

      hard[row * side + column] = inside ? 1 : 0;
    }
  }

  const pixels = new Uint8ClampedArray(side * side * 4);

  for (let row = 0; row < side; row += 1) {
    for (let column = 0; column < side; column += 1) {
      let sum = 0;
      let count = 0;

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const targetRow = row + dy;
          const targetColumn = column + dx;

          if (
            targetRow < 0 ||
            targetRow >= side ||
            targetColumn < 0 ||
            targetColumn >= side
          ) {
            continue;
          }

          sum += hard[targetRow * side + targetColumn];
          count += 1;
        }
      }

      const coverage = count > 0 ? sum / count : 0;
      const offset = (row * side + column) * 4;

      pixels[offset] = Math.round(255 + (ink[0] - 255) * coverage);
      pixels[offset + 1] = Math.round(255 + (ink[1] - 255) * coverage);
      pixels[offset + 2] = Math.round(255 + (ink[2] - 255) * coverage);
      pixels[offset + 3] = 255;
    }
  }

  return pixels;
}

/** Занятые ячейки в строке: по ним видно ширину штриха. */
function rowWidth(bits: Uint8Array, width: number, row: number): number {
  return countBits(bits.slice(row * width, (row + 1) * width));
}

console.log("Краска по каналу");
{
  const blue = keychainImageFromPixels(pixelsOf(32, 32, [27, 127, 196]), 32, 32);
  const blueField =
    "imageData" in blue ? keychainImageField(blue.imageData) : null;

  check("синий логотип даёт маску", blueField !== null, true);
  check(
    "синий проходит порог 50 %",
    blueField ? countBits(keychainImageMask(blueField, 50, false)) > 0 : false,
    true,
  );

  const yellow = keychainImageFromPixels(pixelsOf(32, 32, [255, 233, 74]), 32, 32);
  const yellowField =
    "imageData" in yellow ? keychainImageField(yellow.imageData) : null;

  check("жёлтый логотип даёт маску", yellowField !== null, true);
  check(
    "жёлтый проходит порог 50 %",
    yellowField
      ? countBits(keychainImageMask(yellowField, 50, false)) > 0
      : false,
    true,
  );

  // Пастель — это фон: 1 − 143/255 = 0.44, поэтому при пороге 50 % кадр пуст.
  const pastel = keychainImageFromPixels(pixelsOf(32, 32, [143, 200, 238]), 32, 32);
  const pastelField =
    "imageData" in pastel ? keychainImageField(pastel.imageData) : null;

  check(
    "пастельный фон не печатается",
    pastelField ? countBits(keychainImageMask(pastelField, 50, false)) : -1,
    0,
  );

  const white = new Uint8ClampedArray(32 * 32 * 4).fill(255);

  check("белый лист — ошибка empty", keychainImageFromPixels(white, 32, 32), {
    error: "empty",
  });
  check(
    "текст отказа про пустую картинку",
    keychainImageErrorText("empty").startsWith("На картинке не нашлось рисунка"),
    true,
  );
}

console.log("");
console.log("Порог");
{
  const full = new Array(9).fill(KEYCHAIN_IMAGE_FIELD_LEVELS - 1);
  const dark = fieldOf(full, 3, 3);

  check("ступень 15 — пластик при 50 %", countBits(keychainImageMask(dark, 50, false)), 9);

  const mid = fieldOf(new Array(9).fill(6), 3, 3);

  check("ступень 6 — фон при 50 %", countBits(keychainImageMask(mid, 50, false)), 0);
  check("ступень 6 — пластик при 60 %", countBits(keychainImageMask(mid, 60, false)), 9);

  const white = fieldOf(new Array(9).fill(0), 3, 3);

  check(
    "белый фон при 100 % остаётся фоном",
    countBits(keychainImageMask(white, 100, false)),
    0,
  );
}

console.log("");
console.log("Дилатация");
{
  // Линия в одну ячейку: девять строк, средний столбец.
  const line: number[] = [];

  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      line.push(column === 4 ? KEYCHAIN_IMAGE_FIELD_LEVELS - 1 : 0);
    }
  }

  const lineMask = keychainImageMask(fieldOf(line, 9, 9), 50, false);

  check("линия в одну ячейку стала тремя", rowWidth(lineMask, 9, 4), 3);
  check("линия расширена по всей длине", countBits(lineMask), 27);

  // Полоса в пять ячеек: столбцы 2…6 на всю высоту.
  const bar: number[] = [];

  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      bar.push(
        column >= 2 && column <= 6 ? KEYCHAIN_IMAGE_FIELD_LEVELS - 1 : 0,
      );
    }
  }

  const barMask = keychainImageMask(fieldOf(bar, 9, 9), 50, false);

  check("полоса в пять ячеек стала семью", rowWidth(barMask, 9, 4), 7);
  check("полоса выросла ровно на ячейку с каждой стороны", countBits(barMask), 63);

  // Одиночная точка: ровный проход даёт крест из пяти ячеек, а не одну.
  const dot = new Array(9 * 9).fill(0);

  dot[40] = KEYCHAIN_IMAGE_FIELD_LEVELS - 1;

  const dotMask = keychainImageMask(fieldOf(dot, 9, 9), 50, false);

  check("одиночная точка даёт крест из пяти", countBits(dotMask), 5);
  check("крест шириной в три ячейки", rowWidth(dotMask, 9, 4), 3);
}

console.log("");
console.log("Инверсия");
{
  const dot = new Array(25).fill(0);

  dot[12] = KEYCHAIN_IMAGE_FIELD_LEVELS - 1;

  const field = fieldOf(dot, 5, 5);

  check("без инверсии — крест из пяти", countBits(keychainImageMask(field, 50, false)), 5);
  check(
    "с инверсией — весь кадр целиком",
    countBits(keychainImageMask(field, 50, true)),
    25,
  );
}

console.log("");
console.log("Упаковка маски");
{
  const side = 64;
  const converted = keychainImageFromPixels(
    pixelsOf(side, side, [31, 41, 55]),
    side,
    side,
  );
  const field = "imageData" in converted
    ? keychainImageField(converted.imageData)
    : null;

  check("маска читается обратно", field !== null, true);
  check(
    "габарит маски — сетка загрузки",
    field ? Math.max(field.width, field.height) : 0,
    side,
  );
  check(
    "строка короче предела params_json",
    "imageData" in converted && converted.imageData.length < KEYCHAIN_IMAGE_MAX_LENGTH,
    true,
  );

  check("сетка маски влезает в uint16 заголовка", KEYCHAIN_IMAGE_GRID <= 0xffff, true);
  check("сетка не мельче 400 ячеек", KEYCHAIN_IMAGE_GRID >= 400, true);

  // Маска прежнего образца: габарит двумя байтами и полубайты покрытия. Проекты,
  // сохранённые до сетки 400, должны открываться без миграции — поле у них то же.
  const legacyCells = new Array(16).fill(KEYCHAIN_IMAGE_FIELD_LEVELS - 1);

  legacyCells[5] = 0;

  const legacyBytes = [4, 4];

  for (let index = 0; index < legacyCells.length; index += 2) {
    legacyBytes.push(legacyCells[index] | (legacyCells[index + 1] << 4));
  }

  const legacy = keychainImageField(
    `${KEYCHAIN_IMAGE_FIELD_PREFIX}${btoa(String.fromCharCode(...legacyBytes))}`,
  );

  check("маска прежнего образца читается", legacy !== null, true);
  check(
    "габарит прежней маски — из двух байтов",
    legacy ? [legacy.width, legacy.height] : null,
    [4, 4],
  );
  check(
    "ступени прежней маски не поехали",
    legacy ? [legacy.cells[5], legacy.cells[6]] : null,
    [0, KEYCHAIN_IMAGE_FIELD_LEVELS - 1],
  );

  const big = keychainImageFromPixels(
    pixelsOf(KEYCHAIN_IMAGE_GRID, KEYCHAIN_IMAGE_GRID, [27, 127, 196]),
    KEYCHAIN_IMAGE_GRID,
    KEYCHAIN_IMAGE_GRID,
  );
  const bigField = "imageData" in big ? keychainImageField(big.imageData) : null;

  check(
    "маска полной сетки читается",
    bigField ? Math.max(bigField.width, bigField.height) : 0,
    KEYCHAIN_IMAGE_GRID,
  );
  check(
    "маска полной сетки короче предела",
    "imageData" in big && big.imageData.length < KEYCHAIN_IMAGE_MAX_LENGTH,
    true,
  );

  if ("imageData" in big && bigField) {
    console.log(
      `       маска ${bigField.width}×${bigField.height}: ${big.imageData.length} знаков base64 при пределе ${KEYCHAIN_IMAGE_MAX_LENGTH}`,
    );
  }
}

console.log("");
console.log("Тонкие места букв");
{
  // Буква «П» из стоек в одну ячейку и тонкой перемычки: после расширения фигура
  // остаётся одной, то есть упрощение не рвёт тонкое место на куски.
  const letter = new Array(11 * 11).fill(0);

  for (let row = 2; row <= 8; row += 1) {
    letter[row * 11 + 2] = KEYCHAIN_IMAGE_FIELD_LEVELS - 1;
    letter[row * 11 + 8] = KEYCHAIN_IMAGE_FIELD_LEVELS - 1;
  }

  for (let column = 2; column <= 8; column += 1) {
    letter[2 * 11 + column] = KEYCHAIN_IMAGE_FIELD_LEVELS - 1;
  }

  const letterBuild = keychainImageBuild(
    fieldImageData(fieldOf(letter, 11, 11)),
    50,
    false,
  );

  check("буква из тонких штрихов собирается", letterBuild !== null, true);
  check("перемычка не рвёт букву на куски", letterBuild ? letterBuild.contours.length : -1, 1);

  // Две стойки через три пустые ячейки: расширение съедает по одной с каждой
  // стороны, просвет в одну ячейку остаётся — буквы не слипаются в пятно.
  const pair = new Array(11 * 11).fill(0);

  for (let row = 2; row <= 8; row += 1) {
    pair[row * 11 + 3] = KEYCHAIN_IMAGE_FIELD_LEVELS - 1;
    pair[row * 11 + 7] = KEYCHAIN_IMAGE_FIELD_LEVELS - 1;
  }

  const pairField = fieldOf(pair, 11, 11);
  const pairMask = keychainImageMask(pairField, 50, false);
  const pairBuild = keychainImageBuild(fieldImageData(pairField), 50, false);

  check("две стойки через три ячейки остаются двумя", pairBuild ? pairBuild.contours.length : -1, 2);
  check("просвет между стойками — одна ячейка", countBits(pairMask.slice(5 * 11, 6 * 11)), 6);
}

console.log("");
console.log("Обводка совпадает с маской");
{
  const side = 48;
  const converted = keychainImageFromPixels(
    pixelsOf(side, side, [27, 127, 196]),
    side,
    side,
  );
  const imageData = "imageData" in converted ? converted.imageData : null;
  const field = imageData ? keychainImageField(imageData) : null;

  if (!field || !imageData) {
    failures += 1;
    console.log("  FAIL маска не читается");
  } else {
    const mask = keychainImageMask(field, 50, false);
    const build = keychainImageBuild(imageData, 50, false);

    if (!build) {
      failures += 1;
      console.log("  FAIL обводка не собралась");
    } else {
      // Контуры идут в единичных координатах: переводим их обратно в ячейки той же
      // сеткой, которой обводили, и считаем расхождение с маской.
      const { frame, pixel } = build;
      let extra = 0;
      let missing = 0;

      for (let row = 0; row < field.height; row += 1) {
        const y = frame.minY + frame.height - (row + 0.5) * pixel;
        const crossings: number[] = [];

        for (const contour of build.contours) {
          for (let index = 0; index < contour.length; index += 1) {
            const [x1, y1] = contour[index];
            const [x2, y2] = contour[(index + 1) % contour.length];

            if (y1 <= y === y2 <= y) {
              continue;
            }

            crossings.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
          }
        }

        crossings.sort((left, right) => left - right);

        const filled = new Uint8Array(field.width);

        for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
          const from = Math.max(
            0,
            Math.ceil((crossings[pair] - frame.minX) / pixel - 0.5),
          );
          const to = Math.min(
            field.width - 1,
            Math.floor((crossings[pair + 1] - frame.minX) / pixel - 0.5),
          );

          for (let column = from; column <= to; column += 1) {
            filled[column] = 1;
          }
        }

        for (let column = 0; column < field.width; column += 1) {
          const actual = mask[row * field.width + column];
          const traced = filled[column];

          if (traced && !actual) {
            extra += 1;
          }

          if (!traced && actual) {
            missing += 1;
          }
        }
      }

      const ink = countBits(mask);
      const deviation = ink > 0 ? (extra + missing) / ink : 1;

      check("расхождение обводки и маски не больше 4 %", deviation <= 0.04, true);

      if (deviation > 0.04) {
        console.log(
          `       лишних ${extra}, пропущенных ${missing} при ${ink} ячейках пластика`,
        );
      }
    }

    // Сглаженный край: у настоящего логотипа между 0 и 15 есть промежуточные
    // ступени, и порог сдвигает границу. У жёсткого прямоугольника их нет, поэтому
    // проверка идёт на картинке с мягким краем.
    const soft = keychainImageFromPixels(pixelsOfSoft(48, [27, 127, 196]), 48, 48);
    const softField =
      "imageData" in soft ? keychainImageField(soft.imageData) : null;

    check(
      "мягкий край отзывается на порог",
      softField
        ? countBits(keychainImageMask(softField, 90, false)) >
            countBits(keychainImageMask(softField, 50, false))
        : false,
      true,
    );

    check(
      "инверсия даёт другую маску",
      countBits(keychainImageMask(field, 50, true)) !== countBits(mask),
      true,
    );
  }
}

console.log("");
console.log("Рельеф");
check(
  "рельеф 0.6 мм входит в тело на 0.35",
  Number(keychainImageReliefMm(0.6).toFixed(2)),
  0.95,
);
check(
  "нулевой выступ не уходит в минус",
  Number(keychainImageReliefMm(0).toFixed(2)),
  0.45,
);

{
  const side = 32;
  const converted = keychainImageFromPixels(
    pixelsOf(side, side, [27, 127, 196]),
    side,
    side,
  );
  const imageData = "imageData" in converted ? converted.imageData : null;
  const build = imageData ? keychainImageBuild(imageData, 50, false) : null;
  const geometry = build
    ? createKeychainImageGeometry({
        build,
        centerX: 0,
        centerY: 0,
        depth: 0.6,
        rotation: 0,
        side: "front",
        size: 26,
        thickness: 2.5,
      })
    : null;

  // Материал брелока не включает `flatShading`, поэтому свет рисует по нормалям
  // сетки: без атрибута `normal` рельеф освещался бы как чёрный силуэт.
  check("рельеф собирается", geometry !== null, true);
  check(
    "у рельефа есть нормали",
    geometry ? geometry.getAttribute("normal") !== undefined : false,
    true,
  );

  geometry?.dispose();
}

console.log("");

if (failures > 0) {
  console.log(`Провалено проверок: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("Все проверки прошли.");
}


