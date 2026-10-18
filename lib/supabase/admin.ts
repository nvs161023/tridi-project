import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase-клиент с ключом service_role для фоновых серверных задач.
 *
 * Нужен вебхукам: запрос от Robokassa приходит без cookies пользователя, а
 * запись покупки должна обойти RLS. Ключ нельзя импортировать в клиентский
 * код — он даёт полный доступ к базе.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY. Добавьте их в .env.local",
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
