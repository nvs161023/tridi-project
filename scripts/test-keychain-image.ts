/**
 * Тест маски картинки брелока: краска, порог, дилатация тонкого, обводка.
 *
 * Правила, которые здесь закреплены, выведены из жалобы «логотип в рельефе не
 * читается». Первое: доля краски в непрозрачной картинке — это
 * `1 − min(R,G,B)/255`, а не яркость. Прежняя формула по светлоте давала синему
 * 0.59, светло-синему 0.34 и жёлтому 0.09, поэтому при пороге 50 % цветные части
 * логотипа пропадали, и на рельефе оставались только тёмные фрагменты. Второе:
 * дилатация расширяет только штрих без «ядра» (ячейки, у которой все четыре соседа
 * тоже пластик). Сплошное расширение добавляло по ячейке с каждой стороны любому
 * контуру, просветы между буквами зарастали, и мелкий текст слипался в пятно.
 * Третье: обводка обязана повторять маску — иначе панель показывает одно, а STL
 * печатает другое.
 *
 * Что проверяется:
 *   1. цвет даёт краску: синий и жёлтый логотипы проходят порог 50 %, а пастельный
 *      фон — нет, поэтому белый лист не печатается;
 *   2. пустая картинка возвращает `empty`, а не пустую маску;
 *   3. порог режет по ступеням: 13 проходит при 50 %, 6 нет, при 60 % проходит 6, а
 *      белый фон остаётся фоном даже при 100 %;
 *   4. дилатация меряется ядром: линия в одну ячейку становится тремя, полоса в
 *      пять ячеек остаётся пятью, а одиночная точка не раздувается в крест;
 *   5. инверсия меняет пластик и фон местами;
 *   6. маска переживает упаковку в строку `imageData` без потерь и влезает в предел
 *      `params_json`; габарит маски лежит в одном байте, поэтому сетка не больше 255;
 *   7. обводка совпадает с маской: заливка контуров обратно в сетку даёт не больше
 *      4 % расхождения, инверсия даёт другую маску, а мягкий край отзывается на
 *      порог — кеш сборки различает параметры;
 *   8. рельеф входит в тело на 0.35 мм: `keychainImageReliefMm` складывает выступ и
 *      внедрение.
 *
 * Запуск: `npm run check:keychain`.
 */
import {
  KEYCHAIN_IMAGE_FIELD_LEVELS,
  KEYCHAIN_IMAGE_GRID,
  keychainImageBuild,
  keychainImageErrorText,
  keychainImageField,
  keychainImageFromPixels,
  keychainImageMask,
  keychainImageReliefMm,
  type KeychainImageField,
} from "../lib/constructor/keychain-image";
import { KEYCHAIN_IMAGE_MAX_LENGTH } from "../lib/constructor/params";

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
console.log("Дилатация тонкого");
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

  check("ширина полосы прежняя", rowWidth(barMask, 9, 4), 5);
  check("полоса в пять ячеек не раздулась", countBits(barMask), 45);

  // Одиночная точка: крест из пяти ячеек срезается до одной — это крупа.
  const dot = new Array(9).fill(0);

  dot[40] = KEYCHAIN_IMAGE_FIELD_LEVELS - 1;

  check(
    "одиночная точка не раздувается",
    countBits(keychainImageMask(fieldOf(dot, 9, 9), 50, false)),
    1,
  );
}

console.log("");
console.log("Инверсия");
{
  const dot = new Array(25).fill(0);

  dot[12] = KEYCHAIN_IMAGE_FIELD_LEVELS - 1;

  const field = fieldOf(dot, 5, 5);

  check("без инверсии — одна ячейка", countBits(keychainImageMask(field, 50, false)), 1);
  check(
    "с инверсией — весь кадр без точки",
    countBits(keychainImageMask(field, 50, true)),
    24,
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

  check("сетка маски влезает в байт габарита", KEYCHAIN_IMAGE_GRID <= 255, true);
  check("сетка не мельче 240 ячеек", KEYCHAIN_IMAGE_GRID >= 240, true);

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

console.log("");

if (failures > 0) {
  console.log(`Провалено проверок: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("Все проверки прошли.");
}


