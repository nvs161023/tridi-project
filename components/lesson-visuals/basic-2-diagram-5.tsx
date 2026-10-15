import type { ReactElement } from "react";

import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пять покрытий: у каждого свой цвет полосы и своя схема слоя на столе. */
type IconKind = "glass" | "smooth" | "textured" | "magnetic" | "g10";

/** Свойства схемы: верхняя граница полосы и её цвет. */
type IconProps = { top: number; color: string };

/**
 * Одна полоса сравнения: имя покрытия, чем оно берёт и чем расплачивается.
 */
type SurfaceRow = {
  kind: IconKind;
  name: string;
  accent: string;
  /** Плюс покрытия из блока 26. */
  plus: string;
  /** Минус покрытия из блока 26. */
  minus: string;
};

/**
 * Пять покрытий ровно в порядке подписи блока 25: стекло, гладкий PEI,
 * текстурированный PEI, магнитный лист и G10.
 *
 * Числа — из блока 26: стекло боросиликатное 3–4 мм за 500–1500 ₽ греется
 * 8–12 минут; у гладкого PEI плёнка на стальном листе 0,5–0,8 мм, PETG может
 * привариться; у текстурированного адгезия падает после 100–300 печатей;
 * у магнитной плиты клеевые основания со временем отходят; G10 липнет почти без
 * нагрева, но хуже работает с ABS. BuildTak и клеи из того же списка в кадр не
 * попали: подпись блока называет ровно пять покрытий.
 */
const ROWS: SurfaceRow[] = [
  {
    kind: "glass",
    name: "Стекло",
    accent: "#38bdf8",
    plus: "стекло 3–4 мм, 500–1500 ₽",
    minus: "греется 8–12 минут, без клея плохо держит PLA",
  },
  {
    kind: "smooth",
    name: "PEI гладкий",
    accent: "#34d399",
    plus: "PLA и PETG липнут без клея",
    minus: "PETG может привариться: снимать на остывшем столе",
  },
  {
    kind: "textured",
    name: "PEI текстура",
    accent: "#a78bfa",
    plus: "матовая подошва первого слоя",
    minus: "адгезия падает после 100–300 печатей",
  },
  {
    kind: "magnetic",
    name: "Магнитный лист",
    accent: "#f59e0b",
    plus: "снимается изгибом листа",
    minus: "клеевые основания со временем отходят",
  },
  {
    kind: "g10",
    name: "G10 и FR4",
    accent: "#f472b6",
    plus: "липнет почти без нагрева",
    minus: "PLA и PETG держит, с ABS хуже, нужен зажим",
  },
];

/** Пять полос по 28 px: имя с плюсом в первой строке, минус во второй. */
const ROW_TOP = 20;
const ROW_HEIGHT = 28;
const ROW_GAP = 2;

/** Столбцы подписей: имя покрытия и общий столбец для обеих строк. */
const NAME_X = 50;
const PLUS_X = 146;
/** Строки плюса и минуса внутри полосы. */
const PLUS_Y = 11;
const MINUS_Y = 22;


/**
 * Стекло: толстая плита, деталь лежит на гладкой поверхности, клея нет — отсюда
 * и слабая адгезия с PLA.
 */
function GlassIcon({ top, color }: IconProps) {
  return (
    <g transform={`translate(22, ${top + 5})`}>
      <rect x="4" y="0" width="12" height="2" fill="#cbd5e1" />
      <rect x="0" y="4" width="20" height="7" rx="1" fill={color} fillOpacity="0.25" stroke={color} />
      <line x1="2" y1="6" x2="18" y2="6" stroke="#cbd5e1" strokeOpacity="0.4" />
    </g>
  );
}

/** Гладкий PEI: стальной лист гнётся, поэтому деталь снимают изгибом. */
function SmoothIcon({ top, color }: IconProps) {
  return (
    <g transform={`translate(22, ${top + 5})`}>
      <rect x="4" y="0" width="10" height="2" fill="#cbd5e1" />
      <path d="M0 7 L14 7 Q19 7 19 2" fill="none" stroke={color} strokeWidth="2.5" />
    </g>
  );
}

/** Текстурированный PEI: та же плёнка, но поверхность шершавая — точки. */
function TexturedIcon({ top, color }: IconProps) {
  return (
    <g transform={`translate(22, ${top + 5})`}>
      <rect x="4" y="0" width="12" height="2" fill="#cbd5e1" />
      <rect x="0" y="6" width="20" height="6" fill={color} fillOpacity="0.3" stroke={color} />
      {[3, 8, 13, 18].map((cx) => (
        <circle key={cx} cx={cx} cy="5" r="1.2" fill={color} />
      ))}
    </g>
  );
}

