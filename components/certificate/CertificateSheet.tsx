import Image from "next/image";
import { Cormorant_Garamond } from "next/font/google";

import { CertificateQr } from "@/components/certificate/CertificateQr";
import {
  formatCertificateDate,
  type Certificate,
} from "@/lib/certificates";
import { LESSON_FORMS, pluralize } from "@/lib/course-stats";
import { getCertificateProgram, type CourseLevel } from "@/lib/course-levels";

/**
 * Антиква с кириллицей для имени, названия курса и даты.
 *
 * Cormorant Garamond даёт высокую контрастность и широкие выносные элементы,
 * как в утверждённом образце `certifikat.png`. Шрифт подключается один раз и
 * передаётся в бланк CSS-переменной, чтобы не дублировать начертания.
 */
const certificateSerif = Cormorant_Garamond({
  display: "swap",
  subsets: ["cyrillic", "latin"],
  variable: "--font-certificate-serif",
  weight: ["400", "500", "600", "700"],
});

/**
 * Стили, которые нельзя выразить Tailwind-классами: золотая заливка текста,
 * антиква и мягкая тень светлых подписей.
 *
 * Размеры в `cqw` считаются от ширины самого сертификата, а не окна. Поэтому
 * композиция одинаково выглядит на телефоне, широком мониторе и листе A4:
 * уменьшается или увеличивается целиком, без поломки сетки.
 */
const CERTIFICATE_STYLES = `
.certificate-sheet {
  --cert-gold: #d8b46f;
  --cert-gold-light: #f2dcaa;
  --cert-cream: #f3e4c4;
  isolation: isolate;
}
.certificate-serif {
  font-family: var(--font-certificate-serif), "Cormorant Garamond",
    "Playfair Display", "Times New Roman", Georgia, serif;
  font-optical-sizing: auto;
}
.certificate-gold-text {
  background-image: linear-gradient(
    180deg,
    #fff9e9 0%,
    #f5dfad 17%,
    #d8af68 40%,
    #a36f2e 55%,
    #e4bf78 72%,
    #fff0c6 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 1px 0 rgba(65, 37, 11, 0.9))
    drop-shadow(0 4px 3px rgba(0, 0, 0, 0.5))
    drop-shadow(0 0 14px rgba(229, 186, 104, 0.18));
}
.certificate-name {
  background-image: linear-gradient(
    180deg,
    #fffdf5 0%,
    #faefd7 34%,
    #e8d1a4 56%,
    #c39a5b 72%,
    #f8e7c0 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 0 rgba(55, 31, 12, 0.92))
    drop-shadow(0 5px 7px rgba(0, 0, 0, 0.55))
    drop-shadow(0 0 24px rgba(243, 215, 158, 0.2));
}
.certificate-light-text {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65),
    0 4px 12px rgba(0, 0, 0, 0.28);
}
`;

/**
 * Печатные правила подключаются вместе с бланком на странице сертификата.
 *
 * На лендинге `/start` стоит растровый образец, поэтому `@page` не может
 * перевести печать самого лендинга в альбомную ориентацию.
 */
