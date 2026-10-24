/**
 * Единая точка входа в UI-кит.
 *
 * Страницы импортируют `@/components/ui`, а не отдельные файлы: если компонент
 * переедет или получит новый вариант, правка останется внутри папки.
 */
export { Button, ButtonLink, buttonClassName } from "./Button";
export type {
  ButtonLinkProps,
  ButtonProps,
  ButtonSize,
  ButtonVariant,
} from "./Button";
export { Card } from "./Card";
export type { CardElement, CardPadding, CardProps } from "./Card";
export { Input } from "./Input";
export type { InputProps } from "./Input";
export { Select } from "./Select";
export type { SelectProps } from "./Select";
