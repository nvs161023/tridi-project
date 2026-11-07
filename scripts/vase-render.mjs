/**
 * Рендер вазы в PNG без браузера и без WebGL.
 *
 * Зачем свой растеризатор, а не скриншот `/constructor`: конструктор требует
 * входа, поэтому снимок страницы тянет за собой авторизацию, живой Supabase и
 * дев-сервер, а гейт этапа должен запускаться одной командой на чистой машине.
 * Скриншот ещё и не воспроизводим: драйвер WebGL в headless-сборке Chromium
 * может отличаться от машины к машине.
 *
 * Здесь сетка строится тем же `createVaseGeometry`, что и в продукте, и
 * рисуется в буфер по z-буферу с плоским затенением: этого достаточно, чтобы
 * увидеть силуэт, частоту рельефа и ступеньки на горизонтальных гранях. PNG
 * собирается своим кодировщиком на `node:zlib` — новых зависимостей нет, а
 * результат совпадает байт в байт при повторном запуске.
 *
 * Запуск по одному сочетанию:
 *   node --import ./scripts/register-alias.mjs scripts/vase-render.mjs \
 *     --shape classic --pattern honeycomb --freq 20 --size 900 \
 *     --out .fonttmp/shots/classic-honeycomb-f20.png
 *
 * Гранёная ваза: `--sides 5` строит пятигранник на любом силуэте.
 * Каннелюры и закрутка: `--flutes 12 --flute-depth 2 --twist 180`.
 *
 * Лист целиком (по строке на силуэт, по столбцу на узор):
 *   node --import ./scripts/register-alias.mjs scripts/vase-render.mjs \
 *     --freq 8 --out .fonttmp/shots/vase-f8.png
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";

import {
  DEFAULT_CONSTRUCTOR_PARAMS,
  VASE_PATTERNS,
  VASE_SHAPES,
} from "../lib/constructor/params";
import { createVaseGeometry } from "../lib/constructor/vase-geometry";
import { createVaseProfile } from "../lib/constructor/vase-profile";

/** Фон снимка: тёмная плита, как сцена конструктора. */
const BACKGROUND = [17, 24, 39];
/** Цвет пластика: тёплый светлый, чтобы рельеф читался тенями. */
const PLASTIC = [236, 227, 214];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c;
  }

  return table;
})();

function crc32(buffer) {
  let c = -1;

  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }

  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([length, body, crc]);
}

/**
 * PNG из буфера RGB.
 *
 * Восемь бит на канал, без альфы и без сжатия строк фильтрами: изображение
 * уходит в репозиторий только как артефакт гейта, поэтому простота важнее
 * размера, а `deflate` из стандартной библиотеки своё дело знает.
 */
export function encodePng(width, height, rgb) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Базис ортографической камеры.
 *
 * Азимут 0 — взгляд с фронта (ось +Z), азимут 90 — сбоку. Наклон ограничен
 * ±80°, иначе «вверх» камеры вырождается вместе с моделью в кадре.
 */
function cameraBasis(azimuthDeg, elevationDeg) {
  const azimuth = (azimuthDeg * Math.PI) / 180;
  const elevation = (Math.max(-80, Math.min(80, elevationDeg)) * Math.PI) / 180;
  const cosElevation = Math.cos(elevation);
  const eye = [
    Math.sin(azimuth) * cosElevation,
    Math.sin(elevation),
    Math.cos(azimuth) * cosElevation,
  ];
  const right = normalize(cross([0, 1, 0], eye));

  return { eye, right, up: normalize(cross(eye, right)) };
}

/**
 * Снимок вазы: RGB-буфер в размер `width × height`.
 *
 * Сетка берётся из экспортного бюджета, а не из предпросмотра: гейт этапа
 * должен показывать самую мелкую геометрию, которую можно скачать, иначе
 * ступеньки и «звон» рельефа сгладит урезанное разрешение.
 *
 * Сглаживание — суперсэмплингом: кадр рисуется в `supersample` раз крупнее и
 * сводится усреднением. Порядок треугольников не важен, глубину решает
 * z-буфер, поэтому внутренние стенки сквозь горло видны правильно.
 */