const CERTIFICATE_PRINT_STYLES = `
@page {
  size: A4 landscape;
  margin: 0;
}
@media print {
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #06101f !important;
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

/** Формы «академического часа»: на бланке нужен именно академический объём. */
const ACADEMIC_HOUR_FORMS: [string, string, string] = [
  "академический час",
  "академических часа",
  "академических часов",
];
type CertificateSheetProps = {
  level: CourseLevel;
  certificate: Certificate;
  verifyUrl: string;
};

/**
 * Размер имени зависит от его длины: короткое имя остаётся крупным акцентом,
 * длинное уменьшается и не заезжает на подписи внизу. Иначе имя из 30–40
 * символов на телефоне занимает три строки и ломает композицию A4.
 */
function nameSizeClass(length: number): string {
  if (length > 80) {
    return "text-[2.6cqw]";
  }
  if (length > 44) {
    return "text-[3.4cqw]";
  }
  if (length > 26) {
    return "text-[4.6cqw]";
  }
  if (length > 20) {
    return "text-[6.6cqw]";
  }
  return "text-[7.8cqw]";
}

/**
 * Название курса занимает почти всю ширину строки. Для длинного пакета
 * «Все 3 уровня» кегль уменьшается, чтобы текст остался в одну строку.
 */
function courseSizeClass(length: number): string {
  if (length > 70) {
    return "text-[2.7cqw]";
  }
  if (length > 52) {
    return "text-[3cqw]";
  }
  return "text-[3.5cqw]";
}

/**
 * Премиальный бланк сертификата в пропорциях утверждённого образца.
 *
 * Статическая часть — рамка, логотип, эмблема, печать, подпись и подписи
 * полей — берётся из `certificate-blank.png`. Это точная копия макета с
 * вырезанными персональными данными: так бланк совпадает с референсом без
 * рисования декоративной графики заново. Динамические поля (имя, курс,
 * объём, дата, QR и номер) накладываются поверх в тех же координатах.
 *
 * Все позиции и кегли заданы в процентах и `cqw` от ширины листа. Поэтому
 * документ целиком масштабируется на телефоне, мониторе и в PDF.
 */
export function CertificateSheet({
  level,
  certificate,
  verifyUrl,
}: CertificateSheetProps) {
  const program = getCertificateProgram(level, certificate.fullCourse);

  return (
    <>
      <style>{CERTIFICATE_STYLES}</style>
      <style>{CERTIFICATE_PRINT_STYLES}</style>

      <div className="certificate-frame mx-auto mt-8 w-full max-w-[1120px] overflow-hidden rounded-[2rem] shadow-[0_32px_110px_-28px_rgba(37,99,235,0.5)] print:mt-0 print:max-w-none print:rounded-none print:shadow-none">
        <article
          aria-label={`Сертификат TriDi: ${program.title}, ${certificate.name}`}
          className={`certificate-sheet ${certificateSerif.variable} relative aspect-[1808/1264] w-full overflow-hidden rounded-[2rem] bg-[#061428] text-slate-100 [container-type:inline-size] print:rounded-none`}
        >
          <Image
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-fill select-none"
            height={1264}
            priority
            quality={90}
            sizes="(max-width: 768px) 100vw, 1120px"
            src="/certificate-blank.png"
            width={1808}
          />

          <div className="absolute top-[35.4%] left-[50.2%] z-10 flex w-[66%] -translate-x-1/2 -translate-y-1/2 items-center justify-center text-center">
            <p
              className={`certificate-serif certificate-name origin-center leading-[0.98] font-semibold tracking-[0.005em] break-words scale-x-[1.055] ${nameSizeClass(
                certificate.name.trim().length,
              )}`}
            >
              {certificate.name}
            </p>
          </div>

          <div className="absolute top-[50.58%] left-[48.3%] z-10 w-[82%] -translate-x-1/2 -translate-y-1/2 text-center">
            <p
              className={`certificate-serif certificate-gold-text inline-block origin-center leading-[1.05] font-semibold tracking-[0.01em] scale-x-[1.14] ${courseSizeClass(
                program.title.length,
              )}`}
            >
              {program.title}
            </p>
          </div>

          <p className="absolute top-[55.45%] left-1/2 z-10 w-[44%] -translate-x-1/2 -translate-y-1/2 text-center text-[1.13cqw] leading-[1.2] tracking-[0.07em] text-slate-300/95">
            Объём: {program.lessons} {pluralize(program.lessons, LESSON_FORMS)}{" "}
            / {program.hours} {pluralize(program.hours, ACADEMIC_HOUR_FORMS)}
          </p>

          <p className="certificate-serif certificate-light-text absolute top-[86.2%] left-[7.3%] z-10 w-[20%] text-[2.13cqw] leading-none font-semibold whitespace-nowrap text-slate-100">
            {formatCertificateDate(certificate.issuedAt)}
          </p>

          <div className="absolute top-[70.7%] left-[83.8%] z-10 w-[10%]">
            <div className="rounded-[0.35cqw] border-[0.1cqw] border-[#d8b46f] bg-white p-[0.08cqw] shadow-[0_0_1.2cqw_rgba(216,180,111,0.22)]">
              <CertificateQr className="w-full" value={verifyUrl} />
            </div>
            <p className="mx-auto mt-[1.65cqw] w-[88%] text-center text-[1.1cqw] leading-[1.05] font-semibold tracking-[0.02em] break-all text-slate-100">
              {certificate.number}
            </p>
          </div>
        </article>
      </div>
    </>
  );
}
