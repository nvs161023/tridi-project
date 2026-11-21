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
 * Новый бланк `sert.png` нарисован в той же премиальной манере, что и
 * утверждённый образец: золотая антиква, тёмно-синий фон и тонкая рамка.
 * Cormorant Garamond даёт высокую контрастность и широкие выносные элементы,
 * поэтому хорошо ложится на пустые зоны шаблона. Шрифт подключается один раз
 * и передаётся в бланк CSS-переменной, чтобы не дублировать начертания.
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
.certificate-title {
  /*
   * Cormorant Garamond по умолчанию рисует старостильные цифры: у глифа
   * «three» верх на уровне строчных и вынос ниже базовой линии. В заголовке
   * из-за этого «3» в «3D-печать» выбивалась из строки рядом с прописной D.
   * Фича lnum переключает цифры на lining-варианты (.lf) в рост прописных.
   */
  font-variant-numeric: lining-nums;
}
.certificate-ui {
  font-family: var(--font-geist-sans), "Geist", "Segoe UI", Arial, sans-serif;
}
.certificate-name {
  background-image: linear-gradient(
    180deg,
    #fffdf3 0%,
    #fbecc4 18%,
    #e5c283 42%,
    #b27a36 58%,
    #e8c88c 76%,
    #fff6d9 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 0 rgba(48, 25, 7, 0.9))
    drop-shadow(0 6px 9px rgba(0, 0, 0, 0.55))
    drop-shadow(0 0 26px rgba(232, 195, 125, 0.2));
}
.certificate-gold-text {
  background-image: linear-gradient(
    180deg,
    #fff8e6 0%,
    #f3dcaa 26%,
    #d6aa63 52%,
    #b47f3e 64%,
    #efd09b 82%,
    #fff4d4 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 1px 0 rgba(55, 31, 10, 0.9))
    drop-shadow(0 4px 7px rgba(0, 0, 0, 0.5));
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
 * длинное уменьшается и не заезжает на декоративный разделитель. В новом
 * бланке под имя отведена одна широкая строка между «Настоящим подтверждается»
 * и ромбом, поэтому даже имя с отчеством должно оставаться читаемым.
 */
function nameSizeClass(length: number): string {
  if (length > 80) {
    return "text-[2.7cqw]";
  }
  if (length > 56) {
    return "text-[3.2cqw]";
  }
  if (length > 40) {
    return "text-[3.7cqw]";
  }
  if (length > 28) {
    return "text-[4.4cqw]";
  }
  if (length > 20) {
    return "text-[5cqw]";
  }
  return "text-[5.6cqw]";
}

/**
 * Название курса занимает почти всю ширину строки между «успешно завершил(а)»
 * и нижней линией подвала. Для длинного пакета «Все 3 уровня» кегль
 * уменьшается, чтобы текст остался в одну строку и не задел часы.
 */
function courseSizeClass(length: number): string {
  if (length > 80) {
    return "text-[2.2cqw]";
  }
  if (length > 60) {
    return "text-[2.6cqw]";
  }
  if (length > 48) {
    return "text-[3cqw]";
  }
  if (length > 38) {
    return "text-[3.3cqw]";
  }
  return "text-[3.6cqw]";
}

/**
 * Премиальный бланк сертификата на основе готового шаблона `sert.png`.
 *
 * Шаблон 1358 × 950 уже содержит рамку, логотип, эмблему, печать и подпись.
 * Компонент не перерисовывает декор, а заполняет только пустые зоны:
 * имя получателя, название курса, объём, дату, QR и номер. Это сохраняет
 * исходную графику пиксельно точной и исключает расхождения со шрифтами.
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
  const hours = `${program.hours} ${pluralize(program.hours, ACADEMIC_HOUR_FORMS)}`;
  const lessons = `${program.lessons} ${pluralize(program.lessons, LESSON_FORMS)}`;

  return (
    <>
      <style>{CERTIFICATE_STYLES}</style>
      <style>{CERTIFICATE_PRINT_STYLES}</style>

      <div className="certificate-frame mx-auto mt-8 w-full max-w-[1120px] overflow-hidden rounded-xl shadow-[0_32px_110px_-28px_rgba(37,99,235,0.5)] print:mt-0 print:max-w-none print:rounded-none print:shadow-none">
        <article
          aria-label={`Сертификат TriDi: ${program.title}, ${certificate.name}`}
          className={`certificate-sheet ${certificateSerif.variable} relative aspect-[1358/950] w-full overflow-hidden rounded-xl bg-[#07162b] text-slate-100 [container-type:inline-size] print:rounded-none`}
        >
          <Image
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-fill select-none"
            height={950}
            priority
            quality={90}
            sizes="(max-width: 768px) 100vw, 1120px"
            src="/sert.png"
            width={1358}
          />

          <div className="absolute top-[34.5%] left-1/2 z-10 w-[78%] -translate-x-1/2 -translate-y-1/2 text-center">
            <p
              className={`certificate-serif certificate-name leading-[0.95] font-semibold tracking-[0.01em] break-words ${nameSizeClass(
                certificate.name.trim().length,
              )}`}
            >
              {certificate.name}
            </p>
          </div>

          <div className="absolute top-[51.5%] left-1/2 z-10 w-[84%] -translate-x-1/2 -translate-y-1/2 text-center">
            <p
              className={`certificate-serif certificate-title certificate-gold-text inline-block leading-[1.06] font-semibold tracking-[0.01em] whitespace-nowrap ${courseSizeClass(
                program.title.length,
              )}`}
            >
              {program.title}
            </p>
          </div>

          <p className="certificate-ui absolute top-[56.8%] left-1/2 z-10 w-[66%] -translate-x-1/2 -translate-y-1/2 text-center text-[1.32cqw] leading-[1.4] tracking-[0.18em] text-[#c8d1e1]/90">
            {hours}{" "}
            <span className="mx-[0.55em] text-[#c9a46a]">·</span>{" "}
            {lessons}
          </p>

          <div className="absolute top-[64.2%] left-[87.8%] z-10 w-[14.4%] -translate-x-1/2">
            <p className="certificate-ui text-center text-[0.88cqw] leading-none tracking-[0.18em] text-[#c9a46a]/90">
              дата выдачи
            </p>
            <p className="certificate-serif certificate-light-text mt-[0.4cqw] text-center text-[1.55cqw] leading-none font-semibold tracking-[0.02em] whitespace-nowrap text-[#f2e8d6]">
              {formatCertificateDate(certificate.issuedAt)}
            </p>

            <div className="mt-[1.1cqw] border-[0.11cqw] border-[#c9a46a]/80 bg-[#061326] p-[0.3cqw] shadow-[0_0_1.8cqw_rgba(201,164,106,0.18)]">
              <CertificateQr className="w-full" value={verifyUrl} />
            </div>

            <p className="certificate-ui mt-[0.9cqw] text-center text-[0.92cqw] leading-[1.15] font-medium tracking-[0.08em] break-all text-[#b9c3d4]">
              <span className="text-[#c9a46a]">№ </span>
              {certificate.number}
            </p>
          </div>
        </article>
      </div>
    </>
  );
}
