/**
 * Подсказка под заголовком страницы входа.
 *
 * middleware уводит гостя на /auth/login?next=<страница>, поэтому по next
 * понятно, зачем человек шёл: за генератором, конструктором или мастерской.
 * Без этого на входе всем показывался курсовой текст «продолжите курс», и
 * посетитель, который хотел создать модель, не понимал, куда попал.
 *
 * Правила сравнивают только путь: next может содержать query string
 * (`/dashboard/workshop?demo=1`) или якорь.
 */

/** Текст по умолчанию: большинство переходов на вход идёт из уроков. */
const DEFAULT_LOGIN_INTRO =
  "Войдите, чтобы продолжить курс с того места, где остановились.";

/** Контекстные тексты для инструментов. Порядок не важен: пути не пересекаются. */
const LOGIN_INTROS: ReadonlyArray<{ path: string; text: string }> = [
  {
    path: "/3d-generator",
    text: "Войдите, чтобы создать 3D-модель по фотографии.",
  },
  {
    path: "/constructor",
    text: "Войдите, чтобы создавать и скачивать 3D-модели.",
  },
  {
    path: "/dashboard/workshop",
    text: "Войдите, чтобы открыть мастерскую.",
  },
];

/** Путь без query string и якоря: `/dashboard/workshop?demo=1` → `/dashboard/workshop`. */
function pathnameOf(next: string): string {
  return next.split(/[?#]/, 1)[0];
}

/** Текст под заголовком входа для страницы, на которую возвращается человек. */
export function loginIntroFor(next: string | null | undefined): string {
  if (!next) {
    return DEFAULT_LOGIN_INTRO;
  }

  const pathname = pathnameOf(next);
  const match = LOGIN_INTROS.find(
    (intro) =>
      pathname === intro.path || pathname.startsWith(`${intro.path}/`),
  );

  return match?.text ?? DEFAULT_LOGIN_INTRO;
}
