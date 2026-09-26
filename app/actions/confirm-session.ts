"use server";

import { createClient } from "@/lib/supabase/server";

export type ConfirmSessionResult = { success: true } | { error: string };

/**
 * Устанавливает сессию по токенам из адреса письма.
 *
 * Зачем это нужно: по умолчанию self-hosted Supabase (GoTrue) присылает ссылку,
 * которая возвращает пользователя на сайт с токенами во фрагменте адреса
 * (#access_token=…&refresh_token=…). Фрагмент не уходит на сервер, поэтому
 * серверный маршрут его не видит. Разбирает фрагмент клиент
 * (components/EmailLinkHandler.tsx) и передаёт токены сюда: здесь их можно
 * проверить и записать cookies сессии — в браузере клиента Supabase нет.
 *
 * Токены подписаны Supabase, поэтому подделка невозможна: setSession проверяет
 * подпись на стороне сервиса и вернёт ошибку для чужих значений.
 */
export async function confirmSessionFromTokens(
  accessToken: string,
  refreshToken: string,
): Promise<ConfirmSessionResult> {
  if (
    typeof accessToken !== "string" ||
    typeof refreshToken !== "string" ||
    accessToken.length === 0 ||
    refreshToken.length === 0
  ) {
    return { error: "В ссылке нет данных подтверждения." };
  }

  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      return { error: error.message };
    }
  } catch {
    return { error: "Не удалось связаться с сервером. Откройте ссылку ещё раз." };
  }

  return { success: true };
}
