/**
 * Персональный токен локального агента печати.
 *
 * Браузер не дотянется до принтера в домашней сети, поэтому печатью занимается
 * Python-агент: скрипт на компьютере рядом с принтерами. Мастерскую агент
 * находит не по cookie сессии, а по ключу `workshop_settings.agent_token`
 * (`uuid`, unique, `default gen_random_uuid()`) из миграции
 * `supabase/workshop_farm_and_shop.sql` — тот же приём, что у `webhook_token` в
 * вебхуках Ozon, WB и Яндекса.
 *
 * Токен уходит на сервер только заголовком `Authorization: Bearer …`, а мастер
 * копирует его из вкладки «Интеграции» в `agent/.env` (`AGENT_TOKEN`). Поэтому
 * значение не секрет от владельца: в отличие от Api-Key Ozon, его показываем
 * целиком — иначе скрипт не настроить.
 *
 * Модуль чистый, без Supabase и `next/cache`: его импортируют и серверная
 * страница, и Server Action, и клиентская вкладка «Интеграции».
 */
import { isWorkshopUuid } from "@/lib/db/workshop-types";

/** Колонка, в которой лежит токен агента. */
export const WORKSHOP_AGENT_TOKEN_COLUMN = "agent_token";

/**
 * Токен агента строкой uuid в нижнем регистре или `null`.
 *
 * PostgREST отдаёт uuid в нижнем регистре, но при ручном копировании регистр
 * может измениться — приводим к нижнему, как и токен вебхука. Всё, что не
 * похоже на uuid, считаем отсутствующим токеном: подставлять произвольный
 * текст в `Authorization` нельзя, агент получил бы 401.
 */
export function normalizeAgentToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const token = value.trim().toLowerCase();

  return isWorkshopUuid(token) ? token : null;
}
