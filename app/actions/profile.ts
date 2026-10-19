"use server";

import { revalidatePath } from "next/cache";

import type { ProfileFormState } from "@/app/actions/profile-state";
import {
  formatFullName,
  validateFirstName,
  validateLastName,
} from "@/lib/person-name";
import { createClient } from "@/lib/supabase/server";

/**
 * Сохранение имени и фамилии из личного кабинета.
 *
 * Имя и фамилия живут в метаданных аккаунта Supabase: middleware читает их при
 * каждом защищённом переходе и передаёт странице заголовком, без лишнего
 * запроса к profiles. Дополнительно обновляем строку profiles, потому что по ней
 * строятся подписи автора на форуме и в админке.
 *
 * Проверка та же, что при регистрации (lib/person-name.ts): форма и Server Action
 * не должны расходиться в правилах.
 */
export async function updateProfileAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const values = { firstName, lastName };

  const firstNameError = validateFirstName(firstName);
  const lastNameError = validateLastName(lastName);

  if (firstNameError || lastNameError) {
    return {
      fieldErrors: {
        firstName: firstNameError ?? undefined,
        lastName: lastNameError ?? undefined,
      },
      values,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Сессия истекла. Войдите снова, чтобы изменить профиль.",
      values,
    };
  }

  const fullName = formatFullName(firstName, lastName);

  const { error } = await supabase.auth.updateUser({
    data: {
      first_name: firstName,
      last_name: lastName,
      // Полное имя одной строкой оставляем для писем и старых мест, где
      // читается только `name`.
      name: fullName,
    },
  });

  if (error) {
    console.warn("Не удалось обновить метаданные профиля:", error.message);

    return {
      error: "Не удалось сохранить изменения. Попробуйте ещё раз.",
      values,
    };
  }

  // Строка profiles может отсутствовать у старых аккаунтов, поэтому upsert,
  // а не update. Ошибку только логируем: имя уже сохранено в аккаунте, и
  // кабинет с сертификатом берут его оттуда.
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, email: user.email ?? null, name: fullName },
      { onConflict: "id" },
    );

  if (profileError) {
    console.warn("Не удалось обновить строку profiles:", profileError.message);
  }

  // Кабинет и сертификат читают имя на сервере: после сохранения их нужно
  // перерисовать, иначе в шапке останется старое обращение до перезагрузки.
  revalidatePath("/dashboard");
  revalidatePath("/certificate/[courseId]", "page");

  return { success: true, values };
}
