/**
 * Галерея рецептов вазы: двенадцать готовых ваз вместо двенадцати слайдеров.
 *
 * Зачем отдельный файл данных: рецепт — это контент, а не настройка панели. Его
 * читают три места сразу — панель (плитки и клик), скрипт рендера (PNG для этих
 * плиток) и проверка геометрии (каждая ваза обязана собираться). Пока список жил
 * бы внутри компонента, картинки в галерее и модель после клика разъезжались бы
 * молча.
 *
 * Рецепт несёт полные параметры вазы, а не «дельты» от текущего состояния.
 * Размеры входят в рецепт: у приземистого «Гриба» и вытянутой «Бутыли» разная
 * высота, иначе смысл силуэта терялся бы. Поэтому и PNG рисуется из тех же
 * чисел, что применяет клик.
 */
import {
  DEFAULT_VASE_PARAMS,
  VASE_DEFAULT_FADE_BOTTOM_MM,
  VASE_DEFAULT_FADE_TOP_MM,
  normalizeVaseParams,
  type PatternLayer,
  type VaseParams,
  type VasePattern,
} from "@/lib/constructor/params";

/** Один рецепт: подпись для плитки и параметры, которые применяются кликом. */
export type VaseRecipe = {
  /** Идентификатор: он же имя файла PNG в `public/constructor/recipes`. */
  id: string;
  /** Название на плитке: имя модели, поэтому латиницей. */
  name: string;
  /** Одна строка о том, чем эта ваза отличается от соседней по плитке. */
  description: string;
  /** Параметры вазы; отсутствующие поля берутся из значений по умолчанию. */
  params: Partial<VaseParams>;
};

/**
 * Слой узора с печатным затуханием по умолчанию.
 *
 * Затухание у всех рецептов одинаковое — 5 мм у кромки и 3 мм у дна: оно нужно не
 * рисунку, а печати. Другое значение появится только там, где рецепт про сам
 * силуэт и декор должен начаться выше.
 */
function layer(
  type: VasePattern,
  amplitude: number,
  frequency: number,
  fade: { top: number; bottom: number } = {
    top: VASE_DEFAULT_FADE_TOP_MM,
    bottom: VASE_DEFAULT_FADE_BOTTOM_MM,
  },
): PatternLayer {
  return {
    type,
    amplitude,
    frequency,
    phaseDeg: 0,
    envelope: { fadeTopMm: fade.top, fadeBottomMm: fade.bottom },
  };
}

/**
 * Двенадцать рецептов: от строгого минимализма до муара и чешуи.
 *
 * Порядок — от спокойного к декоративному: глаз идёт по плиткам слева направо, и
 * первая ваза задаёт тон галерее. Высота и диаметр подобраны под силуэт: «Грибу»
 * нужна широкая шляпка, «Бутыли» — узкое горло, а рёбрам — высота, на которой
 * они читаются.
 */
