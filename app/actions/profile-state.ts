/**
 * Состояние формы редактирования профиля для useActionState.
 *
 * Ошибки полей возвращаются отдельно, чтобы подсказка стояла рядом с нужным
 * полем. Значения нужны, чтобы после неудачной отправки форма не очищалась.
 */
export type ProfileFormState = {
  error?: string;
  fieldErrors?: {
    firstName?: string;
    lastName?: string;
  };
  success?: boolean;
  values?: {
    firstName?: string;
    lastName?: string;
  };
};

export const emptyProfileFormState: ProfileFormState = {};
