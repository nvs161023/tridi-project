This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

> Полная сводка по проекту — что уже работает, из каких блоков состоит, как устроена база и что
> ещё не сделано: **[PROJECT.md](./PROJECT.md)**.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Подтверждение email

Регистрация с проверкой адреса работает так:

1. `signUpAction` (`app/actions/auth.ts`) создаёт аккаунт и передаёт Supabase
   `emailRedirectTo` — адрес `/auth/confirm` на нашем сайте (плюс `next`, куда
   вернуть человека после подтверждения).
2. Supabase отправляет письмо со ссылкой.
3. По ссылке открывается страница `app/auth/confirm/page.tsx`. Она сама ничего не
   подтверждает: токен уходит в Supabase только после нажатия кнопки «Подтвердить
   email» (`supabase.auth.verifyOtp`), а сессию записывает браузерный клиент
   `lib/supabase/client.ts`. Поэтому адрес может открыть кто угодно — включая
   почтовый сервис, который проверяет ссылки в письмах (Mail.ru и подобные), —
   и одноразовый токен при этом не сгорит.
4. Для «старого» формата ссылки (токены во фрагменте адреса, `#access_token=…`)
   в корневом layout подключён `components/EmailLinkHandler.tsx`: фрагмент не
   уходит на сервер, поэтому браузер разбирает его и передаёт токены в Server
   Action `app/actions/confirm-session.ts`.
5. Страница `/auth/verify-email` показывает статус («проверьте почту»,
   «завершаем подтверждение», «ссылка не сработала», «почта подтверждена») и умеет
   отправлять письмо повторно. Middleware не пускает пользователя с
   неподтверждённой почтой в `/course/*` и `/dashboard`; сама страница
   подтверждения и ссылка из письма открыты всегда.

**Настройки на стороне Supabase (self-hosted):**

- Authentication → URL Configuration: Site URL — боевой домен
  (`https://tridi-print.ru`), в Redirect URLs добавьте `https://tridi-print.ru/**`.
- Email Templates → **Confirm signup** — рекомендуемая ссылка (подтверждение
  запускает кнопка на странице, `type` соответствует типу письма):

  ```html
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">
    Подтвердить адрес
  </a>
  ```

- Шаблон по умолчанию (`{{ .ConfirmationURL }}`) для этой схемы не подходит: он ведёт
  на `/auth/v1/verify` в Supabase, который подтверждает адрес по GET — одноразовый
  токен сгорит от первого же автоматического открытия ссылки.
- Готовый текст письма — `public/templates/confirmation.html` (тот же вид, что у
  письма о сбросе пароля): скопируйте его содержимое в шаблон **Confirm signup**.
- Переменную `NEXT_PUBLIC_SITE_URL` задайте на хостинге: по ней строится
  `emailRedirectTo` (см. `lib/site-url.ts`).

## Сброс пароля

Восстановление доступа идёт в два шага — так же, как подтверждение email: ссылку
из письма нельзя «сжечь» автоматическим открытием.

1. `/auth/forgot-password` — форма с email. Отправляет её Server Action
   `resetPasswordAction` (`app/actions/auth.ts`), ответ всегда нейтральный: «Если
   аккаунт существует, мы отправили письмо. Проверьте почту.» По форме нельзя
   понять, зарегистрирован ли адрес.
2. Ссылка из письма ведёт на `/auth/reset-password?token_hash=…&type=recovery`.
   Страница сама ничего не подтверждает: сначала кнопка «Подтвердить»
   (`supabase.auth.verifyOtp` с `type=recovery`), и только после этого на том же
   адресе открывается форма нового пароля (`supabase.auth.updateUser`).
3. Если ссылка устарела, уже использована или пришла с `error`/`error_code`,
   страница показывает «Ссылка не сработала» и предлагает запросить новое письмо.
   Ошибка при подтверждении уводит на `/auth/login?error=reset_link_invalid`.

Сессию и смену пароля делает браузерный клиент `lib/supabase/client.ts`:
восстановительная сессия ложится в cookies, а Server Component писать cookies не
может — поэтому страница клиентская.

**Настройки на стороне Supabase (self-hosted):** готовый текст письма лежит в
репозитории — `public/templates/recovery.html`; скопируйте его целиком в Email
Templates → **Reset password**. Внутри — ссылка на нашу страницу:

```html
<a href="{{ .SiteURL }}/auth/reset-password?token_hash={{ .TokenHash }}&type=recovery">
  Сбросить пароль
</a>
```

Ссылка по умолчанию (`{{ .ConfirmationURL }}`) здесь не годится: она ведёт на
`/auth/v1/verify` и сгорает от автоматического открытия. Адрес
`/auth/reset-password` попадает в Redirect URLs из раздела выше
(`https://tridi-print.ru/**`), отдельно его прописывать не нужно, а middleware
специально не уводит с него вошедших: после подтверждения ссылки сессия уже есть, и
перезагрузка страницы не должна ломать смену пароля.

## Деплой на Amvera

Сборка запускается командой `npm run build:amvera` (см. `amvera.yml`): она чистит
`.next`, восстанавливает `tsconfig.json` (`scripts/ensure-tsconfig.mjs`), проверяет
импорты (`scripts/check-imports.mjs`), ставит зависимости через `npm ci` и собирает
проект.

Что важно знать при разборе логов сборки:

- **`tsconfig.json` должен быть в исходниках.** В нём живёт алиас `@/*`; без него
  проверка типов падает на каждом `@/...`-импорте. Если этот файл попал в
  исключения проекта на Amvera — уберите его оттуда, иначе в логах будет
  `[ensure-tsconfig] tsconfig.json НЕ НАЙДЕН в дереве сборки!` на каждой сборке.
- Алиас `@/*` продублирован в `next.config.ts` (`turbopack.resolveAlias`), поэтому
  даже без `tsconfig.json` сборщик находит модули, и проблема выглядит как ошибка
  типов (`Type error: Cannot find module '@/...'`), а не как «Module not found».
- Переменные `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` задаются
  в настройках окружения Amvera: `.env.local` в репозиторий не попадает.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
