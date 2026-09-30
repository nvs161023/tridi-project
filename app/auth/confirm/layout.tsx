import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Метаданные страницы подтверждения: в адресе одноразовый токен, в поиске делать
 * нечего. Отдельный layout нужен потому, что сама страница — клиентский компонент
 * и экспортировать metadata не может.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ConfirmLayout({ children }: { children: ReactNode }) {
  return children;
}
