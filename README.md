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
3. По ссылке работает Route Handler `app/auth/confirm/route.ts`: принимает
   `?token_hash=&type=` (проверяет `verifyOtp`) и `?code=` (`exchangeCodeForSession`)
   и записывает cookies сессии. Именно Route Handler, а не страница: в Server
   Component запись cookies запрещена, и сессия не сохранилась бы.
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
- Email Templates → **Confirm signup** — рекомендуемая ссылка (работает без
  JavaScript, `type` соответствует типу письма):

  ```html
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">
    Подтвердить адрес
  </a>
  ```

- Шаблон по умолчанию (`{{ .ConfirmationURL }}`) тоже работает — через
  `EmailLinkHandler`, но требует JavaScript в браузере.
- Переменную `NEXT_PUBLIC_SITE_URL` задайте на хостинге: по ней строится
  `emailRedirectTo` (см. `lib/site-url.ts`).

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
