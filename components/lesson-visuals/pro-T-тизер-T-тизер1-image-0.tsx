import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Вид товара: от него зависит рисунок на витрине. */
type Kind = "keychains" | "organizer" | "parts" | "gifts" | "models" | "onDemand";

type Product = {
  kind: Kind;
  /** Строки на ценнике — слова из списка «Что продавать» того же урока. */
  caption: string[];
};

/**
 * Шесть позиций витрины: порядок совпадает со списком «Что продавать» из урока.
 * Цены нет ни у одной позиции: урок называет товары, а не числа, и в кадре стоит
 * только знак рубля.
 */
const PRODUCTS: Product[] = [
  { kind: "keychains", caption: ["брелоки"] },
  { kind: "organizer", caption: ["органайзеры"] },
  { kind: "parts", caption: ["запчасти,", "крепления"] },
  { kind: "gifts", caption: ["подарки,", "персонализация"] },
  { kind: "models", caption: ["STL-файлы", "и модели"] },
  { kind: "onDemand", caption: ["печать", "на заказ"] },
];

/** Витрина: три колонки, ширина одной позиции и её левый край. */
const CELL_W = 92;
const COLUMNS = [10, 114, 218];

/** Верх полок: на нём стоят товары, ниже — лицевая кромка с ценниками. */
const SHELF_TOPS = [68, 131];

/** Высота лицевой кромки полки и ценника на ней. */
const EDGE_H = 28;
const PLATE_H = 24;

/** Полоса с девизом под витриной. */
const SLOGAN_TOP = 159;
const SLOGAN_H = 18;

/** Рисунок товара: полоса 34×48 над полкой, по центру позиции. */
const ART_H = 34;
const ART_W = 48;
const ART_LEFT = (CELL_W - ART_W) / 2;

/** Подложка знака рубля внутри ценника. */
const CHIP_W = 13;
const CHIP_H = 12;

/**
 * Строки подписи на ценнике: одна строка стоит по центру, две — по обе стороны от
 * центра. Шаг 12 px: при кегле 7,5 px просвет между строками 4,5 px, подписи не
 * сливаются ни на экране, ни в замере живой вёрстки.
 */
function captionBaselines(plateTop: number, count: number): number[] {
  return count === 1 ? [plateTop + 14.5] : [plateTop + 7.5, plateTop + 19.5];
}

/**
 * Товар в локальных координатах 48×34, начало — левый верхний угол полосы.
 * Светлые детали держатся в верхних 28 px: под рисунком ценник, и подписи не
 * должны липнуть к деталям кадра.
 */
function Art({ kind }: { kind: Kind }) {
  if (kind === "keychains") {
    return (
      <g>
        <rect x="4" y="30" width="40" height="4" rx="1" fill="#334155" />
        <rect x="6" y="6" width="36" height="2.6" fill="#94a3b8" />
        {[8, 21, 34].map((x) => (
          <g key={`keychain-${x}`}>
            <line x1={x + 4} y1="8.6" x2={x + 4} y2="10.4" stroke="#94a3b8" />
            <circle cx={x + 4} cy="12.4" r="2.2" fill="none" stroke="#94a3b8" />
            <rect x={x} y="14.8" width="8.6" height="12.4" rx="2" fill="#475569" stroke="#94a3b8" />
            <circle cx={x + 4.3} cy="17.6" r="1.3" fill="#1e293b" />
          </g>
        ))}
      </g>
    );
  }

  if (kind === "organizer") {
    return (
      <g>
        <rect x="3" y="30" width="42" height="4" rx="1" fill="#334155" />
        <rect x="5" y="6" width="38" height="3.4" rx="1.7" fill="#64748b" />
        <rect x="6" y="9" width="36" height="21" rx="2" fill="#475569" stroke="#94a3b8" />
        <line x1="24" y1="11.5" x2="24" y2="27.5" stroke="#94a3b8" />
        <line x1="8" y1="19.5" x2="40" y2="19.5" stroke="#94a3b8" />
      </g>
    );
  }

  if (kind === "parts") {
    return (
      <g>
        <rect x="2" y="30" width="44" height="4" rx="1" fill="#334155" />
        <polygon points="7,7 14,7 14,22 25,22 25,29 7,29" fill="#475569" stroke="#94a3b8" />
        <circle cx="10.5" cy="11.5" r="1.7" fill="#1e293b" />
        <circle cx="10.5" cy="18.5" r="1.7" fill="#1e293b" />
        <circle cx="20.5" cy="26" r="1.7" fill="#1e293b" />
        <path d="M36,10 A6,6 0 1 0 36,22" fill="none" stroke="#38bdf8" strokeWidth="1.6" />
      </g>
    );
  }

  if (kind === "gifts") {
    return (
      <g>
        <rect x="2" y="30" width="44" height="4" rx="1" fill="#334155" />
        <rect x="5" y="13" width="38" height="15" rx="3" fill="#475569" stroke="#94a3b8" />
        <text x="24" y="25" fontSize="7.5" textAnchor="middle" fill="#fdba74">
          имя
        </text>
        <polygon points="24,9 16.5,3.5 16.5,10.5" fill="#fdba74" />
        <polygon points="24,9 31.5,3.5 31.5,10.5" fill="#fdba74" />
        <circle cx="24" cy="8.4" r="2.1" fill="#fdba74" />
      </g>
    );
  }

  if (kind === "models") {
    return (
      <g>
        <rect x="2" y="30" width="44" height="4" rx="1" fill="#334155" />
        <rect x="8" y="4" width="32" height="21" rx="2" fill="#475569" stroke="#94a3b8" />
        <rect x="10.5" y="6.5" width="27" height="16" rx="1.5" fill="#0f172a" />
        <polygon points="15,9 22,9 26,13 26,20 15,20" fill="#1e293b" stroke="#cbd5e1" strokeWidth="0.8" />
        <polygon points="22,9 26,13 22,13" fill="#94a3b8" />
        <line x1="17.5" y1="15.6" x2="23.5" y2="15.6" stroke="#cbd5e1" strokeWidth="0.7" />
        <line x1="17.5" y1="18" x2="22" y2="18" stroke="#cbd5e1" strokeWidth="0.7" />
        <rect x="20" y="25" width="8" height="3" rx="1" fill="#64748b" />
        <line x1="34" y1="9" x2="34" y2="18" stroke="#6ee7b7" strokeWidth="1.4" />
        <polygon points="31.5,16.5 36.5,16.5 34,20.5" fill="#6ee7b7" />
      </g>
    );
  }

  return (
    <g>
      <rect x="2" y="30" width="44" height="4" rx="1" fill="#334155" />
      <polygon points="6,11 12,5 42,5 36,11" fill="#64748b" />
      <polygon points="36,11 42,5 42,26 36,30" fill="#334155" />
      <rect x="6" y="11" width="30" height="19" fill="#475569" stroke="#94a3b8" />
      <rect x="17" y="11" width="6" height="16" fill="#94a3b8" />
      <rect x="25" y="13" width="9" height="7" rx="1" fill="#e2e8f0" />
      {[26.5, 28.5, 30.5, 32.2].map((x) => (
        <line key={`barcode-${x}`} x1={x} y1="15" x2={x} y2="19" stroke="#1e293b" strokeWidth="0.7" />
      ))}
    </g>
  );
}

