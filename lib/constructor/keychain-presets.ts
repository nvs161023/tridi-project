/**
 * Новые силуэты брелока: реестр пресетов.
 *
 * Это первый шаг замены старых четырнадцати силуэтов (`dog_tag`, `hexagon`,
 * `cat`, …), которые выглядели примитивно. Пресет — не SVG-строка, а описание
 * формы: идентификатор, подпись, пояснение и три размера по умолчанию. Геометрия
 * каждого пресета строится кодом в lib/constructor/keychain-preset-geometry.ts и
 * подключается по одному: готовые перечислены в `IMPLEMENTED_KEYCHAIN_PRESETS`,
 * остальные пока собираются по прежнему силуэту из
 * lib/constructor/keychain-shapes.ts и не отдают STL.
 *
 * Размеры пресета лежат внутри границ слайдеров брелока
 * (`CONSTRUCTOR_LIMITS.length` 30–100, `width` 20–50, `thickness` 2–5 с шагом
 * 0.5 мм), чтобы выбор пресета никогда не выталкивал панель в недопустимое
 * значение. `defaultHeight` — это прежняя «длина» сверху вниз: ушко под кольцо
 * входит в этот габарит.
 */

/** Идентификаторы восьми новых силуэтов; порядок задаёт порядок в списке. */
export const KEYCHAIN_PRESET_IDS = [
  "apple-tag",
  "capsule",
  "hex",
  "gear",
  "brick",
  "ticket",
  "starburst",
  "heart",
] as const;

export type KeychainPresetId = (typeof KEYCHAIN_PRESET_IDS)[number];

/** Описание одного силуэта: что за форма и с каких размеров её начинать. */
export type KeychainPreset = {
  /** Идентификатор в реестре и в состоянии панели. */
  id: KeychainPresetId;
  /** Название в выпадающем списке: короткое, чтобы влезало на мобильном. */
  label: string;
  /** Пояснение под списком: чем форма отличается от соседних. */
  description: string;
  /** Ширина в самой широкой части, мм. */
  defaultWidth: number;
  /** Высота сверху вниз, мм; ушко под кольцо входит в габарит. */
  defaultHeight: number;
  /** Толщина основы, мм: задаёт прочность ушка и глубину рельефа. */
  defaultThickness: number;
};

/**
 * Восемь новых силуэтов в том порядке, в котором их видит пользователь.
 *
 * Размеры подобраны под форму: узкая капсула не раздувается в ширину, шестерня
 * получает ширину под зубья, а тонкий билет печатается за меньшее время.
 */
export const KEYCHAIN_PRESETS: KeychainPreset[] = [
  {
    id: "apple-tag",
    label: "Apple Tag",
    description:
      "Скруглённый корпус без отдельного ушка: кольцо проходит сквозь отверстие в теле брелока.",
    defaultWidth: 38,
    defaultHeight: 44,
    defaultThickness: 3.5,
  },
  {
    id: "capsule",
    label: "Capsule",
    description:
      "Узкая капсула с торцами-полукругами: имя идёт в одну строку, на связке не цепляется за ключи.",
    defaultWidth: 24,
    defaultHeight: 64,
    defaultThickness: 3,
  },
  {
    id: "hex",
    label: "Hex",
    description:
      "Шестигранник с фаской: самая спокойная форма после овала, ушко выходит из верхней грани.",
    defaultWidth: 34,
    defaultHeight: 40,
    defaultThickness: 3,
  },
  {
    id: "gear",
    label: "Gear",
    description:
      "Шестерня с восьмью зубьями: зубья читаются и на тонкой основе, поэтому печатается прочно.",
    defaultWidth: 44,
    defaultHeight: 46,
    defaultThickness: 4,
  },
  {
    id: "brick",
    label: "Brick",
    description:
      "Кирпич четыре на восемь шипов с шагом 8 мм: пресс-посадка под обычный конструктор.",
    defaultWidth: 32,
    defaultHeight: 64,
    defaultThickness: 4,
  },
  {
    id: "ticket",
    label: "Ticket",
    description:
      "Билет с отрывным корешком снизу: пунктир сквозных щелей и вырезы на кромках, проушина Ø11 мм с отверстием под кольцо сверху.",
    defaultWidth: 28,
    defaultHeight: 60,
    defaultThickness: 3,
  },
  {
    id: "starburst",
    label: "Starburst",
    description:
      "Вспышка из восьми лучей: кончики скруглены, чтобы не колоть ладонь и не ломаться в кармане.",
    defaultWidth: 42,
    defaultHeight: 44,
    defaultThickness: 3,
  },
  {
    id: "heart",
    label: "Heart",
    description:
      "Сердце с выемкой между долями: ушко садится в выемку и не выходит за габарит.",
    defaultWidth: 38,
    defaultHeight: 40,
    defaultThickness: 3,
  },
];

/** Быстрый доступ по идентификатору: панель и геометрия ищут пресет каждый рендер. */
const PRESET_BY_ID = new Map<KeychainPresetId, KeychainPreset>(
  KEYCHAIN_PRESETS.map((preset) => [preset.id, preset]),
);

/** Проверка значения из состояния, ссылки или API: только восемь известных id. */
export function isKeychainPresetId(value: unknown): value is KeychainPresetId {
  return (
    typeof value === "string" &&
    (KEYCHAIN_PRESET_IDS as readonly string[]).includes(value)
  );
}

/**
 * Пресет по идентификатору.
 *
 * Тип аргумента не пускает чужое значение, а проверка остаётся на случай
 * устаревшего состояния в браузере: лучше упасть здесь, чем построить модель по
 * форме, которой больше нет в реестре.
 */
export function keychainPresetById(id: KeychainPresetId): KeychainPreset {
  const preset = PRESET_BY_ID.get(id);

  if (!preset) {
    throw new Error(`Неизвестный пресет брелока: ${id}`);
  }

  return preset;
}
