import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Система мультиматериала: имя, цвет, механизм и две строки — плюс и минус.
 * Плюс берём из list урока (числа блока «Системы»), минус — из блока «Что нужно
 * знать» и warning: отдельных минусов конкретной системы урок не называет.
 */
type System = {
  name: string;
  color: string;
  /** Что рисуем в квадранте: у каждой системы свой механизм подачи нити. */
  art: "selector" | "box" | "twin" | "rack";
  /** Плюс — слова и числа list блока «Системы». */
  plus: string;
  /** Минус — цена цвета из «Что нужно знать» и из warning урока. */
  minus: string;
  /** Правый верхний угол квадранта: колонки 10 и 168, строки 24 и 88. */
  x: number;
  y: number;
};

/** Квадрант 142×58 с зазором 16 по горизонтали и 6 по вертикали. */
const QUAD_W = 142;
const QUAD_H = 58;

/**
 * Четыре системы урока: MMU2S (Prusa), AMS (Bambu), IDEX и Tool Changer.
 * Пятая системы списка — Palette — квадранта не получает: в блоке «Системы» она
 * названа словами «4 в 1» и стоит строкой внизу, как BLTouch в кадре O1.
 */
const SYSTEMS: System[] = [
  {
    name: "MMU2S · Prusa",
    color: "#38bdf8",
    art: "selector",
    plus: "5 цветов · буфер",
    minus: "калибровка важна",
    x: 10,
    y: 24,
  },
  {
    name: "AMS · Bambu",
    color: "#34d399",
    art: "box",
    plus: "4 цвета автоматом",
    minus: "башня 20–40 г",
    x: 168,
    y: 24,
  },
  {
    name: "IDEX",
    color: "#fbbf24",
    art: "twin",
    plus: "два экструдера",
    minus: "flush 100–200 мм³",
    x: 10,
    y: 88,
  },
  {
    name: "Tool Changer",
    color: "#c084fc",
    art: "rack",
    plus: "смена голов",
    minus: "ooze shield",
    x: 168,
    y: 88,
  },
];
/** Глиф механизма в квадранте: область 44×30, левый верхний угол — (x, y). */
function Art({ art, x, y }: { art: System["art"]; x: number; y: number }) {
  if (art === "selector") {
    // Пять катушек сходятся в селектор, за ним буфер и одно общее сопло.
    return (
      <g>
        {[0, 1, 2, 3, 4].map((index) => (
          <g key={index}>
            <line
              x1={x + 7.6}
              y1={y + 3 + index * 6}
              x2={x + 15}
              y2={y + 15}
              stroke="#475569"
              strokeWidth="0.7"
            />
            <circle
              cx={x + 5}
              cy={y + 3 + index * 6}
              r="2.6"
              fill="#1e293b"
              stroke="#38bdf8"
              strokeWidth="0.8"
            />
            <circle cx={x + 5} cy={y + 3 + index * 6} r="0.8" fill="#38bdf8" />
          </g>
        ))}
        <line x1={x + 15} y1={y + 4} x2={x + 15} y2={y + 26} stroke="#38bdf8" strokeWidth="1.2" />
        <circle cx={x + 24} cy={y + 15} r="4" fill="none" stroke="#38bdf8" strokeWidth="0.9" />
        <line x1={x + 15} y1={y + 15} x2={x + 20} y2={y + 15} stroke="#38bdf8" strokeWidth="1.2" />
        <line x1={x + 28} y1={y + 15} x2={x + 35} y2={y + 15} stroke="#38bdf8" strokeWidth="1.2" />
        <polygon
          points={`${x + 35},${y + 22} ${x + 43},${y + 22} ${x + 39},${y + 29}`}
          fill="#fbbf24"
        />
      </g>
    );
  }

  if (art === "box") {
    // Закрытая коробка на четыре катушки, на выходе — нож, дальше одна нить.
    return (
      <g>
        <rect
          x={x}
          y={y + 1}
          width="26"
          height="27"
          rx="3"
          fill="#1e293b"
          stroke="#34d399"
          strokeWidth="1"
        />
        {[7, 19].map((dx) =>
          [8, 20].map((dy) => (
            <g key={`${dx}-${dy}`}>
              <circle
                cx={x + dx}
                cy={y + dy}
                r="4"
                fill="#334155"
                stroke="#34d399"
                strokeWidth="0.8"
              />
              <circle cx={x + dx} cy={y + dy} r="1.2" fill="#34d399" />
            </g>
          )),
        )}
        <line x1={x + 26} y1={y + 15} x2={x + 43} y2={y + 15} stroke="#34d399" strokeWidth="1.2" />
        <polygon
          points={`${x + 29},${y + 11} ${x + 32},${y + 15} ${x + 29},${y + 19}`}
          fill="#34d399"
        />
      </g>
    );
  }
  if (art === "twin") {
    // Две каретки на одной балке: два независимых экструдера, один общий стол.
    return (
      <g>
        <line x1={x} y1={y + 3} x2={x + 44} y2={y + 3} stroke="#fbbf24" strokeWidth="1.6" />
        <rect x={x + 2} y={y + 6} width="12" height="10" rx="1" fill="#334155" stroke="#94a3b8" />
        <polygon points={`${x + 5},${y + 16} ${x + 11},${y + 16} ${x + 8},${y + 22}`} fill="#94a3b8" />
        <rect x={x + 28} y={y + 6} width="12" height="10" rx="1" fill="#334155" stroke="#94a3b8" />
        <polygon
          points={`${x + 31},${y + 16} ${x + 37},${y + 16} ${x + 34},${y + 22}`}
          fill="#94a3b8"
        />
        <line x1={x} y1={y + 28} x2={x + 44} y2={y + 28} stroke="#475569" strokeWidth="1.6" />
      </g>
    );
  }

  // Магазин голов и каретка: меняют голову целиком, а не нить внутри неё.
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="16"
        height="30"
        rx="2"
        fill="none"
        stroke="#c084fc"
        strokeWidth="0.9"
      />
      {[0, 1, 2].map((index) => (
        <rect
          key={index}
          x={x + 2}
          y={y + 3 + index * 9}
          width="12"
          height="6"
          rx="1"
          fill="#334155"
          stroke="#94a3b8"
          strokeWidth="0.6"
        />
      ))}
      <line
        x1={x + 16}
        y1={y + 15}
        x2={x + 26}
        y2={y + 15}
        stroke="#c084fc"
        strokeWidth="0.9"
        strokeDasharray="3 2"
      />
      <rect
        x={x + 26}
        y={y + 9}
        width="14"
        height="12"
        rx="1"
        fill="#334155"
        stroke="#c084fc"
        strokeWidth="0.9"
      />
      <polygon points={`${x + 30},${y + 21} ${x + 36},${y + 21} ${x + 33},${y + 27}`} fill="#fbbf24" />
    </g>
  );
}

