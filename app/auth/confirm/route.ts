import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { resolveAfterAuthPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Маршрут подтверждения email — сюда ведёт ссылка из письма.
 *
 * Почему Route Handler, а не страница: подтверждение устанавливает сессию, то есть
 * записывает cookies. В Server Components запись cookies запрещена (наш
 * lib/supabase/server.ts такие ошибки намеренно проглатывает), и сессия просто не
 * сохранилась бы — человек «подтвердил» адрес, но остался гостем.
 *
 * Поддерживаем два вида ссылок:
 *   • ?token_hash=…&type=signup — рекомендованный шаблон письма, проверяем verifyOtp;
 *   • ?code=… — поток PKCE.
 * Третий вид — токены во фрагменте адреса (#access_token=…) — обрабатывает
 * клиентский components/EmailLinkHandler.tsx: фрагмент не доходит до сервера.
 * Поэтому при отсутствии параметров ошибку не показываем, а уводим на страницу
 * статуса: она скажет «завершаем подтверждение» и даст запросить новое письмо.
 */
const VERIFY_EMAIL_PATH = "/auth/verify-email";

/** Типы ссылок Supabase, которые принимаем: остальные отбрасываем. */
const ALLOWED_TYPES: EmailOtpType[] = [
  "signup",
  "email",
  "invite",
  "recovery",
  "email_change",
  "magiclink",
];

/** Адрес страницы статуса с параметрами: status=ok|error, next=куда вернуться. */
function statusUrl(request: NextRequest, status: string, next: string): URL {
  const url = new URL(VERIFY_EMAIL_PATH, request.url);
  url.searchParams.set("status", status);
  url.searchParams.set("next", next);

  return url;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  // next приходит из нашего шаблона письма, redirect_to — от Supabase. Оба
  // проверяем: адрес виден пользователю и может быть подделан.
  const afterConfirm = resolveAfterAuthPath(
    searchParams.get("next") ?? searchParams.get("redirect_to"),
  );

  if (!tokenHash && !code) {
    // Токены, скорее всего, во фрагменте — их обработает клиентский обработчик.
    return NextResponse.redirect(statusUrl(request, "checking", afterConfirm));
  }

  const supabase = await createClient();

  if (tokenHash && type && ALLOWED_TYPES.includes(type as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });

    if (error) {
      console.warn("Подтверждение по token_hash не удалось:", error.message);

      return NextResponse.redirect(statusUrl(request, "error", afterConfirm));
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.warn("Обмен кода подтверждения не удался:", error.message);

      return NextResponse.redirect(statusUrl(request, "error", afterConfirm));
    }
  } else {
    // Есть token_hash, но нет type (или наоборот) — ссылка повреждена.
    return NextResponse.redirect(statusUrl(request, "error", afterConfirm));
  }

  // Сессия уже записана в cookies ответа — показываем «почта подтверждена».
  return NextResponse.redirect(statusUrl(request, "ok", afterConfirm));
}
