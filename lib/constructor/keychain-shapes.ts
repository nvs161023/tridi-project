import type { KeychainShape } from "@/lib/constructor/params";

/**
 * Встроенные силуэты брелока — обычные SVG-строки с viewBox 0 0 100 100.
 *
 * Разметка разбирается в lib/constructor/svg-outline.ts на сервере и в
 * браузере одним и тем же кодом: DOM и SVGLoader не нужны. Поэтому здесь нет
 * ни `<style>`, ни `transform`: только path, circle и polygon, которые парсер
 * понимает. Контуры симметричны относительно x = 50, а верхняя часть каждого
 * силуэта имеет материал около центра — туда автоматически ставится ушко под
 * кольцо.
 *
 * `dog_tag` — прежняя скруглённая заготовка, `hexagon` — прежний шестигранник:
 * старые значения `rounded` и `hexagon` остаются совместимыми, первый
 * превращается в жетон.
 */
export type KeychainSilhouette = Exclude<KeychainShape, "custom">;

export const KEYCHAIN_SILHOUETTES: Record<KeychainSilhouette, string> = {
  dog_tag: `<svg viewBox="0 0 100 100">
    <path d="M22 5 H78 Q90 5 90 17 V83 Q90 95 78 95 H22 Q10 95 10 83 V17 Q10 5 22 5 Z" />
  </svg>`,
  hexagon: `<svg viewBox="0 0 100 100">
    <path d="M30 4 H70 L95 30 V70 L70 96 H30 L5 70 V30 Z" />
  </svg>`,
  cat: `<svg viewBox="0 0 100 100">
    <path d="M22 34 L26 8 L44 24 C48 23 52 23 56 24 L74 8 L78 34 C88 44 92 58 88 70 C82 88 66 96 50 96 C34 96 18 88 12 70 C8 58 12 44 22 34 Z" />
  </svg>`,
  dog: `<svg viewBox="0 0 100 100">
    <path d="M28 30 C20 18 8 20 6 32 C4 44 14 54 20 58 C16 72 26 88 42 94 C46 96 54 96 58 94 C74 88 84 72 80 58 C86 54 96 44 94 32 C92 20 80 18 72 30 C66 24 58 22 50 22 C42 22 34 24 28 30 Z" />
  </svg>`,
  car: `<svg viewBox="0 0 100 100">
    <path d="M6 58 C6 50 10 46 18 45 L31 42 L43 26 C46 22 50 20 55 20 H64 C69 20 73 22 76 26 L87 42 L92 44 C97 46 99 50 98 56 V80 C98 84 95 87 91 87 H9 C6 87 4 84 4 80 Z" />
    <circle cx="27" cy="72" r="10" />
    <circle cx="73" cy="72" r="10" />
  </svg>`,
  gamepad: `<svg viewBox="0 0 100 100">
    <path d="M20 40 C28 32 38 30 50 33 C62 30 72 32 80 40 C90 50 94 66 90 76 C86 86 76 88 68 82 L60 76 H40 L32 82 C24 88 14 86 10 76 C6 66 10 50 20 40 Z" />
  </svg>`,
  heart: `<svg viewBox="0 0 100 100">
    <path d="M50 92 L14 58 C2 46 4 28 16 20 C28 12 42 18 50 30 C58 18 72 12 84 20 C96 28 98 46 86 58 Z" />
  </svg>`,
  star: `<svg viewBox="0 0 100 100">
    <path d="M50 4 L61.2 34.6 L93.7 35.8 L68.1 55.9 L77.1 87.3 L50 69 L22.9 87.3 L31.9 55.9 L6.3 35.8 L38.8 34.6 Z" />
  </svg>`,
  rocket: `<svg viewBox="0 0 100 100">
    <path d="M50 4 C62 14 68 30 68 46 V70 L58 78 H42 L32 70 V46 C32 30 38 14 50 4 Z" />
    <path d="M32 52 L18 70 L20 80 L34 72 Z" />
    <path d="M68 52 L82 70 L80 80 L66 72 Z" />
    <circle cx="50" cy="38" r="7" />
  </svg>`,
  fish: `<svg viewBox="0 0 100 100">
    <path d="M8 50 C20 28 42 22 60 30 L84 16 L80 38 L94 50 L80 62 L84 84 L60 70 C42 78 20 72 8 50 Z" />
    <circle cx="30" cy="46" r="4" />
  </svg>`,
  house: `<svg viewBox="0 0 100 100">
    <path d="M50 6 L94 40 V94 H62 V64 H38 V94 H6 V40 Z" />
  </svg>`,
  crown: `<svg viewBox="0 0 100 100">
    <path d="M6 84 L12 26 L32 46 L50 14 L68 46 L88 26 L94 84 Z" />
  </svg>`,
  mushroom: `<svg viewBox="0 0 100 100">
    <path d="M6 50 C6 28 24 12 50 12 C76 12 94 28 94 50 C94 56 90 58 84 58 H16 C10 58 6 56 6 50 Z" />
    <path d="M36 58 H64 L60 92 C59 96 55 98 50 98 C45 98 41 96 40 92 Z" />
  </svg>`,
  lightning: `<svg viewBox="0 0 100 100">
    <path d="M56 4 L20 56 H44 L34 96 L80 40 H54 Z" />
  </svg>`,

};

/**
 * SVG выбранного силуэта или null для пользовательского файла.
 *
 * Для `custom` разметка приходит из `customSvgData`; если файл не разобрался,
 * geometry откатывается к жетону, поэтому брелок никогда не остаётся пустым.
 */
export function keychainSilhouetteSvg(shape: KeychainShape): string | null {
  if (shape === "custom") {
    return null;
  }

  return KEYCHAIN_SILHOUETTES[shape] ?? KEYCHAIN_SILHOUETTES.dog_tag;
}

