/**
 * Инициализация платежа — пока заглушка.
 *
 * Сюда приходят ровно те данные, которые понадобятся платёжному сервису:
 * идентификатор товара (`courseId`) и сумма (`price`). Следующий шаг —
 * заменить тело функции на Server Action, который создаст платёж в Робокассе
 * и вернёт ссылку на оплату. Цену на сервере нужно будет проверить по
 * data/courses.json, а не доверять значению из браузера.
 */
export type PaymentRequest = {
  /** Ключ курса или пакета (course_id): confident, engineer, profit, pro. */
  courseId: string;
  /** Сумма в рублях. */
  price: number;
};

export type PaymentIntent = PaymentRequest & {
  status: "pending";
};

/** Возвращает намерение платежа. Пока оплата не подключена. */
export function initializePayment(request: PaymentRequest): PaymentIntent {
  console.info("Инициализация платежа:", request);

  return { ...request, status: "pending" };
}
