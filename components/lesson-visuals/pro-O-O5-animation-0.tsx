import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Слагаемое себестоимости: чип, подпись и класс появления. */
type Term = { label: string; color: string; className: string };

const TERM_TOPS = [54, 78, 102, 126];
const CHIP_X = 20;
const CHIP_W = 26;
const CHIP_H = 14;
const LABEL_X = 52;

/** Четыре слагаемых — ровно формула из content блока «Экономика» этого урока. */
const TERMS: Term[] = [
  { label: "пластик", color: "#38bdf8", className: "v-oo5a-t1" },
  { label: "электричество", color: "#34d399", className: "v-oo5a-t2" },
  { label: "амортизация", color: "#fbbf24", className: "v-oo5a-t3" },
  { label: "брак", color: "#f87171", className: "v-oo5a-t4" },
];

/** Уровень цены: себестоимость и две её копии — два и три раза. */
type Coin = { label: string; y: number; dashed: boolean; className: string };

const COIN_X = 140;
const COIN_W = 140;
const COIN_H = 26;
const COIN_CENTER = COIN_X + COIN_W / 2;

/** Верхний уровень пунктирный: в уроке продажа названа коридором «×2–×3». */
const COINS: Coin[] = [
  { label: "продажа ×3", y: 54, dashed: true, className: "v-oo5a-c3" },
  { label: "продажа ×2", y: 84, dashed: false, className: "v-oo5a-c2" },
  { label: "себестоимость", y: 114, dashed: false, className: "v-oo5a-c1" },
];

/**
 * «Экономика» — четыре слагаемых съезжаются в себестоимость, а над ней встают два
 * уровня продажи: ×2 и ×3. Чипы появляются по одному (пластик, электричество,
 * амортизация, брак), за ними знак равенства и нижний брусок «себестоимость»,
 * верхние два — «продажа ×2» и пунктирный «продажа ×3».
 *
 * Ровно по content блока: «Пластик + электричество + амортизация + брак =
 * себестоимость. Продажа ×2–×3». Цифр в кадре нет намеренно: в animation-блоке их
 * нет, а числа из text про ферму (1500 ₽/кг, 5 ₽/час, маржа 70–85 %) относятся к
 * другому уроку. Амортизация и брак названы так, как их называет урок: без
 * поясняющих «за час» и «процента» — этих уточнений в блоке нет.
 *
 * От M-M2-image-0 и U-U3-image-0 (сравнение полосами) отличается тем, что бруски
 * не сравнивают длину: их три одинаковых, и смысл в подписях ×1, ×2, ×3. От
 * O2-animation (полоса времени), O3-animation (отрез и башня) и O4-animation
 * (очередь заказов) — предметом: тут только сумма и цена. От O5-image-0 — тем,
 * что воронка шагов осталась в image-блоке, а здесь считается деталь.
 *
 * Классы с префиксом v-oo5a: <style> внутри SVG действует на всю страницу.
 */
