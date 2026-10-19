/**
 * Имя и фамилия человека: проверка и сборка полного имени.
 *
 * Правила одни для браузера и сервера. Форма регистрации проверяет поля до
 * отправки, чтобы человек сразу видел ошибку под полем, а Server Action
 * повторяет ту же проверку: он доступен по публичному адресу, и разметку можно
 * подменить. Поэтому правила живут здесь, а не копируются в двух местах.
 *
 * Допустимы буквы (кириллица и латиница), пробелы и дефисы. Пробел и дефис не
 * могут стоять в начале, в конце или идти подряд — иначе «- -» проходило бы
 * проверку и превращалось в пустое имя в сертификате.
 */

/** Имя или фамилия: минимум две буквы, разделители — только между словами. */
export const PERSON_NAME_PATTERN =
  /^[A-Za-zА-Яа-яЁё]+(?:[ -][A-Za-zА-Яа-яЁё]+)*$/u;

/** Минимальная длина имени и фамилии. */
export const PERSON_NAME_MIN_LENGTH = 2;

/** Сообщение об ошибке для имени или null, если значение корректно. */
export function validatePersonName(
  value: string,
  field: "first" | "last",
): string | null {
  const trimmed = value.trim();
  const label = field === "first" ? "Имя" : "Фамилия";

  if (trimmed.length === 0) {
    return field === "first" ? "Укажите имя." : "Укажите фамилию.";
  }

  if (trimmed.length < PERSON_NAME_MIN_LENGTH) {
    return `${label} должно содержать минимум ${PERSON_NAME_MIN_LENGTH} символа.`;
  }

  if (!PERSON_NAME_PATTERN.test(trimmed)) {
    return "Допустимы только буквы, пробелы и дефисы.";
  }

  return null;
}

/** Проверка имени. */
export function validateFirstName(value: string): string | null {
  return validatePersonName(value, "first");
}

/** Проверка фамилии. */
export function validateLastName(value: string): string | null {
  return validatePersonName(value, "last");
}

/** Полное имя для метаданных, профиля и сертификата. */
export function formatFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

/**
 * Разбирает сохранённое полное имя на части.
 *
 * Нужен для старых аккаунтов: у них в метаданных лежит только `name` (одна
 * строка), а кабинету и сертификату нужны имя и фамилия по отдельности.
 * Фамилией считаем всё после первого слова — так «Анна Мария Иванова» не теряет
 * среднее имя.
 */
export function splitPersonName(fullName: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}