export const VASE_RECIPES: readonly VaseRecipe[] = [
  {
    id: "japandi-ribs",
    name: "Japandi Ribs",
    description: "Строгие рёбра и матовый минимализм: спокойная форма, тонкий рельеф.",
    params: {
      height: 180,
      diameter: 90,
      shape: "classic",
      patterns: [layer("ribs", 1.2, 24)],
    },
  },
  {
    id: "twisted-fluted",
    name: "Twisted Fluted",
    description: "Кручёные жёлоба на бутылочном силуэте: закрутка 180°.",
    params: {
      height: 200,
      diameter: 80,
      shape: "bottle",
      twistDeg: 180,
      patterns: [layer("flutes", 1.5, 16)],
    },
  },
  {
    id: "organic-blob",
    name: "Organic Blob",
    description: "Мятая глина: органика 50 %, ни одного прямого угла.",
    params: {
      height: 150,
      diameter: 100,
      shape: "bubble",
      organic: 0.5,
      patterns: [layer("smooth", 0, 20)],
    },
  },
  {
    id: "low-poly-hex",
    name: "Low-poly Hex",
    description: "Шесть граней и плоское затенение: честный low-poly.",
    params: {
      height: 160,
      diameter: 95,
      shape: "classic",
      sectionSides: 6,
      patterns: [layer("smooth", 0, 20)],
    },
  },
  {
    id: "basket-weave",
    name: "Basket Weave",
    description: "Плетение корзины на ровном цилиндре: полосы над-под.",
    params: {
      height: 130,
      diameter: 90,
      shape: "cylinder",
      patterns: [layer("basket", 1, 12)],
    },
  },
  {
    id: "moire-illusion",
    name: "Moire Illusion",
    description: "Муар: пятна там, где встречаются две решётки.",
    params: {
      height: 170,
      diameter: 95,
      shape: "classic",
      patterns: [layer("moire", 1.2, 10)],
    },
  },
  {
    id: "chevron-tech",
    name: "Chevron Tech",
    description: "Шеврон по спирали: галочки уходят вверх наискось, закрутка 90°.",
    params: {
      height: 175,
      diameter: 90,
      shape: "classic",
      twistDeg: 90,
      patterns: [layer("chevron", 1.5, 8)],
    },
  },
  {
    id: "scales-armor",
    name: "Scales Armor",
    description: "Чешуя на широкой шляпке: гриб в броне из перекрытых чешуек.",
    params: {
      height: 150,
      diameter: 110,
      shape: "mushroom",
      patterns: [layer("scales", 1, 16)],
    },
  },
  {
    id: "honeycomb-bee",
    name: "Honeycomb Bee",
    description: "Тонкие соты на графине: рельеф тише, чем кажется издалека.",
    params: {
      height: 190,
      diameter: 80,
      shape: "bottle",
      patterns: [layer("honeycomb", 0.8, 20)],
    },
  },
  {
    id: "fluted-vase",
    name: "Fluted Vase",
    description: "Каннелюры: острые жёлоба и широкие гребни между ними.",
    params: {
      height: 160,
      diameter: 90,
      shape: "classic",
      patterns: [layer("flutes", 1.5, 24)],
    },
  },
  {
    id: "mushroom-minimal",
    name: "Mushroom Minimal",
    description: "Гриб без рельефа: только силуэт, шляпка и линия ножки.",
    params: {
      height: 150,
      diameter: 105,
      shape: "mushroom",
      patterns: [layer("smooth", 0, 20, { top: 8, bottom: 5 })],
    },
  },
  {
    id: "bud-vase",
    name: "Bud Vase",
    description: "Бутон с лёгкой органикой: рёбра сходятся в узкое горло.",
    params: {
      height: 165,
      diameter: 80,
      shape: "bud",
      organic: 0.15,
      patterns: [layer("ribs", 1, 12)],
    },
  },
];

/**
 * Полные параметры рецепта: значения по умолчанию плюс то, что рецепт меняет.
 *
 * Клик по плитке заменяет модель целиком, а не правит текущую: рецепт — готовая
 * ваза, и её ширина, деформации и сид должны совпасть с картинкой. По той же
 * причине результат проходит нормализацию: высота 133 мм и стенка 1.25 мм из
 * будущего API не попадут ни в геометрию, ни в имя STL.
 */
export function vaseRecipeParams(recipe: VaseRecipe): VaseParams {
  return normalizeVaseParams({ ...DEFAULT_VASE_PARAMS, ...recipe.params });
}

/** Путь к PNG плитки: файлы лежат в `public/constructor/recipes`. */
export function vaseRecipeImagePath(id: string): string {
  return `/constructor/recipes/${id}.png`;
}

/**
 * Поля, по которым рецепт сравнивается с текущей моделью.
 *
 * Список — ровно те параметры, которые рецепт задаёт. Ракурс камеры, имя модели
 * и прочий интерфейс сюда не входят: галерея подсвечивает вазу, а не состояние
 * панели.
 */
const RECIPE_FIELDS = [
  "height",
  "diameter",
  "wall",
  "shape",
  "footMm",
  "rimMm",
  "sectionSides",
  "twistDeg",
  "flutes",
  "fluteDepthMm",
  "organic",
  "leanDeg",
  "vaseSeed",
] as const;

/** Отпечаток вазы: числа из `RECIPE_FIELDS` плюс слои узора целиком. */
function recipeKey(params: VaseParams): string {
  return JSON.stringify([
    ...RECIPE_FIELDS.map((field) => params[field]),
    params.patterns,
  ]);
}

/**
 * Рецепт, который сейчас открыт в конструкторе, или null.
 *
 * Подсветка нужна не для красоты: после правки слайдера ваза перестаёт быть
 * рецептом, и плитка гаснет сама. Пользователь видит, что настройки ушли от
 * готовой вазы, а не ищет глазами, какая плитка была выбрана.
 */
export function activeVaseRecipe(params: VaseParams): VaseRecipe | null {
  const key = recipeKey(params);

  return (
    VASE_RECIPES.find((recipe) => recipeKey(vaseRecipeParams(recipe)) === key) ??
    null
  );
}