/**
 * «Системы» — четыре способа печатать несколькими материалами, по квадранту на
 * способ: сверху имя и механизм подачи нити, под именем строка «+» (что система
 * даёт по list урока) и строка «−» (чем за цвет платят — по блоку «Что нужно
 * знать» и warning этого же урока).
 *
 * Ровно по content урока: «Фото: MMU2S, AMS, IDEX, Tool Changer. Под каждым —
 * плюсы и минусы», list «MMU (Prusa) — 5 цветов, буфер; AMS (Bambu) — 4 цвета,
 * автоматическая; IDEX — два независимых экструдера; Tool Changer — смена голов;
 * Palette — 4 в 1». Минусы взяты из блока «Что нужно знать» (промывочная башня
 * 20–40 г пластика, flush volume 100–200 мм³, ooze shield — защита от капель,
 * PLA+PETG плохо склеиваются, PLA+TPU — хорошо) и из warning (MMU и AMS требуют
 * калибровки, плохая настройка — застревание): своих минусов у отдельной системы
 * текст не называет, поэтому строка «−» каждой системы — общая цена цвета из
 * урока, а не выдуманный недостаток железа.
 *
 * От U-U2-image-0 (четыре коробки на прилавке, миниатюра внутри окна, тень
 * перспективы) отличается отсутствием прилавка и полок: четыре квадранта одной
 * сетки, внутри — механизм подачи нити, под ним парная подпись «плюс/минус». От
 * L-L1-image-0 (четыре независимые дорожки с финишем-моделью) — тем, что трасс и
 * дистанции нет: сравниваются механизмы, а не путь. От U-U3-image-0 (пять
 * платформ полосами с числами) и M-M2-image-0 (сравнение полосами) — тем, что
 * полос и чисел тут нет вовсе. От M-M3-image-0 (приборы на общей полке) и
 * L-L2-image-0 (модели на столе) — предметом: это не приборы и не детали, а
 * системы подачи пластика.
 *
 * Кадр статичный: это image-блок, движения в нём нет.
 */
export function ProOO3Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Схема четырёх систем мультиматериала: MMU2S от Prusa — пять катушек сходятся в селектор, за ним буфер и одно общее сопло, плюс пять цветов и буфер, минус — нужна калибровка; AMS от Bambu — коробка на четыре катушки с ножом на выходе, плюс четыре цвета автоматом, минус — промывочная башня 20–40 г; IDEX — две каретки с соплами на одной балке над общим столом, плюс два экструдера, минус — flush 100–200 мм³; Tool Changer — магазин из трёх голов и каретка, плюс смена голов, минус — ooze shield. Внизу: ещё в списке Palette — 4 в 1; PLA с PETG плохо склеиваются, PLA с TPU — хорошо"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          мультиматериал: четыре системы, один принтер
        </text>

        {SYSTEMS.map((system) => (
          <g key={system.name}>
            <rect
              x={system.x}
              y={system.y}
              width={QUAD_W}
              height={QUAD_H}
              rx="6"
              fill="#1e293b"
              fillOpacity="0.35"
              stroke="#475569"
            />
            <text
              x={system.x + 9}
              y={system.y + 15}
              fontSize="8.5"
              fontWeight="bold"
              fill={system.color}
            >
              {system.name}
            </text>
            <Art art={system.art} x={system.x + 9} y={system.y + 21} />
            <text x={system.x + 62} y={system.y + 33} fontSize="7.5" fill="#34d399">
              + {system.plus}
            </text>
            <text x={system.x + 62} y={system.y + 47} fontSize="7.5" fill="#fbbf24">
              − {system.minus}
            </text>
          </g>
        ))}

        <text x="12" y="163" fontSize="7.5" fill="#94a3b8">
          ещё в списке: Palette — 4 в 1 · PLA+PETG — плохо, PLA+TPU — хорошо
        </text>
      </svg>
    </VisualWrapper>
  );
}