/**
 * Полка витрины: рисунок товара стоит на верхней линии, на лицевой кромке под ним
 * лежит ценник — подложка с подписью и знаком рубля. Ценник есть у каждой позиции,
 * поэтому полка читается как витрина, а не как ряд одинаковых деталей.
 */
function Shelf({ products, shelfTop }: { products: Product[]; shelfTop: number }) {
  const plateTop = shelfTop + 2;

  return (
    <g>
      <rect x="8" y={shelfTop} width="304" height={EDGE_H} fill="#334155" />
      {products.map((product, index) => {
        const x = COLUMNS[index];
        const baselines = captionBaselines(plateTop, product.caption.length);

        return (
          <g key={product.kind}>
            <g transform={`translate(${x + ART_LEFT} ${shelfTop - ART_H})`}>
              <Art kind={product.kind} />
            </g>
            <rect x={x + 2} y={plateTop} width={CELL_W - 4} height={PLATE_H} rx="3" fill="#475569" />
            <rect x={x + 6} y={plateTop + 6} width={CHIP_W} height={CHIP_H} rx="2" fill="#334155" />
            <text x={x + 8.5} y={plateTop + 15.15} fontSize="9" fill="#fdba74">
              ₽
            </text>
            {product.caption.map((line, lineIndex) => (
              <text
                key={`${product.kind}-${line}`}
                x={x + 25}
                y={baselines[lineIndex]}
                fontSize="7.5"
                fill="#e2e8f0"
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
}

/**
 * Витрина: «ты уже умеешь — это можно продавать».
 *
 * Две полки, на каждой по три позиции из списка «Что продавать» того же урока:
 * брелоки на подставке, органайзер с ячейками, запчасти и крепления (уголок с
 * отверстиями и клипса), подарки с персонализацией (табличка с именем и бантом),
 * STL-файлы и модели (экран с файлом и стрелкой скачивания) и печать на заказ
 * (коробка со скотчем и этикеткой заказа). Под каждой позицией свой ценник с
 * подписью и знаком рубля, внизу девиз урока: шесть ниш — шесть разных путей.
 *
 * От соседей кадр отличается предметом: это витрина товаров, а не техника.
 * J-J2-image-1 — четыре детали с рёбрами, J-J5 — кронштейн под нагрузкой,
 * I-I2-image-0 — четыре заполнения, U-U2-image-0 — коробки программ на прилавке,
 * U-U1-image-0 — бирки лицензий с перечёркнутым ценником, M-M3-image-0 — три
 * сушилки на общей полке, L-L2-image-0 — модели на столе мастера. Знака рубля и
 * ценников с названиями товаров до этого кадра в проекте не было.
 */
export function ProTTizerTTizer1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Витрина с шестью товарами и ценниками: брелоки на подставке, органайзер с ячейками, запчасти и крепления — уголок с отверстиями и клипса, подарки с персонализацией — табличка с именем и бантом, STL-файлы и модели — экран с файлом и стрелкой скачивания, печать на заказ — коробка со скотчем и этикеткой заказа; у каждой позиции свой ценник со знаком рубля, внизу подпись: шесть ниш — шесть разных путей"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          витрина: шесть товаров с ценником
        </text>
        <text x="12" y="27" fontSize="8" fill="#94a3b8">
          каждую позицию ты уже умеешь напечатать
        </text>

        <rect x="8" y="31" width="304" height="128" rx="8" fill="#0f172a" stroke="#475569" />

        {SHELF_TOPS.map((shelfTop, rowIndex) => (
          <Shelf key={`shelf-${shelfTop}`} products={PRODUCTS.slice(rowIndex * 3, rowIndex * 3 + 3)} shelfTop={shelfTop} />
        ))}

        <rect x="8" y={SLOGAN_TOP} width="304" height={SLOGAN_H} rx="8" fill="#1e293b" />
        <text x="160" y="170" fontSize="9" textAnchor="middle" fill="#e2e8f0">
          6 ниш = 6 разных путей
        </text>
      </svg>
    </VisualWrapper>
  );
}
