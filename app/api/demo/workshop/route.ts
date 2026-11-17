import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { demoWorkshopEmail } from "@/lib/workshop/demo";

/**
 * Вход в демо-мастерскую с витрины.
 *
 * Почему маршрут, а не форма: у демо-аккаунта пароль хранится в переменной
 * окружения, и в браузер он попадать не должен. Здесь сервер сам логинится под
 * демо-пользователем и отдаёт обычные cookies сессии — дальше это стандартная
 * сессия Supabase, которую продлевает middleware.
 *
 * Что защищает демо от порчи данных:
 *   - Server Action и API-роуты возвращают `DEMO_READ_ONLY` (lib/workshop/demo.ts);
 *   - middleware уводит демо-сессию из кабинета, форума и конструктора.
 *
 * Пароль и почта задаются DEMO_WORKSHOP_PASSWORD / DEMO_WORKSHOP_EMAIL.
 * Без пароля кнопка возвращает гостя на витрину с пометкой `demo=unavailable`.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VITRINA = "/tools/workshop";
const WORKSHOP = "/dashboard/workshop";

type PendingCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export async function GET(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const redirect = (path: string) =>
    NextResponse.redirect(new URL(path, origin), 303);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const password = process.env.DEMO_WORKSHOP_PASSWORD ?? "";

  if (!supabaseUrl || !anonKey || !password) {
    return redirect(`${VITRINA}?demo=unavailable`);
  }

  const cookieStore = await cookies();
  const pending: PendingCookie[] = [];

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          pending.push(cookie);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: demoWorkshopEmail(),
    password,
  });

  if (error) {
    console.warn("Демо-вход не выполнен:", error.message);

    return redirect(`${VITRINA}?demo=error`);
  }

  // Агента фермы в демо нет, поэтому принтеры быстро стали бы «офлайн» и
  // карточки потеряли бы прогресс печати. Отмечаем опрос на входе: демо должно
  // выглядеть как рабочая ферма, а не как архив. Ошибку игнорируем — это
  // косметика, из-за неё вход отменять нельзя.
  if (data.user) {
    await supabase
      .from("workshop_printers")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("user_id", data.user.id);
  }

  const response = redirect(`${WORKSHOP}?demo=1`);

  for (const { name, value, options } of pending) {
    response.cookies.set(name, value, options);
  }

  response.headers.set("cache-control", "no-store");

  return response;
}