export function ProOO5Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация экономики детали: четыре слагаемых появляются по одному — пластик, электричество, амортизация и брак, — складываются в себестоимость, а над ней встают ещё два таких же уровня: продажа вдвое и пунктирный уровень продажи втрое. Подпись: цена равна себестоимости, умноженной на два или на три. Внизу напоминание не покупать б/у принтер без проверки — износ ремней, люфты, засоры."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-oo5a-t1 { animation: v-oo5a-t1 8s linear infinite; }
          .v-oo5a-t2 { animation: v-oo5a-t2 8s linear infinite; }
          .v-oo5a-t3 { animation: v-oo5a-t3 8s linear infinite; }
          .v-oo5a-t4 { animation: v-oo5a-t4 8s linear infinite; }
          .v-oo5a-eq { animation: v-oo5a-eq 8s linear infinite; }
          .v-oo5a-c1 { animation: v-oo5a-c1 8s linear infinite; }
          .v-oo5a-c2 { animation: v-oo5a-c2 8s linear infinite; }
          .v-oo5a-c3 { animation: v-oo5a-c3 8s linear infinite; }
          .v-oo5a-note { animation: v-oo5a-note 8s linear infinite; }
          @keyframes v-oo5a-t1 {
            0%, 4% { opacity: 0; transform: translateX(-8px); }
            12%, 100% { opacity: 1; transform: translateX(0); }
          }
          @keyframes v-oo5a-t2 {
            0%, 12% { opacity: 0; transform: translateX(-8px); }
            20%, 100% { opacity: 1; transform: translateX(0); }
          }
          @keyframes v-oo5a-t3 {
            0%, 20% { opacity: 0; transform: translateX(-8px); }
            28%, 100% { opacity: 1; transform: translateX(0); }
          }
          @keyframes v-oo5a-t4 {
            0%, 28% { opacity: 0; transform: translateX(-8px); }
            36%, 100% { opacity: 1; transform: translateX(0); }
          }
          @keyframes v-oo5a-eq {
            0%, 38% { opacity: 0; }
            46%, 100% { opacity: 1; }
          }
          @keyframes v-oo5a-c1 {
            0%, 46% { opacity: 0; transform: translateY(6px); }
            54%, 100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes v-oo5a-c2 {
            0%, 58% { opacity: 0; transform: translateY(6px); }
            66%, 100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes v-oo5a-c3 {
            0%, 70% { opacity: 0; transform: translateY(6px); }
            78%, 100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes v-oo5a-note {
            0%, 78% { opacity: 0; }
            86%, 100% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-oo5a-t1, .v-oo5a-t2, .v-oo5a-t3, .v-oo5a-t4 { animation: none; opacity: 1; transform: translateX(0); }
            .v-oo5a-eq, .v-oo5a-note { animation: none; opacity: 1; }
            .v-oo5a-c1, .v-oo5a-c2, .v-oo5a-c3 { animation: none; opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          себестоимость из четырёх слагаемых, продажа ×2–×3
        </text>

        <text x="12" y="38" fontSize="8.5" fontWeight="bold" fill="#38bdf8">
          слагаемые себестоимости
        </text>
        <text x="140" y="38" fontSize="8.5" fontWeight="bold" fill="#38bdf8">
          продажа: ×2–×3
        </text>

        {/* Слагаемые: чипы появляются по одному, между ними плюсы суммы */}
        {TERMS.map((term, index) => (
          <g key={term.label} className={term.className}>
            {index > 0 ? (
              <text
                x="33"
                y={TERM_TOPS[index] - 2}
                fontSize="7.5"
                fill="#64748b"
                textAnchor="middle"
              >
                +
              </text>
            ) : null}
            <rect
              x={CHIP_X}
              y={TERM_TOPS[index]}
              width={CHIP_W}
              height={CHIP_H}
              rx="2"
              fill={term.color}
              fillOpacity="0.35"
              stroke={term.color}
            />
            <text x={LABEL_X} y={TERM_TOPS[index] + 11} fontSize="7.5" fill="#e2e8f0">
              {term.label}
            </text>
          </g>
        ))}

        {/* Итог суммы: знак равенства по центру четырех чипов */}
        <text x="120" y="101" fontSize="11" fontWeight="bold" fill="#94a3b8" className="v-oo5a-eq">
          =
        </text>

        {/* Уровни цены: себестоимость и две её копии, верхняя — пунктиром */}
        {COINS.map((coin) => (
          <g key={coin.label} className={coin.className}>
            <rect
              x={COIN_X}
              y={coin.y}
              width={COIN_W}
              height={COIN_H}
              rx="3"
              fill="#38bdf8"
              fillOpacity={coin.dashed ? 0 : 0.18}
              stroke={coin.dashed ? "#fbbf24" : "#38bdf8"}
              strokeDasharray={coin.dashed ? "4 3" : undefined}
            />
            <text
              x={COIN_CENTER}
              y={coin.y + 16}
              fontSize="7.5"
              fill="#e2e8f0"
              textAnchor="middle"
            >
              {coin.label}
            </text>
          </g>
        ))}

        <text x="140" y="152" fontSize="7.5" fill="#94a3b8" className="v-oo5a-note">
          цена = себестоимость ×2–×3
        </text>
        <text x="12" y="170" fontSize="7.5" fill="#94a3b8">
          не покупай б/у без проверки: износ ремней, люфты, засоры
        </text>
      </svg>
    </VisualWrapper>
  );
}


