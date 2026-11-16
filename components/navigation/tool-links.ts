/**
 * Единый список пунктов меню «Инструменты».
 *
 * Один массив читают оба меню — выпадающее на десктопе
 * (`components/navigation/ToolsDropdown.tsx`) и бургер
 * (`components/navigation/MobileMenu.tsx`). Раньше списки жили врозь и разошлись:
 * генератор по фото (`/3d-generator`) не попал ни в одно, «Профили печати»
 * были только на десктопе, а «Центр инструментов» — только в бургере. Теперь
 * новый инструмент добавляется одной строкой здесь и появляется в обоих меню.
 *
 * Пункты «Мастерская (Pro)» и хаб «Все инструменты» (`/tools`) в список не
 * входят: первый зависит от подписки и собирается шапкой, второй — подвал меню
 * со ссылкой на каталог, где лежат диагностика дефектов и остальные разделы.
 */

/** Иконка пункта: имя рисует `ToolIcon` в десктопном меню. */
export type ToolIconName =
  | "constructor"
  | "generate"
  | "models"
  | "gallery"
  | "profiles"
  | "workshop";

/** Пункт меню «Инструменты». */
export type ToolLink = {
  href: string;
  title: string;
  description: string;
  icon: ToolIconName;
  /** Бейдж справа от названия: «NEW» у недавно вышедшего генератора. */
  badge?: string;
  /**
   * Пункт только для вошедших. Гостю он всё равно ответил бы редиректом на
   * вход, поэтому меню его не показывает — как и «Мои уроки» в шапке.
   */
  requiresAuth?: boolean;
};

/** Инструменты в порядке показа: конструктор, генератор, модели, галерея, профили. */
export const TOOL_LINKS: readonly ToolLink[] = [
  {
    href: "/constructor",
    title: "Конструктор 3D",
    description: "Вазы, брелоки, вывески и коробки",
    icon: "constructor",
  },
  {
    href: "/3d-generator",
    title: "Генератор по фото",
    description: "3D-модель из одного снимка",
    icon: "generate",
    badge: "NEW",
  },
  {
    href: "/my-models",
    title: "Мои модели",
    description: "История генераций и STL",
    icon: "models",
    requiresAuth: true,
  },
  {
    href: "/gallery",
    title: "Галерея",
    description: "Работы сообщества, STL после входа",
    icon: "gallery",
  },
  {
    href: "/profiles",
    title: "Профили печати",
    description: "Настройки слайсеров и материалов",
    icon: "profiles",
  },
];

/**
 * Пункты, которые видит посетитель: «Мои модели» — только вошедшему.
 *
 * Фильтр один на оба меню, поэтому десктоп и бургер не могут показать разный
 * набор ссылок.
 */
export function visibleToolLinks(isAuthorized: boolean): ToolLink[] {
  return TOOL_LINKS.filter((link) => isAuthorized || !link.requiresAuth);
}
