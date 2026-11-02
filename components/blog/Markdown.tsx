"use client";

import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";

import styles from "./markdown.module.css";

/**
 * Ссылки в тексте статьи.
 *
 * Внутренние адреса идут через `next/link` (клиентская навигация и prefetch),
 * внешние — обычный `<a>` с `rel="noopener noreferrer"` и новой вкладкой: уводить
 * читателя с сайта в том же окне незачем, а открывать `target="_blank"` без
 * `rel` небезопасно.
 */
const COMPONENTS: Components = {
  a({ href, children }) {
    const target = href ?? "";

    if (target.startsWith("/") || target.startsWith("#")) {
      return <Link href={target}>{children}</Link>;
    }

    return (
      <a href={target} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    );
  },
};

/**
 * Markdown-текст статьи.
 *
 * react-markdown держит состояние разбора (useState/useEffect), поэтому
 * компонент клиентский. HTML при этом приходит с сервера: Next.js рендерит
 * клиентские компоненты на сервере тоже, и поисковик видит полный текст
 * статьи в первом ответе, без ожидания JavaScript.
 */
export function Markdown({ content }: { content: string }) {
  return (
    <div className={styles.content}>
      <ReactMarkdown components={COMPONENTS}>{content}</ReactMarkdown>
    </div>
  );
}
