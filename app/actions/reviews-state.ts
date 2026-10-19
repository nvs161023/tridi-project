/**
 * Состояние формы отзыва для useActionState.
 *
 * Ошибки и подтверждение — готовым текстом: Server Action не должен отдавать
 * клиенту подробности Supabase.
 */
export type ReviewFormState = {
  error?: string;
  success?: string;
};

export const emptyReviewFormState: ReviewFormState = {};
