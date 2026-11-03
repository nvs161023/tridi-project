/**
 * Служебные коды моделей Bambu Lab и их человеческие названия.
 *
 * Bambu Studio 02.x пишет в `Metadata/slice_info.config` не название станка, а
 * код модели из своего профиля:
 *
 *   <metadata key="printer_model_id" value="N2S"/>
 *
 * «N2S» — это Bambu Lab A1. Мастер видел в карточке заказа «файл нарезан для
 * N2S» и не понимал, что файл как раз под его принтер. Версии слайсера до 02.x
 * кладут в то же поле готовое название, поэтому коды разбираются, а не
 * считаются единственно верным значением: незнакомое значение уходит как есть.
 *
 * Коды взяты из официальных профилей станков Bambu Studio — файлы
 * `resources/profiles/BBL/machine/*.json`, поле `model_id`:
 *
 *   Bambu Lab A1        → N2S        Bambu Lab P1S   → C12
 *   Bambu Lab A1 mini   → N1         Bambu Lab X1E   → C13
 *   Bambu Lab P1P       → C11        Bambu Lab X1C   → BL-P001
 *   Bambu Lab X1        → BL-P002    Bambu Lab H2D   → O1D
 *
 * Модуль без зависимостей от Node: его читают и браузерные компоненты
 * (`lib/3d/print-compatibility.ts` сверяет разметку 3MF с карточкой принтера).
 */

/** Модель Bambu Lab: код профиля, подпись и другие написания того же станка. */
type BambuModel = {
  /** Код из профиля Bambu Studio — то, что попадает в `slice_info.config`. */
  code: string;
  /** Название для человека: так модель подписана в справочнике принтеров. */
  name: string;
  /** Другие написания: короткая модель из карточки и официальное название. */
  aliases: readonly string[];
};

/**
 * Таблица моделей. Порядок не важен, но `A1` стоит раньше `A1 mini` только для
 * читаемости: ключи сравниваются целиком, поэтому «A1 mini» не станет «A1».
 */
const BAMBU_MODELS: readonly BambuModel[] = [
  { code: "N2S", name: "Bambu Lab A1", aliases: ["A1"] },
  { code: "N1", name: "Bambu Lab A1 mini", aliases: ["A1 mini"] },
  { code: "C11", name: "Bambu Lab P1P", aliases: ["P1P"] },
  { code: "C12", name: "Bambu Lab P1S", aliases: ["P1S"] },
  { code: "C13", name: "Bambu Lab X1E", aliases: ["X1E"] },
  {
    code: "BL-P001",
    name: "Bambu Lab X1C",
    aliases: ["X1C", "X1 Carbon", "Bambu Lab X1 Carbon"],
  },
  { code: "BL-P002", name: "Bambu Lab X1", aliases: ["X1"] },
  { code: "O1D", name: "Bambu Lab H2D", aliases: ["H2D"] },
];

/**
 * Ключ сравнения: регистр, вид тире и лишние пробелы не важны. То же правило,
 * что у `normalizePrinterModel()` из справочника принтеров, но без импорта:
 * модуль должен остаться без зависимостей.
 */
function normalizeKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/[—–-]/g, " ")
    .replace(/\s+/g, " ");
}

/** Код модели → её подпись («N2S» → «Bambu Lab A1»). */
const NAME_BY_CODE = new Map<string, string>(
  BAMBU_MODELS.map((model) => [normalizeKey(model.code), model.name]),
);

/** Код, подпись или другое написание → код модели («x1 carbon» → «bl p001»). */
const CODE_BY_NAME = new Map<string, string>();

for (const model of BAMBU_MODELS) {
  const code = normalizeKey(model.code);

  for (const name of [model.code, model.name, ...model.aliases]) {
    CODE_BY_NAME.set(normalizeKey(name), code);
  }
}

/**
 * Служебный код → название модели. Незнакомое значение возвращается как есть:
 * у слайсеров кроме Bambu Studio в этом поле стоит готовое название.
 */
export function resolvePrinterModelCode(value: string): string {
  const key = normalizeKey(value);

  if (!key) {
    return value.trim();
  }

  return NAME_BY_CODE.get(key) ?? value.trim();
}

/**
 * Код модели Bambu Lab по названию, другому написанию или самому коду.
 *
 * null — это не модель Bambu Lab, и вызывающий сравнивает строки как раньше.
 * Нужен сверке файла с принтером: «N2S», «Bambu Lab A1» и «A1» — один станок,
 * а «A1 mini» — другой.
 */
export function bambuPrinterCode(value: string): string | null {
  const key = normalizeKey(value);

  if (!key) {
    return null;
  }

  return CODE_BY_NAME.get(key) ?? null;
}

/**
 * Похоже на служебный код, а не на название модели: «N2S», «C12», «O1S»,
 * «BL-P003».
 *
 * По этой примете разбор 3MF выбирает источник, когда слайсер написал в двух
 * файлах разное: название из `project_settings.config` понятнее кода из
 * `slice_info.config`, даже если код незнаком (новая модель Bambu).
 */
export function isPrinterModelCode(value: string): boolean {
  const key = normalizeKey(value);

  return /^[a-z]{1,3} ?[a-z0-9]{1,4}$/u.test(key);
}
