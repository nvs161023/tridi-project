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
 * Антиква с кириллицей для заголовка, имени и названия курса.
 *
 * Times New Roman, который браузер подставлял раньше, слишком узкий: имя не
 * занимало ширину утверждённого макета. Cormorant Garamond даёт ту же высокую
 * контрастность и широкие выносные элементы, что и образец `certifikat.png`.
 */
const certificateSerif = Cormorant_Garamond({
  display: "swap",
  subsets: ["cyrillic", "latin"],
  variable: "--font-certificate-serif",
  weight: ["400", "500", "600", "700"],
});

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
.certificate-signature-image {
  /*
   * Чёрные штрихи на прозрачном фоне: инверсия делает подпись светлой, а
   * сепия добавляет тёплый оттенок бумаги. Два коротких drop-shadow добавляют
   * тонкой рукописной линии плотность, чтобы она читалась так же уверенно,
   * как более толстая подпись в утверждённом макете.
   */
  filter: brightness(0) invert(1) sepia(1) saturate(3) hue-rotate(348deg)
    brightness(0.92) drop-shadow(0 0 0.7px rgba(255, 232, 177, 0.9))
    drop-shadow(0 0 1.2px rgba(238, 190, 109, 0.6))
    drop-shadow(0 0 9px rgba(255, 219, 153, 0.2));
  height: auto;
  width: 100%;
  max-width: 100%;
  object-fit: contain;
  /*
   * В исходном PNG подпись занимает центральную часть холста. Лёгкое
   * горизонтальное растяжение делает её такой же широкой, как росчерк в
   * утверждённом образце, и не даёт ей потеряться на большом бланке.
   */
  transform: scaleX(1.6) scaleY(0.82);
  transform-origin: center;
}
.certificate-hatch {
  background-image: repeating-linear-gradient(
    118deg,
    rgba(255, 255, 255, 0.018) 0 1px,
    transparent 1px 9px
  );
  -webkit-mask-image: radial-gradient(
    ellipse at 50% 44%,
    black 0%,
    transparent 78%
  );
  mask-image: radial-gradient(ellipse at 50% 44%, black 0%, transparent 78%);
}
.certificate-grid {
  background-image:
    linear-gradient(rgba(247, 232, 197, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(247, 232, 197, 0.045) 1px, transparent 1px);
  background-size: 3.8cqw 3.8cqw;
  -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 76%);
  mask-image: radial-gradient(ellipse at center, black 0%, transparent 76%);
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
.certificate-footer-rule {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(216, 180, 111, 0.22) 7%,
    rgba(242, 220, 170, 0.56) 50%,
    rgba(216, 180, 111, 0.22) 93%,
    transparent
  );
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

/** Угол двойной рамки: вложенные золотые линии и маленький ромб, как на бланке. */
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
        d="M3 54V3h51"
        stroke="#d8b46f"
        strokeLinecap="square"
        strokeWidth="1.05"
      />
      <path
        d="M10 45V10h35"
        stroke="#d8b46f"
        strokeOpacity="0.55"
        strokeWidth="0.6"
      />
      <path
        d="M18 38V18h20"
        stroke="#f2dcaa"
        strokeOpacity="0.38"
        strokeWidth="0.55"
      />
      <path
        d="M3 65h11M65 3v11M10 76h6M76 10v6"
        stroke="#f2dcaa"
        strokeLinecap="round"
        strokeOpacity="0.5"
        strokeWidth="0.7"
      />
      <path
        d="M18 18h9M27 18v9"
        stroke="#d8b46f"
        strokeLinecap="round"
        strokeOpacity="0.72"
        strokeWidth="0.65"
      />
      <rect
        height="8.5"
        stroke="#e8c98f"
        strokeOpacity="0.82"
        strokeWidth="0.6"
        transform="rotate(45 18 18)"
        width="8.5"
        x="13.75"
        y="13.75"
      />
      <circle cx="18" cy="18" fill="#f2dcaa" r="1.1" />
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
    <div className="flex min-w-0 items-center gap-[0.85cqw]">
      <svg
        aria-hidden="true"
        className="h-[4.7cqw] w-[4.7cqw] shrink-0"
        fill="none"
        focusable="false"
        viewBox="0 0 80 80"
      >
        <defs>
          <linearGradient id="certificate-brand-gold" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#fff4d3" />
            <stop offset="0.45" stopColor="#e4c17e" />
            <stop offset="1" stopColor="#a97635" />
          </linearGradient>
          <radialGradient id="certificate-brand-blue">
            <stop offset="0" stopColor="#d6ebff" />
            <stop offset="0.3" stopColor="#70b4ff" />
            <stop offset="1" stopColor="#1c69d4" stopOpacity="0" />
          </radialGradient>
        </defs>

        <path
          d="M40 2.5 76.5 22v36L40 77.5 3.5 58V22L40 2.5Z"
          stroke="#f5e7c9"
          strokeOpacity="0.2"
          strokeWidth="0.7"
        />
        <path
          d="M40 8 71.5 25.5v29L40 72 8.5 54.5v-29L40 8Z"
          stroke="url(#certificate-brand-gold)"
          strokeOpacity="0.42"
          strokeWidth="0.8"
        />

        <path
          d="M40 14 61.5 26.5 40 39 18.5 26.5 40 14Z"
          fill="url(#certificate-brand-gold)"
          fillOpacity="0.13"
          stroke="url(#certificate-brand-gold)"
          strokeLinejoin="round"
          strokeWidth="0.85"
        />
        <path
          d="M18.5 26.5 40 39v25L18.5 51.5v-25Z"
          fill="#071a33"
          fillOpacity="0.65"
          stroke="url(#certificate-brand-gold)"
          strokeLinejoin="round"
          strokeWidth="0.85"
        />
        <path
          d="M61.5 26.5 40 39v25l21.5-12.5v-25Z"
          fill="#2f7bff"
          fillOpacity="0.11"
          stroke="url(#certificate-brand-gold)"
          strokeLinejoin="round"
          strokeWidth="0.85"
        />

        <path
          d="M40 39v25M18.5 26.5l21.5 12.5 21.5-12.5M29.3 32.8l21.4 12.4M50.7 32.8 29.3 45.2"
          stroke="#f5e7c9"
          strokeOpacity="0.4"
          strokeWidth="0.55"
        />
        <path
          d="M25 35.5v11M33 39.5v9M47 39.5v9M55 35.5v11"
          stroke="#f5e7c9"
          strokeOpacity="0.24"
          strokeWidth="0.5"
        />

        <circle cx="31" cy="47" fill="url(#certificate-brand-blue)" r="8.5" />
        <ellipse
          cx="31"
          cy="47"
          fill="#7fbfff"
          fillOpacity="0.88"
          rx="3.2"
          ry="2.2"
        />
        <circle cx="31" cy="47" fill="#e9f6ff" r="1.35" />

        <path
          d="M40 2.5v5.5M3.5 22l5 2.9M76.5 22l-5 2.9"
          stroke="#f2dcaa"
          strokeOpacity="0.55"
          strokeWidth="0.65"
        />
      </svg>

      <span className="min-w-0 truncate text-[1.72cqw] leading-none font-extrabold tracking-tight whitespace-nowrap">
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
        className="certificate-hatch pointer-events-none absolute inset-0 opacity-70"
      />
      <div
        aria-hidden="true"
        className="certificate-grid pointer-events-none absolute inset-0 opacity-60"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(48,105,190,0.28),transparent_54%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_104%,rgba(18,53,108,0.26),transparent_58%)]"
      />

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-[27%] -left-[2%] h-[39%] w-[26%] opacity-[0.18]"
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
          <path d="M58 66h184v192H58z" opacity="0.42" />
          <path d="M70 78h160v168H70z" opacity="0.2" />
          <path d="M70 110h160M70 238h160" opacity="0.28" />
          <path d="M84 78v160M216 78v160" opacity="0.18" />
          <path d="M70 170h160" opacity="0.44" />
          <path d="M110 158h62v20h-62z" opacity="0.64" />
          <path d="m131 178 8 25h-11l8-25" opacity="0.78" />
          <path d="M126 158v-30" opacity="0.5" />
          <path d="M118 128h18M165 158v-16h26" opacity="0.34" />
          <path d="M118 205h70l-12 8h-46z" opacity="0.38" />
          <path d="m143 224 30-17 30 17-30 17-30-17Z" opacity="0.56" />
          <path d="M143 224v22l30 17v-22M203 224v22l-30 17" opacity="0.44" />
          <path d="M173 241v22" opacity="0.36" />
          <path d="M58 270h184l-23 26H81z" opacity="0.3" />
          <path d="M80 284h140" opacity="0.22" />
        </g>
        <g
          stroke="#5b96ff"
          strokeLinecap="round"
          strokeOpacity="0.62"
          strokeWidth="0.85"
        >
          <path d="M152 139h31M152 147h20" />
          <path d="M84 220h34" />
          <path
            d="M228 206c22-18 28-44 15-65"
            strokeDasharray="2 6"
            opacity="0.54"
          />
        </g>
      </svg>

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-[34%] -right-[5%] h-[32%] w-[24%] opacity-[0.19]"
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
      viewBox="0 0 120 160"
    >
      <defs>
        <linearGradient id="certificate-laurel-gold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff0c5" />
          <stop offset="0.42" stopColor="#d9b26b" />
          <stop offset="1" stopColor="#9b6f31" />
        </linearGradient>
      </defs>
      <g
        fill="url(#certificate-laurel-gold)"
        fillOpacity="0.22"
        stroke="url(#certificate-laurel-gold)"
        strokeWidth="0.7"
      >
        <path
          d="M111 151C79 143 52 122 39 92C27 65 32 38 49 17"
          fill="none"
          strokeWidth="1"
        />
        <ellipse cx="105" cy="144" rx="4.6" ry="10.4" transform="rotate(34 105 144)" />
        <ellipse cx="95" cy="137" rx="4.5" ry="10.1" transform="rotate(48 95 137)" />
        <ellipse cx="84" cy="128" rx="4.4" ry="9.8" transform="rotate(53 84 128)" />
        <ellipse cx="73" cy="118" rx="4.3" ry="9.5" transform="rotate(46 73 118)" />
        <ellipse cx="63" cy="107" rx="4.2" ry="9.2" transform="rotate(35 63 107)" />
        <ellipse cx="55" cy="95" rx="4.1" ry="8.9" transform="rotate(24 55 95)" />
        <ellipse cx="49" cy="82" rx="3.9" ry="8.6" transform="rotate(13 49 82)" />
        <ellipse cx="46" cy="69" rx="3.8" ry="8.3" transform="rotate(3 46 69)" />
        <ellipse cx="46" cy="56" rx="3.7" ry="8" transform="rotate(-8 46 56)" />
        <ellipse cx="49" cy="43" rx="3.6" ry="7.7" transform="rotate(-19 49 43)" />
        <ellipse cx="54" cy="31" rx="3.5" ry="7.4" transform="rotate(-31 54 31)" />
        <ellipse cx="93" cy="150" rx="3.3" ry="7.8" transform="rotate(62 93 150)" />
        <ellipse cx="80" cy="143" rx="3.2" ry="7.5" transform="rotate(57 80 143)" />
        <ellipse cx="68" cy="134" rx="3.1" ry="7.2" transform="rotate(47 68 134)" />
        <ellipse cx="58" cy="123" rx="3" ry="6.9" transform="rotate(36 58 123)" />
        <ellipse cx="51" cy="111" rx="2.9" ry="6.6" transform="rotate(24 51 111)" />
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
    <div className={`aspect-[300/150] ${className}`}>
      <LaurelBranch className="absolute top-[1%] left-[4%] h-[96%] w-[34%]" />
      <LaurelBranch className="absolute top-[1%] right-[4%] h-[96%] w-[34%] -scale-x-100" />

      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        fill="none"
        focusable="false"
        viewBox="0 0 300 150"
      >
        <defs>
          <linearGradient
            id="certificate-emblem-gold"
            x1="0"
            x2="1"
            y1="0"
            y2="1"
          >
            <stop offset="0" stopColor="#fff5d8" />
            <stop offset="0.28" stopColor="#efd39b" />
            <stop offset="0.56" stopColor="#c4934b" />
            <stop offset="0.78" stopColor="#8e612a" />
            <stop offset="1" stopColor="#f5dfae" />
          </linearGradient>
          <radialGradient id="certificate-emblem-glow">
            <stop offset="0" stopColor="#4d8cff" stopOpacity="0.34" />
            <stop offset="1" stopColor="#4d8cff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse
          cx="150"
          cy="78"
          fill="url(#certificate-emblem-glow)"
          rx="58"
          ry="45"
        />

        {/* Кубок над кубом */}
        <g stroke="url(#certificate-emblem-gold)" strokeLinecap="round">
          <path
            d="M137 9h26v9c0 8-5 13-13 13s-13-5-13-13V9Z"
            fill="url(#certificate-emblem-gold)"
            fillOpacity="0.22"
            strokeLinejoin="round"
            strokeWidth="1"
          />
          <path
            d="M136 12h-6c-3 0-4 3-2 5 2 3 5 4 8 4M164 12h6c3 0 4 3 2 5-2 3-5 4-8 4"
            strokeWidth="0.85"
          />
          <path d="M150 31v7M144 39h12M141 43h18" strokeWidth="0.9" />
        </g>

        {/* Куб */}
        <path
          d="M150 44 187 65 150 86 113 65 150 44Z"
          fill="url(#certificate-emblem-gold)"
          fillOpacity="0.23"
          stroke="url(#certificate-emblem-gold)"
          strokeLinejoin="round"
          strokeWidth="1.15"
        />
        <path
          d="M113 65 150 86v36l-37-21V65Z"
          fill="url(#certificate-emblem-gold)"
          fillOpacity="0.11"
          stroke="url(#certificate-emblem-gold)"
          strokeLinejoin="round"
          strokeWidth="1.15"
        />
        <path
          d="M187 65 150 86v36l37-21V65Z"
          fill="#4d8cff"
          fillOpacity="0.08"
          stroke="url(#certificate-emblem-gold)"
          strokeLinejoin="round"
          strokeWidth="1.15"
        />
        <path
          d="M150 86v36M150 53 170 65 150 77 130 65 150 53ZM130 65h40M150 53v24"
          stroke="url(#certificate-emblem-gold)"
          strokeLinecap="round"
          strokeOpacity="0.62"
          strokeWidth="0.8"
        />
        <path
          d="M125 70v15M136 76v14M164 76v14M175 70v15"
          stroke="#f5dfae"
          strokeOpacity="0.22"
          strokeWidth="0.55"
        />
        <circle
          cx="150"
          cy="65"
          fill="#4d8cff"
          fillOpacity="0.34"
          r="5.7"
        />
        <circle
          cx="150"
          cy="65"
          fill="none"
          r="9"
          stroke="#6da3ff"
          strokeOpacity="0.26"
          strokeWidth="0.7"
        />

        {/* Постамент */}
        <path
          d="M122 119h56l-7 10h-42z"
          fill="url(#certificate-emblem-gold)"
          fillOpacity="0.26"
          stroke="url(#certificate-emblem-gold)"
          strokeWidth="0.85"
        />
        <path
          d="M113 129h74M105 136h90M98 143h104"
          stroke="url(#certificate-emblem-gold)"
          strokeLinecap="round"
          strokeOpacity="0.78"
          strokeWidth="0.9"
        />
        <ellipse
          cx="150"
          cy="116"
          fill="url(#certificate-emblem-gold)"
          fillOpacity="0.14"
          rx="38"
          ry="6"
          stroke="url(#certificate-emblem-gold)"
          strokeOpacity="0.5"
          strokeWidth="0.75"
        />
      </svg>
    </div>
  );
}

