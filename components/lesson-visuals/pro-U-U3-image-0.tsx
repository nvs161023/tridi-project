import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

type Platform = {
  name: string;
  /** Буква вместо логотипа: настоящие логотипы платформ не рисуем. */
  letter: string;
  /** Посещения в месяц, млн — из блока «Сайты» того же урока. */
  visits: number;
  /** Особенность сайта — словами урока. */
  note: string;
  /** Свой цвет платформы: у каждой строки он свой, шкалы «уровня» здесь нет. */
  accent: string;
};

/**
 * Пять платформ из блока «Сайты»: MakerWorld 15,8 млн, Thingiverse 14,8 млн,
 * Printables 13,8 млн, Cults3D 12,3 млн, CGTrader 4,6 млн посещений в месяц.
 * Числа взяты из урока как есть — это единственная диаграмма в курсе, где длина
 * полосы считается из настоящего числа, а не из «минимум/средне/много».
 */
const PLATFORMS: Platform[] = [
  {
    name: "MakerWorld",
    letter: "M",
    visits: 15.8,
    note: "от Bambu, самая посещаемая",
    accent: "#34d399",
  },
  {
    name: "Thingiverse",
    letter: "T",
    visits: 14.8,
    note: "самый старый из всех",
    accent: "#38bdf8",
  },
  {
    name: "Printables",
    letter: "P",
    visits: 13.8,
    note: "современный",
    accent: "#f59e0b",
  },
  {
    name: "Cults3D",
    letter: "C",
    visits: 12.3,
    note: "дизайнерские модели",
    accent: "#a78bfa",
  },
  {
    name: "CGTrader",
    letter: "CG",
    visits: 4.6,
    note: "профессиональные",
    accent: "#f472b6",
  },
];

/** Самая посещаемая платформа — от неё считается полная длина полосы. */
const MAX_VISITS = 15.8;

/** Тёмная дорожка одинаковой длины у всех строк: по ней видно масштаб. */
const TRACK = { x: 42, width: 196, height: 8 };
/** Числа — одним столбцом за правым краем дорожки, а не за концом полосы. */
const VALUE_X = TRACK.x + TRACK.width + 3;

const ROW_TOP = 40;
const ROW_STEP = 27;

/** Кружок-медальон с буквой платформы: в нём же «логотип» строки. */
const MEDAL = { cx: 25, offsetY: 10, r: 9.5 };

/** Высота полосы — доля от самой посещаемой платформы. */
function barWidth(visits: number): number {
  return Math.round((visits / MAX_VISITS) * TRACK.width);
}

/** «15,8 млн» — в уроке числа пишутся через запятую. */
function visitsLabel(visits: number): string {
  return `${String(visits).replace(".", ",")} млн`;
}

/**
 * Центрирование подписи: ширина символа ≈ 0.55em — та же оценка, что и в проверке
 * читаемости, поэтому вылет строки виден сразу и на глаз, и в отчёте проверки.
 */
function centerX(cx: number, text: string, size: number): number {
  return Math.round((cx - (text.length * size * 0.55) / 2) * 10) / 10;
}

/**
 * Топ-5 платформ из блока «Сайты»: у каждой строки кружок с буквой вместо
 * логотипа, название, полоса посещений в месяц на общей тёмной дорожке, число
 * в столбце за правым краем дорожки и особенность сайта словами урока.
 *
 * Ровно по content урока: «Логотипы: MakerWorld, Thingiverse, Printables,
 * Cults3D, CGTrader. Под каждым — особенность», а числа и особенности — из списка
 * «Сайты». Про Thangs в кадре сказано словами подзаголовка: он не платформа, а
 * поиск по всем сайтам сразу.
 *
 * От диаграммы выбросов A-без1-image-0 отличается тем, что там столбцы про один
 * параметр у пяти пластиков, без дорожки и без числа: длина — уровень, подписи
 * слева от оси. Здесь полоса считается из настоящего числа посещений, лежит на
 * дорожке одного масштаба, числа выстроены в столбец у правого края дорожки,
 * а вместо названия слева — медальон-логотип и особенность под полосой. От
 * таблицы параметров N-N5-image-0 и таблицы лицензий U1-image-0 отличается тем,
 * что строк и ячеек нет: сравнение идёт длиной полос.
 */
export function ProUU3Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Топ-5 платформ и посещения в месяц: MakerWorld — 15,8 млн, от Bambu, самая посещаемая; Thingiverse — 14,8 млн, самый старый из всех; Printables — 13,8 млн, современный; Cults3D — 12,3 млн, дизайнерские модели; CGTrader — 4,6 млн, профессиональные. В подзаголовке: Thangs ищет по всем сайтам сразу"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect
          x="0.5"
          y="0.5"
          width="319"
          height="179"
          rx="12"
          fill="#1e293b"
          fillOpacity="0.5"
          stroke="#475569"
        />

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Где брать модели — топ-5 платформ
        </text>
        <text x="12" y="29" fontSize="7.5" fill="#94a3b8">
          полосы — посещения в месяц; Thangs ищет по всем сайтам
        </text>

        {PLATFORMS.map((platform, index) => {
          const top = ROW_TOP + index * ROW_STEP;
          const width = barWidth(platform.visits);
          const value = visitsLabel(platform.visits);

          return (
            <g key={platform.name}>
              {/* Медальон-«логотип» строки */}
              <circle
                cx={MEDAL.cx}
                cy={top + MEDAL.offsetY}
                r={MEDAL.r}
                fill="#0f172a"
                stroke={platform.accent}
                strokeWidth="1.1"
              />
              <text
                x={centerX(MEDAL.cx, platform.letter, 9)}
                y={top + MEDAL.offsetY + 3.2}
                fontSize="9"
                fill={platform.accent}
              >
                {platform.letter}
              </text>

              <text x={TRACK.x} y={top + 8} fontSize="7.5" fill="#e2e8f0">
                {platform.name}
              </text>

              {/* Дорожка одного масштаба и полоса-доля посещений */}
              <rect
                x={TRACK.x}
                y={top + 11}
                width={TRACK.width}
                height={TRACK.height}
                rx="2"
                fill="#334155"
                stroke="#475569"
                strokeWidth="0.7"
              />
              <rect
                x={TRACK.x}
                y={top + 11}
                width={width}
                height={TRACK.height}
                rx="2"
                fill={platform.accent}
              />
              <text x={VALUE_X} y={top + 17.6} fontSize="7.5" fill={platform.accent}>
                {value}
              </text>

              <text x={TRACK.x} y={top + 26} fontSize="7.5" fill="#94a3b8">
                {platform.note}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
