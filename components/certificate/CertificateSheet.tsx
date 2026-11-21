import Image from "next/image";

import { CertificateQr } from "@/components/certificate/CertificateQr";
import {
  formatCertificateDate,
  type Certificate,
} from "@/lib/certificates";
import { LESSON_FORMS, pluralize } from "@/lib/course-stats";
import { getCertificateProgram, type CourseLevel } from "@/lib/course-levels";

/**
 * Стили, которые нельзя выразить Tailwind-классами: золотая заливка текста,
 * антиква для имени, тёплая подпись и правила печати.
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
  --cert-muted: #aebbd0;
  isolation: isolate;
}
.certificate-serif {
  font-family: "Cormorant Garamond", "Playfair Display", "Times New Roman",
    Georgia, serif;
}
.certificate-gold-text {
  background-image: linear-gradient(
    180deg,
    #fff5d9 0%,
    #edd39a 23%,
    #d1a75d 52%,
    #a97734 67%,
    #f1d69e 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 3px 12px rgba(227, 188, 110, 0.16));
}
.certificate-name {
  color: var(--cert-cream);
  text-shadow: 0 2px 22px rgba(243, 215, 158, 0.18);
}
.certificate-signature-image {
  /*
   * Чёрные штрихи на прозрачном фоне: инверсия делает подпись светлой, а
   * сепия добавляет тёплый оттенок бумаги. drop-shadow отделяет тонкие линии
   * от тёмно-синего бланка, не превращая подпись в белую заливку.
   */
  filter: brightness(0) invert(1) sepia(0.42) saturate(1.05) brightness(1.04)
    drop-shadow(0 0 9px rgba(255, 238, 201, 0.3));
  height: auto;
  width: 100%;
  max-width: 100%;
  object-fit: contain;
}
.certificate-grid {
  background-image:
    linear-gradient(rgba(247, 232, 197, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(247, 232, 197, 0.035) 1px, transparent 1px);
  background-size: 4.2cqw 4.2cqw;
  -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 78%);
  mask-image: radial-gradient(ellipse at center, black 0%, transparent 78%);
}
.certificate-gold-rule {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(216, 180, 111, 0.78) 24%,
    rgba(242, 220, 170, 0.95) 50%,
    rgba(216, 180, 111, 0.78) 76%,
    transparent
  );
}
`;

/**
 * Печатные правила подключаются только на странице сертификата.
 *
 * На лендинге `/start` тот же бланк стоит превью: если положить `@page` в общий
 * компонент, печать лендинга тоже станет альбомной, а тёмный фон уйдёт на всю
 * страницу.
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

/** Угол двойной рамки: тонкие золотые линии и маленький ромб, как на бланке. */
function FrameCorner({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 100 100"
    >
      <path
        d="M3 46V3h43"
        stroke="#d8b46f"
        strokeLinecap="square"
        strokeWidth="1.2"
      />
      <path
        d="M11 37V11h26"
        stroke="#d8b46f"
        strokeOpacity="0.55"
        strokeWidth="0.7"
      />
      <path
        d="M3 56h9M56 3v9"
        stroke="#f2dcaa"
        strokeLinecap="round"
        strokeOpacity="0.55"
        strokeWidth="0.75"
      />
      <path
        d="M11 11h9M20 11v9"
        stroke="#d8b46f"
        strokeLinecap="round"
        strokeOpacity="0.75"
        strokeWidth="0.7"
      />
      <rect
        height="8"
        stroke="#e8c98f"
        strokeOpacity="0.8"
        strokeWidth="0.65"
        transform="rotate(45 19.5 19.5)"
        width="8"
        x="15.5"
        y="15.5"
      />
      <circle cx="19.5" cy="19.5" fill="#f2dcaa" r="1.15" />
    </svg>
  );
}

/**
 * Логотип на бланке: изометрический куб в тонкой огранке.
 *
 * Внутри сертификата ссылка не нужна — документ не должен уводить со страницы,
 * поэтому это статичный знак, а не `Logo` из шапки.
 */
function CertificateBrand() {
  return (
    <div className="flex min-w-0 items-center gap-[0.95cqw]">
      <svg
        aria-hidden="true"
        className="h-[4.7cqw] w-[4.7cqw] shrink-0"
        fill="none"
        focusable="false"
        viewBox="0 0 68 68"
      >
        <path
          d="M34 2.5 63.5 19v30L34 65.5 4.5 49V19L34 2.5Z"
          stroke="#f5e7c9"
          strokeOpacity="0.23"
          strokeWidth="0.75"
        />
        <path
          d="M34 8.5 58.5 22.5v23L34 59.5 9.5 45.5v-23L34 8.5Z"
          stroke="#f5e7c9"
          strokeOpacity="0.5"
          strokeWidth="0.85"
        />
        <path
          d="M34 13.5 53.5 24.5 34 35.5 14.5 24.5 34 13.5Z"
          fill="#f5e7c9"
          fillOpacity="0.07"
          stroke="#f5e7c9"
          strokeOpacity="0.82"
          strokeWidth="0.9"
        />
        <path
          d="M14.5 24.5 34 35.5v19.5L14.5 44V24.5Z"
          fill="#f5e7c9"
          fillOpacity="0.035"
          stroke="#f5e7c9"
          strokeOpacity="0.65"
          strokeWidth="0.85"
        />
        <path
          d="M53.5 24.5 34 35.5v19.5L53.5 44V24.5Z"
          fill="#2f7bff"
          fillOpacity="0.08"
          stroke="#f5e7c9"
          strokeOpacity="0.65"
          strokeWidth="0.85"
        />
        <path
          d="M34 35.5v19.5M14.5 24.5l19.5 11 19.5-11"
          stroke="#f5e7c9"
          strokeOpacity="0.46"
          strokeWidth="0.7"
        />
        <circle cx="34" cy="24.5" fill="#2f7bff" r="4.7" />
        <circle
          cx="34"
          cy="24.5"
          fill="none"
          r="7.2"
          stroke="#6da3ff"
          strokeOpacity="0.45"
          strokeWidth="0.7"
        />
      </svg>

      <span className="min-w-0 truncate text-[1.65cqw] leading-none font-extrabold tracking-tight whitespace-nowrap">
        <span className="text-slate-100">tridi</span>
        <span className="text-[#4d8cff]">-print</span>
        <span className="text-slate-400">.ru</span>
      </span>
    </div>
  );
}

/**
 * Фоновые чертежи: слева принтер, справа катушка пластика.
 *
 * Линии нарочно бледные и не мешают тексту. Они рисуются SVG, а не картинкой,
 * поэтому остаются резкими в PDF и не тянут дополнительные запросы.
 */
function BackgroundArt() {
  return (
    <>
      <div
        aria-hidden="true"
        className="certificate-grid pointer-events-none absolute inset-0 opacity-60"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(41,92,170,0.16),transparent_48%)]"
      />

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-[24%] -left-[1%] h-[50%] w-[30%] opacity-[0.17]"
        fill="none"
        focusable="false"
        viewBox="0 0 300 340"
      >
        <g
          stroke="#d8b46f"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="0.9"
        >
          <path d="M52 58h192v198H52z" opacity="0.5" />
          <path d="M66 72h164v170H66z" opacity="0.24" />
          <path d="M66 102h164M66 223h164" opacity="0.32" />
          <path d="M78 112v100M218 112v100" opacity="0.2" />
          <path d="M68 174h158" opacity="0.42" />
          <path d="M104 165h55v18h-55z" opacity="0.72" />
          <path d="m124 183 7 24h-9l7-24" opacity="0.8" />
          <path d="M119 165v-36" opacity="0.55" />
          <path d="M45 258h203l-39 34H84z" opacity="0.45" />
          <path d="m93 263 17-25h84l17 25" opacity="0.32" />
          <path
            d="M119 238c2-18 21-29 37-21 16 7 19 22 8 30-10 7-25 3-29-7-3-9 5-16 14-15"
            opacity="0.65"
          />
          <path d="M165 229c14-7 30-3 38 8" opacity="0.4" />
          <path d="M84 292h143" opacity="0.28" />
        </g>
        <g
          stroke="#5b96ff"
          strokeLinecap="round"
          strokeOpacity="0.62"
          strokeWidth="0.85"
        >
          <path d="M146 133h34M146 141h23M146 149h17" />
          <path d="M78 206h38" />
        </g>
      </svg>

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-[32%] -right-[4%] h-[45%] w-[25%] opacity-[0.15]"
        fill="none"
        focusable="false"
        viewBox="0 0 240 280"
      >
        <g stroke="#d8b46f" strokeLinecap="round" strokeWidth="0.9">
          <circle cx="126" cy="126" opacity="0.46" r="92" />
          <circle cx="126" cy="126" opacity="0.28" r="73" />
          <circle cx="126" cy="126" opacity="0.54" r="41" />
          <circle cx="126" cy="126" opacity="0.72" r="14" />
          <path d="M126 34v49M126 169v49M34 126h49M169 126h49" opacity="0.4" />
          <path
            d="m61 61 35 35M156 156l35 35M191 61l-35 35M96 156l-35 35"
            opacity="0.34"
          />
          <path
            d="M126 218c46 12 76 32 88 58"
            strokeDasharray="3 5"
            opacity="0.48"
          />
        </g>
        <path
          d="M50 226h131l23 23H73l-23-23Z"
          stroke="#5b96ff"
          strokeLinejoin="round"
          strokeOpacity="0.5"
          strokeWidth="0.85"
        />
      </svg>
    </>
  );
}

/**
 * Одна ветвь лавра. Вторая половина венка — та же ветвь с отражением по X,
 * поэтому листья и изгиб гарантированно симметричны.
 */
function LaurelBranch({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 100 130"
    >
      <g
        fill="#d8b46f"
        fillOpacity="0.18"
        stroke="#d8b46f"
        strokeWidth="0.65"
      >
        <path
          d="M88 28C66 36 48 54 42 80C37 96 40 108 49 118"
          fill="none"
          strokeWidth="0.95"
        />
        <ellipse cx="82" cy="35" rx="4.4" ry="9" transform="rotate(32 82 35)" />
        <ellipse cx="73" cy="40" rx="4.3" ry="8.7" transform="rotate(50 73 40)" />
        <ellipse cx="65" cy="46" rx="4.2" ry="8.4" transform="rotate(42 65 46)" />
        <ellipse cx="58" cy="53" rx="4.1" ry="8.1" transform="rotate(32 58 53)" />
        <ellipse cx="52" cy="62" rx="4" ry="7.8" transform="rotate(22 52 62)" />
        <ellipse cx="47" cy="72" rx="3.8" ry="7.5" transform="rotate(12 47 72)" />
        <ellipse cx="44" cy="83" rx="3.7" ry="7.2" transform="rotate(2 44 83)" />
        <ellipse cx="43" cy="94" rx="3.6" ry="7" transform="rotate(-9 43 94)" />
        <ellipse
          cx="46"
          cy="105"
          rx="3.5"
          ry="6.8"
          transform="rotate(-20 46 105)"
        />
        <ellipse
          cx="51"
          cy="114"
          rx="3.4"
          ry="6.5"
          transform="rotate(-31 51 114)"
        />
        <ellipse cx="72" cy="53" rx="3.1" ry="6.5" transform="rotate(56 72 53)" />
        <ellipse cx="61" cy="64" rx="3" ry="6.2" transform="rotate(42 61 64)" />
        <ellipse cx="54" cy="77" rx="2.9" ry="6" transform="rotate(26 54 77)" />
        <ellipse cx="51" cy="91" rx="2.8" ry="5.8" transform="rotate(8 51 91)" />
        <ellipse
          cx="53"
          cy="104"
          rx="2.8"
          ry="5.6"
          transform="rotate(-12 53 104)"
        />
      </g>
    </svg>
  );
}

/**
 * Центральная эмблема: куб на постаменте в лавровом венке.
 *
 * Куб рисуется в координатах общего viewBox, а ветви лежат отдельными слоями:
 * так их можно отразить одной CSS-трансформацией.
 */
function CertificateEmblem({ className }: { className: string }) {
  return (
    <div className={`relative aspect-[260/150] ${className}`}>
      <LaurelBranch className="absolute top-[8%] left-[6%] h-[82%] w-[32%]" />
      <LaurelBranch className="absolute top-[8%] right-[6%] h-[82%] w-[32%] -scale-x-100" />

      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        fill="none"
        focusable="false"
        viewBox="0 0 260 150"
      >
        <defs>
          <linearGradient
            id="certificate-emblem-gold"
            x1="0"
            x2="1"
            y1="0"
            y2="1"
          >
            <stop offset="0" stopColor="#fff1cd" />
            <stop offset="0.34" stopColor="#e7c689" />
            <stop offset="0.68" stopColor="#b8843e" />
            <stop offset="1" stopColor="#f5dfae" />
          </linearGradient>
          <radialGradient id="certificate-emblem-glow">
            <stop offset="0" stopColor="#4d8cff" stopOpacity="0.3" />
            <stop offset="1" stopColor="#4d8cff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse
          cx="130"
          cy="77"
          fill="url(#certificate-emblem-glow)"
          rx="57"
          ry="43"
        />

        <path
          d="M107 104h46l-7 10h-32z"
          fill="url(#certificate-emblem-gold)"
          fillOpacity="0.28"
          stroke="url(#certificate-emblem-gold)"
          strokeWidth="0.85"
        />
        <path
          d="M101 114h58M95 119h70M130 104v10"
          stroke="url(#certificate-emblem-gold)"
          strokeLinecap="round"
          strokeOpacity="0.82"
          strokeWidth="0.9"
        />

        <path
          d="M130 36 166 56 130 76 94 56 130 36Z"
          fill="url(#certificate-emblem-gold)"
          fillOpacity="0.2"
          stroke="url(#certificate-emblem-gold)"
          strokeLinejoin="round"
          strokeWidth="1.15"
        />
        <path
          d="M94 56 130 76v34L94 90V56Z"
          fill="url(#certificate-emblem-gold)"
          fillOpacity="0.1"
          stroke="url(#certificate-emblem-gold)"
          strokeLinejoin="round"
          strokeWidth="1.15"
        />
        <path
          d="M166 56 130 76v34l36-20V56Z"
          fill="#4d8cff"
          fillOpacity="0.07"
          stroke="url(#certificate-emblem-gold)"
          strokeLinejoin="round"
          strokeWidth="1.15"
        />
        <path
          d="M130 76v34M130 44 152 56 130 68 108 56 130 44ZM108 56h44M130 44v24"
          stroke="url(#certificate-emblem-gold)"
          strokeLinecap="round"
          strokeOpacity="0.58"
          strokeWidth="0.75"
        />
        <circle
          cx="130"
          cy="56"
          fill="#4d8cff"
          fillOpacity="0.32"
          r="5.5"
        />
        <path
          d="M130 17h9v7h-9zM127 24h15"
          stroke="url(#certificate-emblem-gold)"
          strokeLinecap="round"
          strokeWidth="0.9"
        />
      </svg>
    </div>
  );
}

/**
 * Круглая печать учебного центра с лентами.
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
      viewBox="0 0 120 132"
    >
      <defs>
        <linearGradient id="certificate-seal-gold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff0c9" />
          <stop offset="0.45" stopColor="#d9b26a" />
          <stop offset="1" stopColor="#b17d36" />
        </linearGradient>
        <path d="M60 60m-40 0a40 40 0 1 1 80 0" id="certificate-seal-arc" />
      </defs>

      <path
        d="M42 82 31 128l29-14 29 14-11-46"
        fill="#0c2b58"
        stroke="#d8b46f"
        strokeLinejoin="round"
        strokeOpacity="0.9"
        strokeWidth="1.1"
      />
      <path d="M42 82 31 128l29-14" fill="#1d4f96" fillOpacity="0.65" />

      <circle
        cx="60"
        cy="60"
        fill="#071426"
        r="52"
        stroke="url(#certificate-seal-gold)"
        strokeWidth="1.7"
      />
      <circle
        cx="60"
        cy="60"
        r="45"
        stroke="#d8b46f"
        strokeDasharray="1.8 3"
        strokeOpacity="0.6"
        strokeWidth="0.8"
      />
      <circle
        cx="60"
        cy="60"
        r="33"
        stroke="url(#certificate-seal-gold)"
        strokeOpacity="0.7"
        strokeWidth="0.9"
      />

      <text
        fill="#f0d49a"
        fillOpacity="0.94"
        fontSize="6.6"
        fontWeight="700"
        letterSpacing="1.75"
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
        d="m60 45.5 3.05 6.18 6.82 1-4.94 4.81 1.17 6.79L60 61.05l-6.1 3.23 1.17-6.79-4.94-4.81 6.82-1L60 45.5Z"
        fill="#f4dca7"
        fillOpacity="0.94"
      />

      <text
        fill="#f0d49a"
        fillOpacity="0.82"
        fontSize="4.5"
        letterSpacing="1.15"
        textAnchor="middle"
        x="60"
        y="80"
      >
        EST. 2024
      </text>
    </svg>
  );
}

type CertificateSheetProps = {
  level: CourseLevel;
  certificate: Certificate;
  verifyUrl: string;
  /**
   * Превью на лендинге: тот же бланк, но без `@page` и печатных правил, которые
   * иначе перевели бы в альбомную ориентацию всю страницу `/start` при печати.
   */
  preview?: boolean;
};

/**
 * Размер имени зависит от его длины: короткое имя остаётся крупным акцентом,
 * длинное уменьшается на один шаг и не заезжает на подписи внизу. Иначе имя
 * из 30–40 символов на телефоне занимает три строки и ломает композицию A4.
 */
function nameSizeClass(length: number): string {
  if (length > 80) {
    return "text-[2.4cqw]";
  }
  if (length > 44) {
    return "text-[3.6cqw]";
  }
  if (length > 26) {
    return "text-[4.3cqw]";
  }
  if (length > 20) {
    return "text-[5.9cqw]";
  }
  return "text-[7.05cqw]";
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
  preview = false,
}: CertificateSheetProps) {
  const program = getCertificateProgram(level, certificate.fullCourse);

  return (
    <>
      <style>{CERTIFICATE_STYLES}</style>
      {preview ? null : <style>{CERTIFICATE_PRINT_STYLES}</style>}

      <div
        className={
          preview
            ? "certificate-frame w-full overflow-hidden rounded-[clamp(8px,1.1cqw,16px)] shadow-[0_24px_70px_-30px_rgba(2,10,24,0.9)]"
            : "certificate-frame mx-auto mt-8 w-full max-w-[1120px] overflow-hidden rounded-[2rem] shadow-[0_32px_110px_-28px_rgba(37,99,235,0.5)] print:mt-0 print:max-w-none print:rounded-none print:shadow-none"
        }
      >
        <article
          aria-label={`Сертификат TriDi: ${program.title}, ${certificate.name}`}
          className={`certificate-sheet relative aspect-[297/210] w-full overflow-hidden bg-[#06101f] text-slate-100 [container-type:inline-size] ${
            preview ? "rounded-[inherit]" : "rounded-[2rem] print:rounded-none"
          }`}
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 50% 4%, rgba(40,88,163,0.28), transparent 46%), radial-gradient(ellipse at 12% 96%, rgba(20,63,132,0.22), transparent 38%), linear-gradient(135deg, #081526 0%, #06101f 52%, #081a30 100%)",
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.04),transparent_28%,transparent_72%,rgba(255,255,255,0.025))]"
          />
          <BackgroundArt />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[1.25%] border border-[#d8b46f]/55"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[1.95%] border border-[#d8b46f]/20"
          />

          <FrameCorner className="pointer-events-none absolute top-[1.4%] left-[1.1%] h-[6.5cqw] w-[6.5cqw]" />
          <FrameCorner className="pointer-events-none absolute top-[1.4%] right-[1.1%] h-[6.5cqw] w-[6.5cqw] rotate-90" />
          <FrameCorner className="pointer-events-none absolute right-[1.1%] bottom-[1.4%] h-[6.5cqw] w-[6.5cqw] rotate-180" />
          <FrameCorner className="pointer-events-none absolute bottom-[1.4%] left-[1.1%] h-[6.5cqw] w-[6.5cqw] -rotate-90" />

          <div className="relative flex h-full flex-col px-[6.4%] pt-[3.1%] pb-[2.8%]">
            <header className="relative z-10 grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[2cqw]">
              <CertificateBrand />

              <CertificateEmblem className="w-[21.5cqw]" />

              <p className="max-w-[25cqw] justify-self-end text-right text-[0.78cqw] leading-relaxed font-semibold tracking-[0.23em] text-slate-300/90 uppercase">
                Онлайн-школа 3D-печати
              </p>
            </header>

            <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center pt-[0.4cqw] pb-[1.1cqw] text-center">
              <div className="flex w-full items-center gap-[1.7cqw]">
                <span className="certificate-gold-rule h-px flex-1" />
                <h2 className="certificate-serif certificate-gold-text shrink-0 text-[5.2cqw] leading-none font-semibold tracking-[0.18em] uppercase [text-indent:0.18em]">
                  Сертификат
                </h2>
                <span className="certificate-gold-rule h-px flex-1" />
              </div>

              <span
                aria-hidden="true"
                className="mt-[0.65cqw] h-[0.62cqw] w-[0.62cqw] rotate-45 bg-[#f2dcaa]/90 shadow-[0_0_12px_rgba(242,220,170,0.45)]"
              />

              <p className="mt-[0.9cqw] text-[0.96cqw] tracking-[0.17em] text-slate-400 uppercase">
                Настоящим подтверждается, что
              </p>

              <p
                className={`certificate-serif certificate-name mt-[0.3cqw] max-w-[90%] leading-[1.02] font-medium tracking-[0.01em] break-words ${nameSizeClass(certificate.name.trim().length)}`}
              >
                {certificate.name}
              </p>

              <div
                aria-hidden="true"
                className="mt-[0.9cqw] flex w-[46%] items-center gap-[1.1cqw]"
              >
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#d8b46f]/70" />
                <span className="h-[0.5cqw] w-[0.5cqw] rotate-45 bg-[#e8c98f]" />
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#d8b46f]/70" />
              </div>

              <p className="mt-[0.7cqw] text-[1.02cqw] tracking-[0.15em] text-slate-300">
                успешно завершил(а) обучение
              </p>

              <p
                className={`certificate-serif certificate-gold-text mt-[0.35cqw] max-w-[88%] leading-[1.14] font-semibold ${
                  certificate.fullCourse
                    ? "text-[2.35cqw]"
                    : "text-[3.05cqw]"
                }`}
              >
                {program.title}
              </p>

              <p className="mt-[0.75cqw] text-[0.9cqw] tracking-[0.08em] text-slate-400">
                Объём: {program.lessons}{" "}
                {pluralize(program.lessons, LESSON_FORMS)} / {program.hours}{" "}
                {pluralize(program.hours, ACADEMIC_HOUR_FORMS)}
              </p>
            </div>

            <footer className="relative z-10 grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-[1.8%] border-t border-[#d8b46f]/25 pt-[1.2cqw]">
              <div className="justify-self-start pl-[1.2%]">
                <p className="text-[0.68cqw] tracking-[0.18em] text-[#d8b46f]/90 uppercase">
                  Дата выдачи
                </p>
                <p className="mt-[0.35cqw] text-[1.25cqw] leading-tight font-semibold text-slate-100">
                  {formatCertificateDate(certificate.issuedAt)}
                </p>
              </div>

              <div className="flex min-w-0 items-center justify-center gap-[1cqw]">
                <CertificateSeal className="h-[9.4cqw] w-auto shrink-0" />

                <div className="flex w-[25cqw] min-w-0 flex-col items-center text-center">
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="certificate-signature-image"
                    height={889}
                    sizes="(max-width: 768px) 30vw, 280px"
                    src="/signature.png"
                    width={1404}
                  />
                  <p className="mt-[0.1cqw] text-[1.05cqw] font-semibold tracking-[0.02em] text-slate-100">
                    Накоряков В.С.
                  </p>
                  <p className="mt-[0.28cqw] text-[0.64cqw] leading-[1.45] tracking-[0.13em] text-slate-400 uppercase">
                    Основатель школы 3D-печати
                    <span className="block normal-case">tridi-print.ru</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-self-end pr-[1.2%]">
                <div className="rounded-[clamp(2px,0.3cqw,4px)] border border-[#d8b46f]/70 bg-white p-[clamp(2px,0.42cqw,5px)] shadow-[0_0_18px_rgba(216,180,111,0.16)]">
                  <CertificateQr
                    className="w-[8.8cqw]"
                    value={verifyUrl}
                  />
                </div>
                <p className="mt-[clamp(2px,0.42cqw,6px)] text-[0.62cqw] tracking-[0.15em] text-slate-400 uppercase">
                  ID сертификата
                </p>
                <p className="mt-[0.1cqw] text-[0.7cqw] font-medium tracking-[0.06em] text-slate-200">
                  {certificate.number}
                </p>
              </div>
            </footer>
          </div>
        </article>
      </div>
    </>
  );
}
