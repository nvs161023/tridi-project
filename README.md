This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
