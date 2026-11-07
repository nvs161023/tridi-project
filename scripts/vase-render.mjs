/**
 * Рендер вазы в PNG без браузера и без WebGL.
 *
 * Зачем свой растеризатор, а не скриншот `/constructor`: конструктор требует
 * входа, поэтому снимок страницы тянет за собой авторизацию, живой Supabase и
 * дев-сервер, а гейт этапа должен запускаться одной командой на чистой машине.
 * Скриншот ещё и не воспроизводим: драйвер WebGL в headless-сборке Chromium
 * может отличаться от машины к машине.
 *
 * Сам растеризатор живёт в `lib/constructor/vase-preview.ts`: тот же модуль
 * рисует плитки галереи вариантов в браузере, а здесь остаётся командная
 * строка — флаги, лист матрицы и PNG на `node:zlib`.
 *
 * Запуск по одному сочетанию:
 *   node --import ./scripts/register-alias.mjs scripts/vase-render.mjs \
 *     --shape classic --pattern honeycomb --freq 20 --size 900 \
 *     --out .fonttmp/shots/classic-honeycomb-f20.png
 *
 * Гранёная ваза: `--sides 5` строит пятигранник на любом силуэте.
 * Каннелюры и закрутка: `--flutes 12 --flute-depth 2 --twist 180`.
 * Органика, сид и наклон: `--organic 1 --seed 42 --lean 12`.
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
import {
  VASE_PREVIEW_BACKGROUND,
  renderVaseRgb,
} from "../lib/constructor/vase-preview";

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
    raw.set(rgb.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
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
    sheet.set(frame.rgb.subarray(from, from + frame.width * 3), to);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = parseArgs(process.argv.slice(2));
  const frequency = numberOption(
    args.freq,
    DEFAULT_CONSTRUCTOR_PARAMS.patterns[0].frequency,
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
  const organic = numberOption(args.organic, DEFAULT_CONSTRUCTOR_PARAMS.organic);
  const leanDeg = numberOption(args.lean, DEFAULT_CONSTRUCTOR_PARAMS.leanDeg);
  const vaseSeed = numberOption(args.seed, DEFAULT_CONSTRUCTOR_PARAMS.vaseSeed);
  const azimuth = numberOption(args.azimuth, 24);
  const elevation = numberOption(args.elevation, 12);
  const size = numberOption(args.size, 760);
  const tile = numberOption(args.tile, 300);
  const out = path.resolve(args.out ?? ".fonttmp/shots/vase.png");
  // Слой узора для рендера: тип из флага, остальное — из дефолтного слоя.
  // Затухание берём из дефолта, поэтому край кромки в кадре выглядит так же,
  // как в конструкторе.
  const layer = (type) => ({
    ...DEFAULT_CONSTRUCTOR_PARAMS.patterns[0],
    type,
    frequency,
  });
  const base = {
    ...DEFAULT_CONSTRUCTOR_PARAMS,
    model: "vase",
    patterns: [layer(DEFAULT_CONSTRUCTOR_PARAMS.patterns[0].type)],
    footMm,
    rimMm,
    sectionSides,
    twistDeg,
    flutes,
    fluteDepthMm,
    organic,
    leanDeg,
    vaseSeed,
  };

  mkdirSync(path.dirname(out), { recursive: true });

  if (args.shape !== undefined || args.pattern !== undefined) {
    const patterns = [
      layer(args.pattern ?? DEFAULT_CONSTRUCTOR_PARAMS.patterns[0].type),
    ];
    const params = {
      ...base,
      shape: args.shape ?? DEFAULT_CONSTRUCTOR_PARAMS.shape,
      patterns,
    };
    const frame = renderVaseRgb(params, {
      width: size,
      height: Math.round(size * 1.25),
      azimuth,
      elevation,
    });

    writeFileSync(out, encodePng(frame.width, frame.height, frame.rgb));
    console.log(
      `${params.shape}/${patterns[0].type} f${frequency}, цоколь ${footMm}, ` +
        `обод ${rimMm}, граней ${sectionSides}, каннелюр ${flutes} × ` +
        `${fluteDepthMm} мм, закрутка ${twistDeg}°, органика ${organic} ` +
        `(сид ${vaseSeed}), наклон ${leanDeg}°: ${frame.triangles} ` +
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
      sheet[i] = VASE_PREVIEW_BACKGROUND[0];
      sheet[i + 1] = VASE_PREVIEW_BACKGROUND[1];
      sheet[i + 2] = VASE_PREVIEW_BACKGROUND[2];
    }

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const frame = renderVaseRgb(
          {
            ...base,
            shape: VASE_SHAPES[row],
            patterns: [layer(VASE_PATTERNS[column])],
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
