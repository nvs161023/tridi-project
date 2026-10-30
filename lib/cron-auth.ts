/**
 * Проверка секрета cron-роутов: `Authorization: Bearer <CRON_SECRET>`.
 *
 * Секрет один на все служебные запуски по расписанию (ежедневный отчёт
 * `/api/cron/daily-report` и watchdog зависших печатей `/api/agent/watchdog`),
 * поэтому и проверка живёт в одном месте: две копии сравнения разъезжаются
 * молча — правку в одной забывают во второй.
 *
 * `timingSafeEqual` не даёт измерить по времени, сколько первых символов секрета
 * совпало. Длину сравниваем отдельно: `timingSafeEqual` требует одинаковых
 * буферов и бросает исключение при разной длине.
 */
import { timingSafeEqual } from "node:crypto";

/** Пришёл ли запрос с верным `Bearer <secret>`. */
export function isCronAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";

  if (!header.startsWith(prefix)) {
    return false;
  }

  const token = Buffer.from(header.slice(prefix.length).trim(), "utf8");
  const expected = Buffer.from(secret, "utf8");

  if (token.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(token, expected);
}
