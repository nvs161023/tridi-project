"use client";

import { useEffect, useRef, useState } from "react";

import { confirmSessionFromTokens } from "@/app/actions/confirm-session";
import { safeNextPath } from "@/lib/auth-redirect";

/**
 * Завершает подтверждение email, если Supabase вернул токены во фрагменте адреса.
 *
 * Ссылка по умолчанию (шаблон self-hosted Supabase) выглядит так:
 *   https://tridi-rd.ru/#access_token=…&refresh_token=…&type=signup
 * Фрагмент адреса не отправляется на сервер, поэтому обработать его может только
 * браузер. Компонент подключается один раз в корневом layout, разбирает фрагмент
 * и передаёт токены в Server Action — там они проверяются и превращаются в
 * cookies сессии (см. app/actions/confirm-session.ts).
 *
 * Если фрагмента нет, компонент ничего не делает и ничего не показывает: он
 * нужен только для этого случая.
 */
export function EmailLinkHandler() {
  const hasStarted = useRef(false);
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    const hash = window.location.hash.replace(/^#/, "");

    if (!hash.includes("access_token")) {
      return;
    }

    hasStarted.current = true;
    setIsFinishing(true);

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    // Куда идти после подтверждения: адрес из ?next= (проверенный), иначе кабинет.
    const destination =
      safeNextPath(new URLSearchParams(window.location.search).get("next")) ??
      "/dashboard";

    const goToError = () => {
      window.location.replace("/auth/verify-email?status=error");
    };

    if (!accessToken || !refreshToken) {
      goToError();
      return;
    }

    void (async () => {
      const result = await confirmSessionFromTokens(accessToken, refreshToken);

      if ("success" in result) {
        // Полная перезагрузка: серверные компоненты должны увидеть новые cookies.
        window.location.replace(destination);

        return;
      }

      goToError();
    })();
  }, []);

  if (!isFinishing) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-900/95 px-4 py-3 text-center text-sm font-semibold text-slate-200 backdrop-blur"
    >
      Завершаем подтверждение почты…
    </div>
  );
}
