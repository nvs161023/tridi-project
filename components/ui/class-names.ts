/**
 * Склейка классов без внешних зависимостей.
 *
 * UI-кит не тянет `clsx` или `tailwind-merge`: условных классов немного, а
 * лишняя библиотека в клиентском бандле не нужна. `false`, `null` и пустые
 * строки отбрасываются, чтобы не оставлять двойных пробелов в `class`.
 */
export function cx(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}