/** Магнитный лист: стальной лист на магнитной основе, приклеенной к плите. */
function MagneticIcon({ top, color }: IconProps) {
  return (
    <g transform={`translate(22, ${top + 5})`}>
      <rect x="4" y="0" width="10" height="2" fill="#cbd5e1" />
      <rect x="0" y="3" width="20" height="4" fill={color} fillOpacity="0.55" />
      <line x1="0" y1="8" x2="20" y2="8" stroke={color} strokeDasharray="2 2" />
      <rect x="0" y="10" width="20" height="5" fill={color} fillOpacity="0.2" stroke={color} />
      <line x1="0" y1="17" x2="20" y2="17" stroke="#64748b" />
    </g>
  );
}

/** G10: стеклотекстолит с сеткой волокна, липнет без клея и почти без нагрева. */
function G10Icon({ top, color }: IconProps) {
  return (
    <g transform={`translate(22, ${top + 5})`}>
      <rect x="4" y="0" width="12" height="2" fill="#cbd5e1" />
      <rect x="0" y="4" width="20" height="8" fill={color} fillOpacity="0.3" stroke={color} />
      <line x1="6" y1="4" x2="6" y2="12" stroke={color} strokeOpacity="0.6" />
      <line x1="13" y1="4" x2="13" y2="12" stroke={color} strokeOpacity="0.6" />
      <line x1="0" y1="8" x2="20" y2="8" stroke={color} strokeOpacity="0.6" />
    </g>
  );
}

/** Схемы слоёв по имени покрытия. */
const ICONS: Record<IconKind, (props: IconProps) => ReactElement> = {
  glass: GlassIcon,
  smooth: SmoothIcon,
  textured: TexturedIcon,
  magnetic: MagneticIcon,
  g10: G10Icon,
};


/**
 * Кадр блока 25 урока L2 «Пять покрытий стола».
 *
 * Компоновка — пять полос: это сравнение покрытий, поэтому слева схема слоя
 * (плита, плёнка, магнитная основа, сетка волокна), справа имя и две строки —
 * чем покрытие берёт и чем расплачивается. Порядок ровно как в подписи блока:
 * стекло, гладкий PEI, текстурированный PEI, магнитный лист, G10.
 *
 * Числа — из блока 26: стекло боросиликатное 3–4 мм за 500–1500 ₽ греется
 * 8–12 минут и плохо держит PLA без клея; гладкий PEI — плёнка на стальном листе
 * 0,5–0,8 мм, PETG на нём приваривается; у текстурированного адгезия падает после
 * 100–300 печатей; у магнитной плиты отходят клеевые основания; G10 липнет почти
 * без нагрева, но с ABS хуже. BuildTak и клеи-разделители из того же списка в
 * кадре отсутствуют: подпись блока называет ровно пять покрытий.
 */
export function Basic2Diagram5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сравнение пяти покрытий стола для FDM-принтера: стекло боросиликатное 3–4 мм за 500–1500 ₽ — ровное и дешёвое, но греется 8–12 минут и без клея плохо держит PLA; гладкий PEI на стальном листе 0,5–0,8 мм — PLA и PETG липнут без клея, но PETG может привариться и снимать деталь можно только на остывшем столе; текстурированный PEI даёт матовую подошву и прощает огрехи первого слоя, но адгезия падает после 100–300 печатей; магнитный лист снимается изгибом без скребка, зато клеевые основания со временем отходят; G10 и FR4 липнут без клея и почти без нагрева, но хуже работают с ABS и требуют зажима по краям"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
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

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          Покрытия стола: адгезия, ресурс, цена
        </text>

        {/* Полосы-покрытия: цвет слева, схема слоя, плюс и минус справа */}
        {ROWS.map((row, index) => {
          const top = ROW_TOP + index * (ROW_HEIGHT + ROW_GAP);
          const Icon = ICONS[row.kind];

          return (
            <g key={row.kind}>
              <rect
                x="12"
                y={top}
                width="296"
                height={ROW_HEIGHT}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <rect
                x="14"
                y={top + 4}
                width="3"
                height={ROW_HEIGHT - 8}
                rx="1.5"
                fill={row.accent}
              />

              <Icon top={top} color={row.accent} />

              <text
                x={NAME_X}
                y={top + PLUS_Y}
                fontSize="10"
                fontWeight="700"
                fill={row.accent}
              >
                {row.name}
              </text>
              <text x={PLUS_X} y={top + PLUS_Y} fontSize="10" fill="#e2e8f0">
                {row.plus}
              </text>
              <text x={NAME_X} y={top + MINUS_Y} fontSize="10" fill="#94a3b8">
                {row.minus}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