export function renderVaseRgb(params, options = {}) {
  const {
    width = 720,
    height = 900,
    azimuth = 24,
    elevation = 12,
    supersample = 2,
    background = BACKGROUND,
    plastic = PLASTIC,
  } = options;

  const geometry = createVaseGeometry(createVaseProfile(params), params, {
    budget: "export",
  });
  const position = geometry.getAttribute("position").array;
  const index = geometry.getIndex();
  const corners = index ? index.array : null;
  const vertexCount = position.length / 3;
  const triangles = corners ? corners.length / 3 : vertexCount / 3;

  const frameWidth = width * supersample;
  const frameHeight = height * supersample;
  const { eye, right, up } = cameraBasis(azimuth, elevation);

  // Проекция в камеру: u — вправо, v — вверх, d — к зрителю.
  const projected = new Float32Array(position.length);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;

  for (let i = 0; i < position.length; i += 3) {
    const x = position[i];
    const y = position[i + 1];
    const z = position[i + 2];
    const u = x * right[0] + y * right[1] + z * right[2];
    const v = x * up[0] + y * up[1] + z * up[2];

    projected[i] = u;
    projected[i + 1] = v;
    projected[i + 2] = x * eye[0] + y * eye[1] + z * eye[2];

    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  const scale =
    Math.min(frameWidth / (maxU - minU || 1), frameHeight / (maxV - minV || 1)) *
    0.92;
  const centerU = (minU + maxU) / 2;
  const centerV = (minV + maxV) / 2;

  // Экранные координаты вершин: пиксели, y вниз.
  const screenX = new Float32Array(vertexCount);
  const screenY = new Float32Array(vertexCount);
  const screenD = new Float32Array(vertexCount);

  for (let i = 0; i < vertexCount; i += 1) {
    screenX[i] = (projected[i * 3] - centerU) * scale + frameWidth / 2;
    screenY[i] = frameHeight / 2 - (projected[i * 3 + 1] - centerV) * scale;
    screenD[i] = projected[i * 3 + 2];
  }

  const pixels = Buffer.alloc(frameWidth * frameHeight * 3);

  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = background[0];
    pixels[i + 1] = background[1];
    pixels[i + 2] = background[2];
  }

  const depth = new Float32Array(frameWidth * frameHeight).fill(-Infinity);

  // Два источника света в мире: основной сверху-слева и слабая подсветка
  // справа, чтобы глубина рельефа читалась и в тенях.
  const lightA = normalize([-0.45, 0.75, 0.55]);
  const lightB = normalize([0.65, -0.1, 0.35]);

  for (let t = 0; t < triangles; t += 1) {
    const i0 = corners ? corners[t * 3] : t * 3;
    const i1 = corners ? corners[t * 3 + 1] : t * 3 + 1;
    const i2 = corners ? corners[t * 3 + 2] : t * 3 + 2;

    const ax = screenX[i0];
    const ay = screenY[i0];
    const bx = screenX[i1];
    const by = screenY[i1];
    const cx = screenX[i2];
    const cy = screenY[i2];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

    if (area === 0) {
      continue;
    }

    // Нормаль считается по исходным координатам в миллиметрах: экранные уже
    // сжаты масштабом кадра, и по ним освещение поехало бы вместе с зумом.
    const p0 = i0 * 3;
    const p1 = i1 * 3;
    const p2 = i2 * 3;
    let normal = normalize(
      cross(
        [
          position[p1] - position[p0],
          position[p1 + 1] - position[p0 + 1],
          position[p1 + 2] - position[p0 + 2],
        ],
        [
          position[p2] - position[p0],
          position[p2 + 1] - position[p0 + 1],
          position[p2 + 2] - position[p0 + 2],
        ],
      ),
    );

    // Затенение двустороннее: сквозь горло видна внутренняя стенка, и без
    // разворота нормали она провалилась бы в чёрный.
    if (normal[0] * eye[0] + normal[1] * eye[1] + normal[2] * eye[2] < 0) {
      normal = [-normal[0], -normal[1], -normal[2]];
    }

    const key = Math.max(
      0,
      normal[0] * lightA[0] + normal[1] * lightA[1] + normal[2] * lightA[2],
    );
    const fill = Math.max(
      0,
      normal[0] * lightB[0] + normal[1] * lightB[1] + normal[2] * lightB[2],
    );
    const shade = Math.min(1.15, 0.18 + 0.66 * key + 0.2 * fill);
    const red = Math.min(255, Math.round(plastic[0] * shade));
    const green = Math.min(255, Math.round(plastic[1] * shade));
    const blue = Math.min(255, Math.round(plastic[2] * shade));

    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(frameWidth - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(frameHeight - 1, Math.ceil(Math.max(ay, by, cy)));

    for (let y = minY; y <= maxY; y += 1) {
      const py = y + 0.5;

      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5;
        const w0 = (cx - bx) * (py - by) - (px - bx) * (cy - by);
        const w1 = (ax - cx) * (py - cy) - (px - cx) * (ay - cy);
        const w2 = (bx - ax) * (py - ay) - (px - ax) * (by - ay);

        if (
          !((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0))
        ) {
          continue;
        }

        const sum = w0 + w1 + w2;

        if (sum === 0) {
          continue;
        }

        const z = (w0 * screenD[i0] + w1 * screenD[i1] + w2 * screenD[i2]) / sum;
        const pixel = y * frameWidth + x;

        if (z <= depth[pixel]) {
          continue;
        }

        depth[pixel] = z;
        const offset = pixel * 3;
        pixels[offset] = red;
        pixels[offset + 1] = green;
        pixels[offset + 2] = blue;
      }
    }
  }

  geometry.dispose();

  const rgb = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;

      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const offset =
            ((y * supersample + sy) * frameWidth + x * supersample + sx) * 3;
          red += pixels[offset];
          green += pixels[offset + 1];
          blue += pixels[offset + 2];
        }
      }

      const area = supersample * supersample;
      const offset = (y * width + x) * 3;
      rgb[offset] = Math.round(red / area);
      rgb[offset + 1] = Math.round(green / area);
      rgb[offset + 2] = Math.round(blue / area);
    }
  }

  return { rgb, width, height, triangles, vertices: vertexCount };
}