/**
 * Волнистый край печати: круг с синусоидальным радиусом.
 *
 * Путь строится детерминированно на сервере и попадает в HTML как обычный SVG.
 * Так печать остаётся векторной в PDF, не тянет картинку и выглядит как
 * штампованный зубчатый медальон из утверждённого макета.
 */
function scallopedCirclePath(
  cx: number,
  cy: number,
  radius: number,
  lobes: number,
  depth: number,
): string {
  const steps = 180;
  const points: string[] = [];

  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;
    const currentRadius = radius + depth * Math.sin(angle * lobes);

    points.push(
      `${(cx + Math.cos(angle) * currentRadius).toFixed(2)} ${(
        cy +
        Math.sin(angle) * currentRadius
      ).toFixed(2)}`,
    );
  }

  return `M${points.join("L")}Z`;
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
      viewBox="0 0 140 160"
    >
      <defs>
        <linearGradient id="certificate-seal-gold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff6da" />
          <stop offset="0.32" stopColor="#e3c17d" />
          <stop offset="0.68" stopColor="#a97632" />
          <stop offset="1" stopColor="#f3d99e" />
        </linearGradient>
        <linearGradient id="certificate-seal-ribbon" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#2f6fc2" />
          <stop offset="0.55" stopColor="#123f83" />
          <stop offset="1" stopColor="#071f43" />
        </linearGradient>
        <path d="M32 55a38 38 0 0 1 76 0" id="certificate-seal-arc" />
      </defs>

      <path
        d="M56 101 42 158l16-9 12 9 9-52Z"
        fill="url(#certificate-seal-ribbon)"
        stroke="url(#certificate-seal-gold)"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <path
        d="M84 101 98 158l-16-9-12 9-9-52Z"
        fill="url(#certificate-seal-ribbon)"
        stroke="url(#certificate-seal-gold)"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <path
        d="m52 113 20 8M88 113l-20 8"
        stroke="#f3d99e"
        strokeOpacity="0.32"
        strokeWidth="0.55"
      />

      <path
        d={scallopedCirclePath(70, 55, 52, 20, 2.2)}
        fill="#071426"
        stroke="url(#certificate-seal-gold)"
        strokeWidth="1.5"
      />
      <circle
        cx="70"
        cy="55"
        r="45"
        stroke="#d8b46f"
        strokeDasharray="1.7 2.8"
        strokeOpacity="0.58"
        strokeWidth="0.7"
      />
      <circle
        cx="70"
        cy="55"
        r="36"
        stroke="url(#certificate-seal-gold)"
        strokeOpacity="0.72"
        strokeWidth="0.85"
      />
      <circle
        cx="70"
        cy="55"
        r="31"
        stroke="#d8b46f"
        strokeOpacity="0.28"
        strokeWidth="0.55"
      />

      <text
        fill="#f5dca4"
        fillOpacity="0.95"
        fontSize="6.2"
        fontWeight="700"
        letterSpacing="1.5"
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
        d="m70 39 3.15 6.38 7.04 1.03-5.1 4.97 1.21 7.01L70 55l-6.3 3.39 1.21-7.01-5.1-4.97 7.04-1.03L70 39Z"
        fill="#f5dca4"
        fillOpacity="0.96"
      />

      <text
        fill="#f0d49a"
        fillOpacity="0.84"
        fontSize="4.3"
        letterSpacing="1.05"
        textAnchor="middle"
        x="70"
        y="77"
      >
        EST. 2024
      </text>

      <g
        fill="#e6c17b"
        fillOpacity="0.32"
        stroke="#e6c17b"
        strokeOpacity="0.62"
        strokeWidth="0.5"
      >
        <ellipse cx="48" cy="82" rx="2.5" ry="5" transform="rotate(38 48 82)" />
        <ellipse cx="44" cy="74" rx="2.3" ry="4.6" transform="rotate(52 44 74)" />
        <ellipse cx="92" cy="82" rx="2.5" ry="5" transform="rotate(-38 92 82)" />
        <ellipse cx="96" cy="74" rx="2.3" ry="4.6" transform="rotate(-52 96 74)" />
      </g>
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
    return "text-[2.7cqw]";
  }
  if (length > 44) {
    return "text-[4.1cqw]";
  }
  if (length > 26) {
    return "text-[4.8cqw]";
  }
  if (length > 20) {
    return "text-[6.6cqw]";
  }
  return "text-[8cqw]";
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
  const program = getCertificateProgram(level, certificate.fullCourse);

  return (
    <>
      <style>{CERTIFICATE_STYLES}</style>
      <style>{CERTIFICATE_PRINT_STYLES}</style>

      <div className="certificate-frame mx-auto mt-8 w-full max-w-[1120px] overflow-hidden rounded-[2rem] shadow-[0_32px_110px_-28px_rgba(37,99,235,0.5)] print:mt-0 print:max-w-none print:rounded-none print:shadow-none">
        <article
          aria-label={`Сертификат TriDi: ${program.title}, ${certificate.name}`}
          className={`certificate-sheet ${certificateSerif.variable} relative aspect-[297/210] w-full overflow-hidden rounded-[2rem] bg-[#061428] text-slate-100 [container-type:inline-size] print:rounded-none`}
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 50% 3%, rgba(40,88,163,0.32), transparent 45%), radial-gradient(ellipse at 50% 38%, rgba(37,85,158,0.2), transparent 54%), radial-gradient(ellipse at 12% 98%, rgba(16,48,103,0.24), transparent 42%), linear-gradient(135deg, #071525 0%, #061326 48%, #081a30 100%)",
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

          <div className="relative flex h-full flex-col pl-[7.2%] pr-[5.2%] pt-[3.1%] pb-[2.8%]">
            <header className="relative z-10 flex h-[13%] shrink-0 items-center justify-between">
              <CertificateBrand />

              <CertificateEmblem className="absolute top-[0.9cqw] left-1/2 w-[15.6cqw] -translate-x-1/2" />

              <p className="mt-[3cqw] max-w-[24cqw] self-start text-right text-[0.92cqw] leading-relaxed font-semibold tracking-[0.22em] text-slate-300/90 uppercase">
                Онлайн-школа 3D-печати
              </p>
            </header>

            <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-start pt-[1.3cqw] pb-[0.8cqw] text-center">
              <div className="flex w-full items-center gap-[1.7cqw]">
                <span className="certificate-gold-rule h-px flex-1" />
                <h2 className="certificate-serif certificate-gold-text shrink-0 text-[5.35cqw] leading-none font-semibold tracking-[0.17em] uppercase [text-indent:0.17em]">
                  Сертификат
                </h2>
                <span className="certificate-gold-rule h-px flex-1" />
              </div>

              <span
                aria-hidden="true"
                className="mt-[0.6cqw] h-[0.62cqw] w-[0.62cqw] rotate-45 bg-[#f2dcaa]/90 shadow-[0_0_12px_rgba(242,220,170,0.45)]"
              />

              <p className="mt-[0.85cqw] text-[1cqw] tracking-[0.17em] text-slate-300/90 uppercase">
                Настоящим подтверждается, что
              </p>

              <p
                className={`certificate-serif certificate-name mt-[0.25cqw] max-w-[92%] leading-[1.02] font-semibold tracking-[0.005em] break-words ${nameSizeClass(certificate.name.trim().length)}`}
              >
                {certificate.name}
              </p>

              <div
                aria-hidden="true"
                className="mt-[0.7cqw] flex w-[32%] items-center gap-[1cqw]"
              >
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#d8b46f]/70" />
                <span className="h-[0.5cqw] w-[0.5cqw] rotate-45 bg-[#e8c98f]" />
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#d8b46f]/70" />
              </div>

              <p className="mt-[0.6cqw] text-[1.02cqw] tracking-[0.15em] text-slate-300">
                успешно завершил(а) обучение
              </p>

              <p
                className={`certificate-serif certificate-gold-text mt-[0.25cqw] inline-block max-w-[88%] leading-[1.12] font-semibold [transform:scaleX(1.18)] ${
                  certificate.fullCourse
                    ? "text-[2.45cqw]"
                    : "text-[3.2cqw]"
                }`}
              >
                {program.title}
              </p>

              <p className="mt-[0.65cqw] text-[1.02cqw] tracking-[0.075em] text-slate-400">
                Объём: {program.lessons}{" "}
                {pluralize(program.lessons, LESSON_FORMS)} / {program.hours}{" "}
                {pluralize(program.hours, ACADEMIC_HOUR_FORMS)}
              </p>
            </div>

            <footer className="relative z-10 h-[39%] shrink-0">
              <div
                aria-hidden="true"
                className="certificate-footer-rule absolute inset-x-0 top-0 h-px"
              />
              <span
                aria-hidden="true"
                className="absolute top-[-0.28cqw] left-1/2 h-[0.56cqw] w-[0.56cqw] -translate-x-1/2 rotate-45 bg-[#f2dcaa]/75 shadow-[0_0_10px_rgba(242,220,170,0.32)]"
              />

              <div className="absolute top-[57%] left-0">
                <p className="text-[0.82cqw] tracking-[0.18em] text-[#d8b46f]/95 uppercase">
                  Дата выдачи
                </p>
                <p className="certificate-serif mt-[0.45cqw] text-[1.95cqw] leading-tight font-semibold text-slate-100">
                  {formatCertificateDate(certificate.issuedAt)}
                </p>
              </div>

              <div className="absolute top-[10%] left-[26.8%] w-[16.5%]">
                <CertificateSeal className="h-auto w-full drop-shadow-[0_10px_16px_rgba(0,0,0,0.28)]" />
              </div>

              <div className="absolute top-[3.5%] left-[44.2%] w-[24%] text-center">
                <Image
                  alt=""
                  aria-hidden="true"
                  className="certificate-signature-image"
                  height={889}
                  sizes="(max-width: 768px) 34vw, 270px"
                  src="/signature.png"
                  width={1404}
                />
                <p className="certificate-serif -mt-[1.2cqw] text-[1.95cqw] leading-tight font-semibold tracking-[0.015em] text-slate-100">
                  Накоряков В.С.
                </p>
                <p className="certificate-serif mt-[0.25cqw] text-[0.98cqw] leading-[1.5] tracking-[0.12em] text-slate-400 uppercase">
                  Основатель школы 3D-печати
                  <span className="block normal-case tracking-[0.16em]">
                    tridi-print.ru
                  </span>
                </p>
              </div>

              <div className="absolute top-[21%] right-[1.5%] w-[11%]">
                <div className="rounded-[clamp(2px,0.35cqw,5px)] border border-[#d8b46f]/80 bg-white p-[clamp(2px,0.4cqw,5px)] shadow-[0_0_22px_rgba(216,180,111,0.2)]">
                  <CertificateQr className="w-full" value={verifyUrl} />
                </div>
                <p className="mt-[0.55cqw] text-[0.74cqw] tracking-[0.15em] text-[#d8b46f]/90 uppercase">
                  ID сертификата
                </p>
                <p className="mt-[0.1cqw] text-[0.8cqw] font-medium tracking-[0.04em] text-slate-200">
                  {certificate.number}
                </p>
                <p className="text-[0.55cqw] tracking-[0.18em] text-slate-500 uppercase">
                  {certificate.subject.slice(-2)}
                </p>
              </div>
            </footer>
          </div>
        </article>
      </div>
    </>
  );
}
