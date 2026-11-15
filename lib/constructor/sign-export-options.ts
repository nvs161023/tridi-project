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
 * Кнопки вывески: общий STL блока и отдельные детали.
 *
 * Общий файл стоит первым у блока, если пакет влезает на стол 220 × 220 мм.
 * Внутри пакета задняя стенка лежит над лицом, рядом с ним или повёрнута — это
 * решает `planSignPackage`. Если места нет, кнопки нет: остаются отдельные
 * лицо и задняя стенка, а в съёмном режиме ещё и рельс; панель показывает
 * `signExportNotice`.
 *
 * Рельс отдельной кнопкой есть только в съёмном режиме. В жёстком он уже
 * напечатан вместе с задней стенкой, в режиме без рельса его нет вовсе.
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
      const coverContents =
        params.signRailMode === "fixed"
          ? "задняя стенка с рельсом"
          : "задняя стенка";
      const contents = layout.coverWidth > 0 ? `лицо и ${coverContents}` : "лицо";

      blockOptions.push({
        id: `sign-block-${block.index}-package`,
        label: `Блок ${block.index + 1}: Общий STL`,
        description: `Блок ${block.index + 1} «${letters}»: ${contents} одним файлом, ${Math.round(
          layout.package.width,
        )} × ${Math.round(layout.package.depth)} мм, стол ${SIGN_PRINT_BED_MM} мм`,
        request: { blockIndex: block.index, signPart: "package" },
        fileName: signStlFileName(params, block.index, "package"),
      });
    }

    const parts: ("face" | "cover" | "rail")[] = ["face"];

    // У сплошной буквы задней стенки нет: пустой файл не предлагаем.
    if (!layout || layout.coverWidth > 0) {
      parts.push("cover");
    }

    // В fixed рельс уже входит в cover, в none его нет: отдельная кнопка не
    // нужна, иначе пользователь скачал бы пустой файл.
    if (params.signRailMode === "detachable") {
      parts.push("rail");
    }

    for (const part of parts) {
      const label =
        part === "face"
          ? "Лицо"
          : part === "cover"
            ? params.signRailMode === "fixed"
              ? "Задняя стенка с рельсом"
              : "Задняя стенка"
            : "Рельс";
      const lower = label.toLowerCase();
      const description =
        part === "cover" && params.signRailMode === "fixed"
          ? `Блок ${block.index + 1} «${letters}»: стенка и рельс одной деталью`
          : `Блок ${block.index + 1} «${letters}»: ${lower} отдельным файлом`;

      blockOptions.push({
        id: `sign-block-${block.index}-${part}`,
        label: `Блок ${block.index + 1}: ${label}`,
        description,
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
