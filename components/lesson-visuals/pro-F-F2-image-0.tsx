import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Колонки поддержек под нависанием: чем их больше, тем хуже ориентация. */
const manySupports = [52, 56, 60, 64, 68];
const fewSupports = [190, 195];

/**
 * Примеры ориентации — одна и та же деталь в трёх положениях сбоку, и разница
 * только в объёме поддержек: стоя с горизонтальной полкой их много, наклонённая
 * обходится парой, лежащая плашмя — без единой.
 *
 * Ровно по content урока: «деталь в трёх ориентациях. Слева — много поддержек.
 * В центре — мало. Справа — без поддержек» и по правилам из списка: «минимум
 * поддержек — без нависаний», «высокие модели — brim 10 мм».
 *
 * От «До и после» в базовом уроке 11 (кубик с поддержками рядом) и от вида
 * плиты сверху в уроке 12 отличается ракурсом: там плита и одна деталь вид сверху,
 * здесь три профиля сбоку на одной линии стола, а объём поддержек — главное, что
 * отличает кадры друг от друга.
 */
export function ProFF2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Примеры ориентации: одна деталь в трёх положениях сбоку — стоя с горизонтальной полкой под ней пять столбиков поддержек, наклонённая обходится двумя столбиками, лежащая плашмя печатается без поддержек"
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

        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          три ориентации одной детали
        </text>

        {/* Панель 1: стоя — под полкой пять столбиков поддержек */}
        <rect x="8" y="26" width="98" height="100" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="57" y="40" fontSize="10" fontWeight="bold" fill="#fdba74" textAnchor="middle">
          много поддержек
        </text>
        {manySupports.map((offset) => (
          <rect key={`many-${offset}`} x={8 + offset} y="74" width="2" height="44" fill="#475569" />
        ))}
        <rect x="48" y="66" width="10" height="52" fill="#475569" stroke="#94a3b8" />
        <rect x="48" y="66" width="30" height="8" fill="#475569" stroke="#94a3b8" />
        <line x1="14" y1="118" x2="100" y2="118" stroke="#475569" />

        {/* Панель 2: наклонённая — хватает двух столбиков */}
        <rect x="110" y="26" width="98" height="100" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="159" y="40" fontSize="10" fontWeight="bold" fill="#fcd34d" textAnchor="middle">
          мало поддержек
        </text>
        {fewSupports.map((offset) => (
          <rect key={`few-${offset}`} x={offset} y="96" width="3" height="22" fill="#475569" />
        ))}
        <g transform="rotate(30 155 118)">
          <rect x="150" y="66" width="10" height="52" fill="#475569" stroke="#94a3b8" />
          <rect x="150" y="66" width="30" height="8" fill="#475569" stroke="#94a3b8" />
        </g>
        <line x1="116" y1="118" x2="202" y2="118" stroke="#475569" />

        {/* Панель 3: плашмя — нависаний нет, поддержки не нужны */}
        <rect x="212" y="26" width="98" height="100" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="261" y="40" fontSize="10" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
          без поддержек
        </text>
        <rect x="238" y="110" width="46" height="8" fill="#475569" stroke="#94a3b8" />
        <rect x="238" y="70" width="8" height="40" fill="#475569" stroke="#94a3b8" />
        <line x1="218" y1="118" x2="304" y2="118" stroke="#475569" />

        <text x="12" y="146" fontSize="10" fill="#e2e8f0">
          минимум поддержек — без нависаний
        </text>
        <text x="12" y="164" fontSize="9" fill="#94a3b8">
          высокие модели — brim 10 мм
        </text>
      </svg>
    </VisualWrapper>
  );
}
