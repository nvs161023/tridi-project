/**
 * Признак администратора форума.
 *
 * Список задаётся переменной ADMIN_EMAIL на сервере: одну почту или несколько
 * через запятую. Сравнение регистронезависимое. Если переменная не задана,
 * администраторов нет — это безопасное поведение по умолчанию: страница
 * /admin/forum и действия модерации будут недоступны.
 *
 * ADMIN_EMAIL не заменяет Supabase-аутентификацию: сначала пользователь должен
 * войти, и только потом его email сравнивается со списком.
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  return getAdminEmails().includes(email.trim().toLowerCase());
}
