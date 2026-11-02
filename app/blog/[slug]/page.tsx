import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Header } from "@/components/Header";
import { Markdown } from "@/components/blog/Markdown";
import { ButtonLink } from "@/components/ui";
import { formatPostDate, getPost } from "@/lib/blog";
import { OG_IMAGE, absoluteUrl, organizationJsonLd } from "@/lib/seo";
import { resolveSiteUrl } from "@/lib/site-url";

/**
 * Статья блога собирается на каждый запрос: шапка читает cookies, а тексты
 * лежат на диске рядом с кодом — при правке файла пересборка не нужна.
 */
export const dynamic = "force-dynamic";

type BlogPostPageProps = {
  /** В Next 15 параметры маршрута приходят промисом. */
  params: Promise<{ slug: string }>;
};

/**
 * Метаданные статьи.
 *
 * `seoTitle` короче H1: полный заголовок в `<title>` обрезается в выдаче, а
 * шаблон из корневого layout всё равно добавит «| TriDi».
 */
export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);

  if (!post) {
    return {
      title: "Статья не найдена",
      robots: { index: false, follow: false },
    };
  }

  const title = post.seoTitle ?? post.title;
  const url = `/blog/${post.slug}`;

  return {
    title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      locale: "ru_RU",
      siteName: "TriDi",
      url,
      title,
      description: post.description,
      publishedTime: post.date,
      modifiedTime: post.updated,
      images: [
        {
          ...OG_IMAGE,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: post.description,
      images: [
        {
          url: OG_IMAGE.url,
          alt: post.title,
        },
      ],
    },
  };
}

/**
 * JSON-LD статьи.
 *
 * `Article` связывает текст с организацией по `@id` из корневого layout, а
 * `BreadcrumbList` показывает в выдаче путь «Главная → Блог → статья».
 */
function buildArticleJsonLd(
  siteUrl: string,
  post: { slug: string; title: string; description: string; date: string; updated: string },
) {
  const url = `${siteUrl}/blog/${post.slug}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}/#article`,
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.updated,
        inLanguage: "ru-RU",
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        image: absoluteUrl(OG_IMAGE.url, siteUrl),
        author: { "@id": `${siteUrl}/#organization` },
        publisher: { "@id": `${siteUrl}/#organization` },
        isPartOf: {
          "@type": "Blog",
          "@id": `${siteUrl}/blog#blog`,
          name: "Блог TriDi",
          url: `${siteUrl}/blog`,
        },
      },
      organizationJsonLd(siteUrl),
      {
        "@type": "BreadcrumbList",
        "@id": `${url}/#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Главная",
            item: `${siteUrl}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Блог",
            item: `${siteUrl}/blog`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: post.title,
            item: url,
          },
        ],
      },
    ],
  };
}

/**
 * Страница статьи: H1 из frontmatter, текст из markdown, ниже — CTA на
 * бесплатный уровень. Неизвестный слаг отдаёт 404, а не пустую страницу:
 * мусорные адреса не должны попадать в индекс.
 */
export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPost(slug);

  if (!post) {
    notFound();
  }

  const siteUrl = await resolveSiteUrl();
  const jsonLd = buildArticleJsonLd(siteUrl, post);

  return (
    <div className="min-h-screen text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <Header />

      <main>
        <article>
          <header className="relative overflow-hidden border-b border-white/10">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"
            />

            <div className="relative mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-16">
              <nav aria-label="Хлебные крошки">
                <ol className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-400">
                  <li>
                    <Link
                      className="transition-colors hover:text-blue-400"
                      href="/"
                    >
                      Главная
                    </Link>
                  </li>
                  <li aria-hidden>/</li>
                  <li>
                    <Link
                      className="transition-colors hover:text-blue-400"
                      href="/blog"
                    >
                      Блог
                    </Link>
                  </li>
                </ol>
              </nav>

              <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
                {post.title}
              </h1>

              <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-400">
                <time dateTime={post.date}>{formatPostDate(post.date)}</time>
                <span aria-hidden>•</span>
                <span>{post.readingMinutes} мин чтения</span>
                {post.updated !== post.date ? (
                  <>
                    <span aria-hidden>•</span>
                    <span>Обновлено {formatPostDate(post.updated)}</span>
                  </>
                ) : null}
              </p>

              <p className="mt-6 text-lg leading-relaxed text-slate-300 sm:text-xl">
                {post.description}
              </p>
            </div>
          </header>

          <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
            <Markdown content={post.content} />

            <aside className="mt-12 rounded-3xl border border-blue-400/20 bg-blue-500/[0.07] p-6 sm:p-8">
              <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
                Бесплатный уровень
              </p>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white">
                8 уроков: слайсер и первые слои
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-200">
                Пошаговые настройки Bambu Studio и других слайсеров, калибровка
                и разбор брака — в бесплатном уровне обучения TriDi.
              </p>
              <ButtonLink href="/start" className="mt-6">
                Начать бесплатно
              </ButtonLink>
            </aside>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 transition-colors hover:text-blue-300"
              >
                <span aria-hidden>←</span>
                Все статьи блога
              </Link>
              <Link
                href="/forum"
                className="text-sm font-semibold text-slate-300 transition-colors hover:text-blue-400"
              >
                Задать вопрос на форуме →
              </Link>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
