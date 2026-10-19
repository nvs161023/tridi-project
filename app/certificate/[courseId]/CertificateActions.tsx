"use client";

import { useState } from "react";

/**
 * Кнопки под сертификатом: печать/PDF и копирование публичной ссылки.
 *
 * Печать — единственный способ получить PDF без серверных библиотек: в диалоге
 * браузера пользователь выбирает «Сохранить как PDF». Ссылка копируется в буфер;
 * если браузер запретил доступ (не HTTPS), показываем стандартный prompt, чтобы
 * человек всё равно мог скопировать её вручную.
 */
export function CertificateActions({ verifyUrl }: { verifyUrl: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!verifyUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
    } catch {
      window.prompt("Скопируйте ссылку на проверку сертификата", verifyUrl);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <span aria-hidden>🖨</span>
        Скачать PDF или распечатать
      </button>

      {verifyUrl ? (
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden>{copied ? "✓" : "🔗"}</span>
          {copied ? "Ссылка скопирована" : "Скопировать ссылку проверки"}
        </button>
      ) : null}
    </div>
  );
}
