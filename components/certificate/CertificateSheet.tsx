import Image from "next/image";

import { CertificateQr } from "@/components/certificate/CertificateQr";
import { Logo } from "@/components/Logo";
import {
  formatCertificateDate,
  type Certificate,
} from "@/lib/certificates";
import type { CourseLevel } from "@/lib/course-levels";

/**
 * Стили, которые нельзя выразить Tailwind-классами: масштабирование логотипа
 * внутри бланка, белая подпись поверх тёмного фона и правила печати.
 *
 * Размеры в `cqw` считаются от ширины самого сертификата, а не окна. Поэтому
 * композиция одинаково выглядит на телефоне, широком мониторе и листе A4:
 * уменьшается или увеличивается целиком, без поломки сетки.
 */
const CERTIFICATE_STYLES = `
.certificate-logo {
  gap: clamp(4px, 0.8cqw, 12px);
}
.certificate-logo a {
  gap: clamp(4px, 0.8cqw, 12px);
}
.certificate-logo a > svg {
  width: clamp(21px, 4.2cqw, 48px);
  height: clamp(21px, 4.2cqw, 48px);
}
.certificate-logo a > span {
  font-size: clamp(0.68rem, 1.7cqw, 1.55rem);
}
.certificate-signature-image {
  /* Чёрные штрихи на прозрачном фоне: инверсия делает подпись белой. */
  filter: brightness(0) invert(1);
  height: auto;
  width: clamp(84px, 14.5cqw, 168px);
}
@page {
  size: A4 landscape;
  margin: 0;
}
@media print {
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #0f172a !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .certificate-sheet {
    /*
     * 209 мм вместо 210: браузеры добавляют доли миллиметра при округлении
     * и создают вторую пустую страницу. Один миллиметр снизу незаметен на A4.
     */
    width: 297mm !important;
    height: 209mm !important;
    min-height: 0 !important;
    max-width: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    aspect-ratio: auto !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .certificate-sheet * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;

/** Декоративный угол двойной рамки: золото снаружи, синий акцент внутри. */
function CornerOrnament({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 100 100"
    >
      <path
        d="M5 39V5h34"
        stroke="#f59e0b"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
      <path
        d="M13 31V13h18"
        stroke="#3b82f6"
        strokeLinecap="round"
        strokeOpacity="0.75"
        strokeWidth="0.9"
      />
      <path
        d="M5 53h9M53 5v9"
        stroke="#f59e0b"
        strokeLinecap="round"
        strokeOpacity="0.55"
        strokeWidth="0.9"
      />
      <circle cx="22" cy="22" fill="#f59e0b" r="2.2" />
      <path
        d="M16 29 29 16"
        stroke="#f59e0b"
        strokeLinecap="round"
        strokeOpacity="0.65"
        strokeWidth="0.8"
      />
    </svg>
  );
}

/**
 * Круглая печать учебного центра.
 *
 * Полупрозрачная и без растровых картинок: остаётся чёткой в PDF, не требует
 * внешних ассетов и не спорит с подписью. Текст идёт по дуге, в центре — звезда.
 */
function CertificateSeal({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 120 120"
    >
      <defs>
        <path d="M60 60m-42 0a42 42 0 1 1 84 0" id="certificate-seal-arc" />
      </defs>
      <circle
        cx="60"
        cy="60"
        r="56"
        stroke="#f59e0b"
        strokeOpacity="0.75"
        strokeWidth="1.4"
      />
      <circle
        cx="60"
        cy="60"
        r="49"
        stroke="#3b82f6"
        strokeDasharray="2 3.2"
        strokeOpacity="0.6"
        strokeWidth="0.8"
      />
      <circle
        cx="60"
        cy="60"
        r="33"
        stroke="#f59e0b"
        strokeOpacity="0.55"
        strokeWidth="0.8"
      />
      <text
        fill="#fbbf24"
        fillOpacity="0.92"
        fontSize="7.2"
        fontWeight="700"
        letterSpacing="1.9"
      >
        <textPath
          href="#certificate-seal-arc"
          startOffset="50%"
          textAnchor="middle"
        >
          TRIDI CERTIFIED
        </textPath>
      </text>
      <path
        d="m60 48.5 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L60 62.53l-5.5 2.89 1.05-6.12-4.45-4.33 6.15-.9L60 48.5Z"
        fill="#fbbf24"
        fillOpacity="0.9"
      />
      <text
        fill="#fcd34d"
        fillOpacity="0.8"
        fontSize="4.6"
        letterSpacing="1.2"
        textAnchor="middle"
        x="60"
        y="79"
      >
        EST. 2026
      </text>
    </svg>
  );
}

type CertificateSheetProps = {
  level: CourseLevel;
  certificate: Certificate;
  verifyUrl: string;
};

/**
 * Размер имени зависит от его длины: короткое имя остаётся крупным акцентом,
 * длинное уменьшается на один шаг и не заезжает на подписи внизу. Иначе имя
 * из 30–40 символов на телефоне занимает три строки и ломает композицию A4.
 */
function nameSizeClass(length: number): string {
  if (length > 80) {
    return "text-[clamp(0.7rem,2.6cqw,2rem)]";
  }
  if (length > 44) {
    return "text-[clamp(0.85rem,3.8cqw,2.9rem)]";
  }
  if (length > 26) {
    return "text-[clamp(0.9rem,4cqw,3.1rem)]";
  }
  if (length > 20) {
    return "text-[clamp(1.1rem,5.8cqw,4.3rem)]";
  }
  return "text-[clamp(1.28rem,6.8cqw,4.9rem)]";
}

/**
 * Премиальный бланк сертификата в пропорциях A4 Landscape.
 *
 * На экране лист целиком помещается в ширину контейнера: `aspect-[297/210]`
 * держит пропорции, а `overflow-hidden` не даёт декоративным элементам выйти за
 * края. Все размеры шрифтов и отступов заданы в `cqw`, поэтому на телефоне
 * документ уменьшается как единая композиция, а не ломается по брейкпоинтам.
 *
 * При печати бланк разворачивается ровно в лист A4 Landscape. `print-color-adjust`
 * сохраняет тёмный фон, золото и синие акценты в PDF, а QR остаётся векторным.
 */
export function CertificateSheet({
  level,
  certificate,
  verifyUrl,
}: CertificateSheetProps) {
  return (
    <>
      <style>{CERTIFICATE_STYLES}</style>

      <div className="certificate-frame mx-auto mt-8 w-full max-w-[1120px] overflow-hidden rounded-[2rem] shadow-[0_32px_110px_-28px_rgba(37,99,235,0.5)] print:mt-0 print:max-w-none print:rounded-none print:shadow-none">
        <article
          aria-label={`Сертификат TriDi: ${level.title}, ${certificate.name}`}
          className="certificate-sheet relative aspect-[297/210] w-full overflow-hidden rounded-[2rem] bg-[#0f172a] text-slate-100 [container-type:inline-size] print:rounded-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 8%, rgba(59,130,246,0.2), transparent 43%), radial-gradient(circle at 8% 92%, rgba(245,158,11,0.12), transparent 38%), linear-gradient(135deg, #0f172a 0%, #0b1528 55%, #0f1b33 100%)",
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.035),transparent_30%,transparent_70%,rgba(255,255,255,0.025))]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 border-2 border-blue-500/75"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[clamp(6px,1.15cqw,14px)] border border-amber-400/75"
          />

          <CornerOrnament className="pointer-events-none absolute top-[2.3%] left-[2.1%] h-[clamp(28px,8.4cqw,92px)] w-[clamp(28px,8.4cqw,92px)]" />
          <CornerOrnament className="pointer-events-none absolute top-[2.3%] right-[2.1%] h-[clamp(28px,8.4cqw,92px)] w-[clamp(28px,8.4cqw,92px)] rotate-90" />
          <CornerOrnament className="pointer-events-none absolute right-[2.1%] bottom-[2.3%] h-[clamp(28px,8.4cqw,92px)] w-[clamp(28px,8.4cqw,92px)] rotate-180" />
          <CornerOrnament className="pointer-events-none absolute bottom-[2.3%] left-[2.1%] h-[clamp(28px,8.4cqw,92px)] w-[clamp(28px,8.4cqw,92px)] -rotate-90" />

          <div className="relative flex h-full flex-col px-[6.4%] pt-[3.6%] pb-[3%]">
            <header className="flex shrink-0 items-center justify-between gap-[3cqw] border-b border-amber-400/30 pb-[1.5%]">
              <Logo showBadges={false} className="certificate-logo" />
              <p className="max-w-[40%] text-right text-[clamp(0.42rem,0.94cqw,0.72rem)] leading-relaxed font-semibold tracking-[0.22em] text-slate-300 uppercase">
                Онлайн-школа 3D-печати
              </p>
            </header>

            <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
              <div className="flex w-full items-center gap-[2.2cqw]">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/40 to-amber-400/85" />
                <h2 className="shrink-0 text-[clamp(1.08rem,4.9cqw,3.5rem)] leading-none font-semibold tracking-[0.22em] text-white uppercase [text-indent:0.22em]">
                  Сертификат
                </h2>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent via-amber-400/40 to-amber-400/85" />
              </div>

              <p className="mt-[2.2cqw] text-[clamp(0.44rem,1.04cqw,0.8rem)] tracking-[0.16em] text-slate-400">
                Настоящим подтверждается, что
              </p>

              <p
                className={`mt-[1.2cqw] max-w-[90%] font-serif leading-[1.02] font-medium tracking-[0.01em] break-words text-white ${nameSizeClass(certificate.name.trim().length)}`}
              >
                {certificate.name}
              </p>

              <div
                aria-hidden="true"
                className="mt-[1.3cqw] flex w-[44%] items-center gap-[1.1cqw]"
              >
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-400/60" />
                <span className="h-[0.6cqw] w-[0.6cqw] rotate-45 bg-amber-300/90" />
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-400/60" />
              </div>

              <p className="mt-[1.3cqw] text-[clamp(0.46rem,1.08cqw,0.82rem)] tracking-[0.14em] text-slate-300">
                успешно завершил(а) курс
              </p>

              <p className="mt-[0.7cqw] max-w-[88%] text-[clamp(0.9rem,3.7cqw,2.85rem)] leading-tight font-semibold break-words text-amber-100">
                {level.title}
              </p>
            </div>

            <footer className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_auto] items-end gap-[2.5%] border-t border-amber-400/35 pt-[1.6%]">
              <div className="min-w-0">
                <p className="text-[clamp(0.38rem,0.82cqw,0.64rem)] tracking-[0.16em] text-slate-400 uppercase">
                  Дата выдачи
                </p>
                <p className="mt-[0.7em] text-[clamp(0.58rem,1.35cqw,1.05rem)] leading-snug font-semibold text-white">
                  {formatCertificateDate(certificate.issuedAt)}
                </p>
              </div>

              <div className="flex min-w-0 items-center justify-center gap-[clamp(4px,1.1cqw,14px)]">
                <CertificateSeal className="h-[clamp(37px,8.4cqw,94px)] w-[clamp(37px,8.4cqw,94px)] shrink-0 -rotate-6 opacity-90" />
                <div className="min-w-0 text-center">
                  <Image
                    src="/signature.png"
                    alt="Подпись Вадима Накорякова"
                    width={1404}
                    height={889}
                    priority
                    className="certificate-signature-image mx-auto"
                  />
                  <p className="mt-[0.45em] text-[clamp(0.42rem,0.95cqw,0.76rem)] leading-tight font-semibold text-white">
                    Накоряков В.С.
                  </p>
                  <p className="mt-[0.35em] text-[clamp(0.34rem,0.78cqw,0.6rem)] tracking-[0.1em] text-slate-400 uppercase">
                    Основатель школы 3D-печати tridi-print.ru
                  </p>
                </div>
              </div>

              <div className="flex min-w-0 flex-col items-end">
                <CertificateQr
                  value={verifyUrl}
                  className="w-[clamp(43px,9.7cqw,108px)]"
                />
                <p className="mt-[0.7cqw] max-w-[15ch] text-right font-mono text-[clamp(0.34rem,0.68cqw,0.56rem)] leading-tight break-all text-slate-400">
                  <span className="block uppercase">ID сертификата</span>
                  <span className="text-slate-300">{certificate.number}</span>
                </p>
              </div>
            </footer>
          </div>
        </article>
      </div>
    </>
  );
}
