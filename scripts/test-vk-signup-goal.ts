/**
 * Проверка маркера успешной регистрации для пикселя VK Рекламы.
 *
 * Запуск: `npm run check:vk-goal` (или напрямую `node --import
 * ./scripts/register-alias.mjs scripts/test-vk-signup-goal.ts`).
 *
 * Что закрывает тест (чистые функции lib/analytics/signup-marker.ts):
 *   1. «новый аккаунт» — только ответ Supabase с непустым `identities`;
 *      пользователь с пустым массивом (адрес уже занят) регистрацией не считается;
 *   2. маркер `signup=1` добавляется к адресу перехода и не портит уже
 *      существующую query-строку и хвост `#…`;
 *   3. маркер распознаётся и снимается с адреса ровно один раз, не задевая
 *      остальные параметры (`next`).
 *
 * Сеть, Supabase и браузер не нужны: проверяются правила, на которых держится
 * отправка цели в Analytics.tsx и знак `signup=1` из signUpAction.
 */
import {
  hasSignupMarker,
  isNewAccountSignUp,
  withoutSignupMarker,
  withSignupMarker,
} from "@/lib/analytics/signup-marker";

let failures = 0;

/** Печатает результат одной проверки и считает провалы. */
function check(name: string, ok: boolean, details: string) {
  console.log(`${ok ? "✓" : "✗"} ${name} — ${details}`);

  if (!ok) {
    failures += 1;
  }
}

/** Ответ Supabase на новую регистрацию: у пользователя есть identity. */
const NEW_USER = { identities: [{ id: "identity-1", provider: "email" }] };

/** Ответ Supabase на занятый адрес при включённой защите от перебора. */
const EXISTING_USER = { identities: [] };

check(
  "новый аккаунт — identities не пуст",
  isNewAccountSignUp(NEW_USER),
  "signUp вернул пользователя с одной identity",
);

check(
  "существующий email — identities пуст",
  !isNewAccountSignUp(EXISTING_USER),
  "защита от перебора: пользователь без identities",
);

check(
  "нет identities в ответе",
  !isNewAccountSignUp({}),
  "поле отсутствует — регистрацией не считаем",
);

check(
  "identities = null",
  !isNewAccountSignUp({ identities: null }),
  "null — регистрацией не считаем",
);

check(
  "нет пользователя",
  !isNewAccountSignUp(null) && !isNewAccountSignUp(undefined),
  "null и undefined — регистрацией не считаем",
);

check(
  "маркер к простому адресу",
  withSignupMarker("/dashboard", true) === "/dashboard?signup=1",
  withSignupMarker("/dashboard", true),
);

check(
  "маркер не ставится без нового аккаунта",
  withSignupMarker("/dashboard", false) === "/dashboard",
  "адрес не изменился",
);

check(
  "маркер к адресу с query-строкой",
  withSignupMarker("/auth/verify-email?next=%2Fdashboard", true) ===
    "/auth/verify-email?next=%2Fdashboard&signup=1",
  withSignupMarker("/auth/verify-email?next=%2Fdashboard", true),
);

check(
  "маркер перед хвостом #…",
  withSignupMarker("/course/lesson-1#video", true) ===
    "/course/lesson-1?signup=1#video",
  withSignupMarker("/course/lesson-1#video", true),
);

check(
  "маркер с query-строкой и хвостом #…",
  withSignupMarker("/course/lesson-1?tab=2#video", true) ===
    "/course/lesson-1?tab=2&signup=1#video",
  withSignupMarker("/course/lesson-1?tab=2#video", true),
);

check(
  "маркер распознаётся",
  hasSignupMarker("?signup=1") && hasSignupMarker("?next=%2Fdashboard&signup=1"),
  "?signup=1 и параметр среди других",
);

check(
  "посторонние параметры маркером не считаются",
  !hasSignupMarker("") &&
    !hasSignupMarker("?signup=0") &&
    !hasSignupMarker("?signup=yes") &&
    !hasSignupMarker("?next=%2Fsignup"),
  "пустая строка, signup=0, signup=yes, next=/signup",
);

check(
  "маркер снимается",
  withoutSignupMarker("?signup=1") === "",
  "остаётся пустая query-строка",
);

check(
  "маркер снимается, остальные параметры сохраняются",
  withoutSignupMarker("?signup=1&next=%2Fdashboard") === "?next=%2Fdashboard",
  withoutSignupMarker("?signup=1&next=%2Fdashboard"),
);

check(
  "без маркера query-строка не меняется",
  withoutSignupMarker("?next=%2Fdashboard") === "?next=%2Fdashboard",
  withoutSignupMarker("?next=%2Fdashboard"),
);

check(
  "адрес переживает полный цикл установки и снятия маркера",
  (() => {
    const marked = withSignupMarker("/auth/verify-email?next=%2Fcourse%2Flesson-1", true);
    const [, search = ""] = marked.split("?");

    return hasSignupMarker(`?${search}`) && withoutSignupMarker(`?${search}`) === "?next=%2Fcourse%2Flesson-1";
  })(),
  "адрес «проверьте почту» с возвратом в урок",
);

check(
  "маркер не ломает кириллический путь",
  (() => {
    const marked = encodeURI(withSignupMarker("/course/A-без?tab=1", true));
    const [, search = ""] = marked.split("?");

    return hasSignupMarker(`?${search}`) && withoutSignupMarker(`?${search}`) === "?tab=1";
  })(),
  encodeURI(withSignupMarker("/course/A-без?tab=1", true)),
);

if (failures > 0) {
  console.error(`\nПровалено проверок: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("\nВсе проверки маркера регистрации пройдены.");
}
