import {
  SIGN_PACKAGE_TOO_LARGE_MESSAGE,
  SIGN_PRINT_BED_MM,
  listSignBlocks,
  signStlFileName,
  type SignParams,
} from "@/lib/constructor/params";
import {
  signLayoutSignature,
  type SignLayoutReport,
} from "@/lib/constructor/sign-geometry";

/** Кнопка экспорта вывески: та же форма, что у StlExportOption панели. */
export type SignExportOption = {
  id: string;
  label: string;
  description?: string;
  request: Record<string, number | string>;
  fileName: string;
};

/** Только свежий отчёт: подпись защищает от габаритов прошлой надписи. */
function actualReport(
  params: SignParams,
  report: SignLayoutReport | null,
): SignLayoutReport | null {
  return report?.signature === signLayoutSignature(params) ? report : null;
}

/**
 * Кнопки вывески: общий STL блока и отдельные лицо с крышкой.
 *
 * Общий файл стоит первым у блока, если пакет влезает на стол 220 × 220 мм.
 * Внутри пакета крышка лежит над лицом, рядом с ним или повёрнута — это решает
 * `planSignPackage`. Если места нет, кнопки нет: остаются только face и cover,
 * а панель показывает `signExportNotice`.
 */
export function signExportOptions(
  params: SignParams,
  report: SignLayoutReport | null,
): SignExportOption[] {
  const blocks = listSignBlocks(params.signText, params.signBlockSize);
  const layouts = actualReport(params, report);
  const byBlock = layouts
    ? new Map(layouts.blocks.map((block) => [block.blockIndex, block]))
    : null;

  const options = blocks.flatMap((block) => {
    const layout = byBlock?.get(block.index);
    const letters = block.letters.map((letter) => letter.char).join("");
    const blockOptions: SignExportOption[] = [];

    if (layout?.package.fits) {
      blockOptions.push({
        id: `sign-block-${block.index}-package`,
        label: `Блок ${block.index + 1}: Общий STL`,
        description: `Блок ${block.index + 1} «${letters}»: лицо и крышка одним файлом, ${Math.round(
          layout.package.width,
        )} × ${Math.round(layout.package.depth)} мм, стол ${SIGN_PRINT_BED_MM} мм`,
        request: { blockIndex: block.index, signPart: "package" },
        fileName: signStlFileName(params, block.index, "package"),
      });
    }

    for (const part of ["face", "cover"] as const) {
      blockOptions.push({
        id: `sign-block-${block.index}-${part}`,
        label: `Блок ${block.index + 1}: ${
          part === "face" ? "Лицо" : "Крышка"
        }`,
        description: `Блок ${block.index + 1} «${letters}»: ${
          part === "face" ? "лицо" : "крышка"
        } отдельным файлом`,
        request: { blockIndex: block.index, signPart: part },
        fileName: signStlFileName(params, block.index, part),
      });
    }

    return blockOptions;
  });

  if (options.length > 0) {
    return options;
  }

  // Пустая надпись: кнопка остаётся, но сервер отклонит запрос и панель
  // покажет подсказку — так пользователь видит, что нужно ввести буквы.
  return [
    {
      id: "sign-empty",
      label: "Блок 1: Лицо",
      description: "В надписи нет букв",
      request: { blockIndex: 0, signPart: "face" },
      fileName: signStlFileName(params, 0, "face"),
    },
  ];
}

/**
 * Предупреждение о пакете, который не влезает на стол.
 *
 * null — все блоки помещаются или отчёт ещё не пришёл. Текст не блокирует
 * отдельные файлы: он лишь объясняет, почему кнопки «Общий STL» нет.
 */
export function signExportNotice(
  params: SignParams,
  report: SignLayoutReport | null,
): string | null {
  const layouts = actualReport(params, report);

  return layouts && layouts.blocks.some((block) => !block.package.fits)
    ? SIGN_PACKAGE_TOO_LARGE_MESSAGE
    : null;
}