/** Разбор `--ключ значение`: только пары, без коротких флагов. */
function parseArgs(argv) {
  const options = {};

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];

    if (!key.startsWith("--")) {
      throw new Error(`Ожидался ключ вида --name, получено: ${key}`);
    }

    if (value === undefined || value.startsWith("--")) {
      throw new Error(`У ключа ${key} нет значения`);
    }

    options[key.slice(2)] = value;
    i += 1;
  }

  return options;
}

function numberOption(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Ожидалось число, получено: ${value}`);
  }

  return parsed;
}

/** Копирует кадр в лист по сетке; фон листа остаётся вокруг плиток. */
function blit(sheet, sheetWidth, frame, left, top) {
  for (let y = 0; y < frame.height; y += 1) {
    const from = y * frame.width * 3;
    const to = ((top + y) * sheetWidth + left) * 3;
    frame.rgb.copy(sheet, to, from, from + frame.width * 3);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = parseArgs(process.argv.slice(2));
  const frequency = numberOption(
    args.freq,
    DEFAULT_CONSTRUCTOR_PARAMS.patternFrequency,
  );
  const footMm = numberOption(args.foot, DEFAULT_CONSTRUCTOR_PARAMS.footMm);
  const rimMm = numberOption(args.rim, DEFAULT_CONSTRUCTOR_PARAMS.rimMm);
  const sectionSides = numberOption(
    args.sides,
    DEFAULT_CONSTRUCTOR_PARAMS.sectionSides,
  );
  const twistDeg = numberOption(args.twist, DEFAULT_CONSTRUCTOR_PARAMS.twistDeg);
  const flutes = numberOption(args.flutes, DEFAULT_CONSTRUCTOR_PARAMS.flutes);
  const fluteDepthMm = numberOption(
    args["flute-depth"],
    DEFAULT_CONSTRUCTOR_PARAMS.fluteDepthMm,
  );
  const azimuth = numberOption(args.azimuth, 24);
  const elevation = numberOption(args.elevation, 12);
  const size = numberOption(args.size, 760);
  const tile = numberOption(args.tile, 300);
  const out = path.resolve(args.out ?? ".fonttmp/shots/vase.png");
  const base = {
    ...DEFAULT_CONSTRUCTOR_PARAMS,
    model: "vase",
    patternFrequency: frequency,
    footMm,
    rimMm,
    sectionSides,
    twistDeg,
    flutes,
    fluteDepthMm,
  };

  mkdirSync(path.dirname(out), { recursive: true });

  if (args.shape !== undefined || args.pattern !== undefined) {
    const params = {
      ...base,
      shape: args.shape ?? DEFAULT_CONSTRUCTOR_PARAMS.shape,
      pattern: args.pattern ?? DEFAULT_CONSTRUCTOR_PARAMS.pattern,
    };
    const frame = renderVaseRgb(params, {
      width: size,
      height: Math.round(size * 1.25),
      azimuth,
      elevation,
    });

    writeFileSync(out, encodePng(frame.width, frame.height, frame.rgb));
    console.log(
      `${params.shape}/${params.pattern} f${frequency}, цоколь ${footMm}, ` +
        `обод ${rimMm}, граней ${sectionSides}, каннелюр ${flutes} × ` +
        `${fluteDepthMm} мм, закрутка ${twistDeg}°: ${frame.triangles} ` +
        `треугольников, ${frame.width} × ${frame.height} → ${out}`,
    );
  } else {
    // Лист всей матрицы: строка — силуэт, столбец — узор. Одного взгляда
    // хватает, чтобы увидеть, где рельеф «звенит» и где силуэт поехал.
    const columns = VASE_PATTERNS.length;
    const rows = VASE_SHAPES.length;
    const tileHeight = Math.round(tile * 1.25);
    const gap = 8;
    const width = columns * tile + (columns + 1) * gap;
    const height = rows * tileHeight + (rows + 1) * gap;
    const sheet = Buffer.alloc(width * height * 3);
    let worst = 0;

    for (let i = 0; i < sheet.length; i += 3) {
      sheet[i] = BACKGROUND[0];
      sheet[i + 1] = BACKGROUND[1];
      sheet[i + 2] = BACKGROUND[2];
    }

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const frame = renderVaseRgb(
          {
            ...base,
            shape: VASE_SHAPES[row],
            pattern: VASE_PATTERNS[column],
          },
          { width: tile, height: tileHeight, azimuth, elevation },
        );

        worst = Math.max(worst, frame.triangles);
        blit(
          sheet,
          width,
          frame,
          gap + column * (tile + gap),
          gap + row * (tileHeight + gap),
        );
      }
    }

    writeFileSync(out, encodePng(width, height, sheet));
    console.log(
      `Лист ${rows} силуэтов × ${columns} узоров, частота ${frequency}, ` +
        `цоколь ${footMm}, обод ${rimMm}: ` +
        `${width} × ${height}, максимум ${worst} треугольников → ${out}`,
    );
  }
}
